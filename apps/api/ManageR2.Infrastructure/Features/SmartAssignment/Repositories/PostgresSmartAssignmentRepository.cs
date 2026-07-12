using System.Data;
using System.Data.Common;
using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Models.SmartAssignment;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Repositories.SmartAssignment
{
    // PostgreSQL implementation of the SmartAssignment data layer (Wave 5). Reproduces the semantics of
    // the four Rec_ stored procedures used by the application:
    //   * Rec_GetTaskRecommendationInput  (14 result sets → TaskRecommendationInputModel)
    //   * Rec_GetDraftTaskRecommendationInput (14 result sets, synthesized draft task)
    //   * Rec_CreateRecommendationRun (write, returns new id)
    //   * Rec_SaveTaskAssignmentRecommendation (write)
    //
    // The multi-result-set stored procedures are re-expressed as explicit sequential queries over one
    // connection that hydrate the same provider-neutral model. No scoring lives here — that stays in
    // SmartAssignmentService. Ordering is made explicit (the SPs have no ORDER BY on these result sets;
    // the C# scoring is order-insensitive, so deterministic ordering here only stabilizes shadow-read
    // parity comparison without changing the effective API result).
    public sealed class PostgresSmartAssignmentRepository : ISmartAssignmentRepository
    {
        private readonly PostgresConnectionFactory _connectionFactory;
        private readonly ILogger<PostgresSmartAssignmentRepository> _logger;

        public PostgresSmartAssignmentRepository(
            PostgresConnectionFactory connectionFactory,
            ILogger<PostgresSmartAssignmentRepository> logger)
        {
            _connectionFactory = connectionFactory;
            _logger = logger;
        }

        // Mirrors dbo.Rec_GetTaskRecommendationInput for a saved work item.
        public async Task<TaskRecommendationInputModel> GetTaskRecommendationInputAsync(int workItemId)
        {
            await using var connection = _connectionFactory.CreateConnection();
            await connection.OpenAsync();

            // Task core scalars (also used as the algorithm window / continuity keys), matching the
            // SP's DECLARE @StartAt/@EndAt/@ParentWorkItemId/@TaskCustomerId/@TaskSiteId reads.
            var (planStart, planEnd, parentWorkItemId, customerId, siteId) =
                await LoadTaskScalarsAsync(connection, workItemId);

            var result = new TaskRecommendationInputModel
            {
                Task = await LoadTaskCoreAsync(connection, workItemId)
            };

            result.RequiredSkills.AddRange(await LoadRequiredSkillsAsync(connection, workItemId));
            result.Employees.AddRange(await LoadEmployeesAsync(connection));
            result.EmployeeSkills.AddRange(await LoadEmployeeSkillsAsync(connection));
            result.EmployeeAvailability.AddRange(await LoadAvailabilityAsync(connection, planStart, planEnd));
            result.EmployeeCapacities.AddRange(await LoadCapacitiesAsync(connection));
            result.EmployeeBaseAddresses.AddRange(await LoadBaseAddressesAsync(connection));
            result.SiteAddress = await LoadSiteAddressAsync(connection, siteId);
            result.EmployeeWorkZones.AddRange(await LoadWorkZonesAsync(connection));
            result.PlannedStops.AddRange(await LoadPlannedStopsAsync(connection, planStart));
            result.LocationEvents.AddRange(await LoadLocationEventsAsync(connection, planStart));
            result.RouteEstimates.AddRange(await LoadRouteEstimatesAsync(connection, siteId));
            result.EmployeeCurrentLoads.AddRange(
                await LoadCurrentLoadsAsync(connection, planStart, excludeWorkItemId: workItemId));
            result.EmployeeContinuities.AddRange(
                await LoadContinuitiesAsync(connection, parentWorkItemId, customerId, siteId, excludeWorkItemId: workItemId));

            return result;
        }

        // Mirrors dbo.Rec_GetDraftTaskRecommendationInput: the task core row is synthesized from the draft
        // context and RS2 (required skills) is intentionally empty; RS3-RS12 resolve against the draft's
        // resolved site/window; RS13/RS14 resolve against the draft day and project/customer/site with no
        // "current task" to exclude.
        public async Task<TaskRecommendationInputModel> GetDraftTaskRecommendationInputAsync(
            DraftTaskRecommendationContextModel context)
        {
            if (context.TaskCategory is not ("Regular" or "Project" or "ServiceCall"))
            {
                // Parity with THROW 51400 in the SP (a defensive backstop behind the DTO validator).
                throw new InvalidOperationException("Invalid TaskCategory for draft recommendation.");
            }

            await using var connection = _connectionFactory.CreateConnection();
            await connection.OpenAsync();

            var resolvedWorkType = context.TaskCategory == "ServiceCall" ? "ServiceCall" : "Task";
            var resolvedParentWorkItemId = context.TaskCategory == "Project" ? context.ProjectId : null;

            // COALESCE(@SiteId, project.SiteId) and COALESCE(@CustomerId, project.CustomerId).
            int? projectSiteId = null;
            int? projectCustomerId = null;
            if (context.ProjectId is not null && (context.SiteId is null || context.CustomerId is null))
            {
                (projectSiteId, projectCustomerId) = await LoadProjectSiteCustomerAsync(connection, context.ProjectId.Value);
            }

            var resolvedSiteId = context.SiteId ?? projectSiteId;
            var resolvedCustomerId = context.CustomerId ?? projectCustomerId;

            var resolvedEstimatedHours = context.EstimatedHours
                ?? (context.PlannedEnd > context.PlannedStart
                    ? decimal.Round((decimal)(context.PlannedEnd - context.PlannedStart).TotalMinutes / 60m, 2)
                    : (decimal?)null);

            var planStart = context.PlannedStart;
            var planEnd = context.PlannedEnd;

            var result = new TaskRecommendationInputModel
            {
                // RS1: synthesized draft task (WorkItemId 0, Title "(טיוטה)", Status "Planned").
                Task = new TaskCoreDataModel
                {
                    WorkItemId = 0,
                    Title = "(טיוטה)",
                    WorkType = resolvedWorkType,
                    Status = "Planned",
                    PlannedStart = planStart,
                    PlannedEnd = planEnd,
                    EstimatedHours = resolvedEstimatedHours,
                    Priority = context.Priority,
                    RequiredRole = context.RequiredRole,
                    IsLocked = false,
                    SiteId = resolvedSiteId,
                    CustomerId = resolvedCustomerId,
                    ParentWorkItemId = resolvedParentWorkItemId,
                    ProjectType = null,
                    RequiredWorkersCount = null,
                    AlgorithmPriorityOverride = null,
                    UrgencyOverride = null,
                    PlanningNotes = null
                }
            };

            // RS2 (required skills) is empty for a draft (SP: WHERE 1 = 0).
            result.Employees.AddRange(await LoadEmployeesAsync(connection));
            result.EmployeeSkills.AddRange(await LoadEmployeeSkillsAsync(connection));
            result.EmployeeAvailability.AddRange(await LoadAvailabilityAsync(connection, planStart, planEnd));
            result.EmployeeCapacities.AddRange(await LoadCapacitiesAsync(connection));
            result.EmployeeBaseAddresses.AddRange(await LoadBaseAddressesAsync(connection));
            result.SiteAddress = await LoadSiteAddressAsync(connection, resolvedSiteId);
            result.EmployeeWorkZones.AddRange(await LoadWorkZonesAsync(connection));
            result.PlannedStops.AddRange(await LoadPlannedStopsAsync(connection, planStart));
            result.LocationEvents.AddRange(await LoadLocationEventsAsync(connection, planStart));
            result.RouteEstimates.AddRange(await LoadRouteEstimatesAsync(connection, resolvedSiteId));
            // Draft RS13: no current-task exclusion and no @StartAt IS NOT NULL guard.
            result.EmployeeCurrentLoads.AddRange(
                await LoadCurrentLoadsAsync(connection, planStart, excludeWorkItemId: null));
            // Draft RS14: continuity keyed on raw @ProjectId (project), resolved customer/site, no task exclusion.
            result.EmployeeContinuities.AddRange(
                await LoadContinuitiesAsync(connection, context.ProjectId, resolvedCustomerId, resolvedSiteId, excludeWorkItemId: null));

            return result;
        }

        // Mirrors dbo.Rec_CreateRecommendationRun (INSERT + SCOPE_IDENTITY → RETURNING).
        public async Task<int> CreateRecommendationRunAsync(
            string scopeType,
            int? projectId,
            int? taskId,
            int? requestedByUserId,
            string algorithmVersion,
            string? inputSnapshotJson)
        {
            await using var connection = _connectionFactory.CreateConnection();
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                INSERT INTO "Rec_RecommendationRuns"
                    ("ScopeType", "ProjectId", "TaskId", "RequestedByUserId",
                     "AlgorithmVersion", "RunStatus", "InputSnapshotJson", "CreatedAt")
                VALUES
                    (@ScopeType, @ProjectId, @TaskId, @RequestedByUserId,
                     @AlgorithmVersion, 'Completed', @InputSnapshotJson, (now() at time zone 'utc'))
                RETURNING "RecommendationRunId"
                """;
            AddParam(command, "@ScopeType", scopeType);
            AddParam(command, "@ProjectId", projectId);
            AddParam(command, "@TaskId", taskId);
            AddParam(command, "@RequestedByUserId", requestedByUserId);
            AddParam(command, "@AlgorithmVersion", string.IsNullOrWhiteSpace(algorithmVersion) ? "1.0" : algorithmVersion);
            AddParam(command, "@InputSnapshotJson", inputSnapshotJson);

            var scalar = await command.ExecuteScalarAsync();
            return scalar is null or DBNull ? 0 : Convert.ToInt32(scalar);
        }

        // Mirrors dbo.Rec_SaveTaskAssignmentRecommendation (single INSERT). UrgencyClass and ZoneMatch are
        // always persisted as NULL here, matching the SQL Server repository call site exactly.
        public async Task SaveTaskAssignmentRecommendationAsync(int runId, int taskId, EmployeeCandidateModel candidate)
        {
            await using var connection = _connectionFactory.CreateConnection();
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                INSERT INTO "Rec_TaskAssignmentRecommendations"
                    ("RecommendationRunId", "TaskId", "EmployeeId", "UrgencyClass", "OriginTypeUsed",
                     "RankOrder", "TotalScore", "ProfessionalScore", "AvailabilityScore", "WorkloadScore",
                     "ExperienceScore", "GeographicScore", "ContinuityScore", "DistanceKm", "TravelMinutes",
                     "MatchedSkillsCount", "MissingSkillsCount", "OpenAssignmentsCount", "CurrentWorkloadHours",
                     "ZoneMatch", "WorkedWithCustomerBefore", "WorkedAtSiteBefore", "RecommendationSummary",
                     "WarningsJson", "CreatedAt")
                VALUES
                    (@RecommendationRunId, @TaskId, @EmployeeId, @UrgencyClass, @OriginTypeUsed,
                     @RankOrder, @TotalScore, @ProfessionalScore, @AvailabilityScore, @WorkloadScore,
                     @ExperienceScore, @GeographicScore, @ContinuityScore, @DistanceKm, @TravelMinutes,
                     @MatchedSkillsCount, @MissingSkillsCount, @OpenAssignmentsCount, @CurrentWorkloadHours,
                     @ZoneMatch, @WorkedWithCustomerBefore, @WorkedAtSiteBefore, @RecommendationSummary,
                     @WarningsJson, (now() at time zone 'utc'))
                """;
            AddParam(command, "@RecommendationRunId", runId);
            AddParam(command, "@TaskId", taskId);
            AddParam(command, "@EmployeeId", candidate.EmployeeId);
            AddParam(command, "@UrgencyClass", (string?)null);
            AddParam(command, "@OriginTypeUsed", candidate.OriginTypeUsed);
            AddParam(command, "@RankOrder", candidate.RankOrder ?? 0);
            AddParam(command, "@TotalScore", candidate.TotalScore ?? 0m);
            AddParam(command, "@ProfessionalScore", candidate.ProfessionalScore);
            AddParam(command, "@AvailabilityScore", candidate.AvailabilityScore);
            AddParam(command, "@WorkloadScore", candidate.WorkloadScore);
            AddParam(command, "@ExperienceScore", candidate.ExperienceScore);
            AddParam(command, "@GeographicScore", candidate.GeographicScore);
            AddParam(command, "@ContinuityScore", candidate.ContinuityScore);
            AddParam(command, "@DistanceKm", candidate.DistanceKm);
            AddParam(command, "@TravelMinutes", candidate.TravelMinutes);
            AddParam(command, "@MatchedSkillsCount", candidate.MatchedSkillsCount);
            AddParam(command, "@MissingSkillsCount", candidate.MissingSkillsCount);
            AddParam(command, "@OpenAssignmentsCount", candidate.OpenAssignmentsCount);
            AddParam(command, "@CurrentWorkloadHours", candidate.CurrentWorkloadHours);
            AddParam(command, "@ZoneMatch", (bool?)null);
            AddParam(command, "@WorkedWithCustomerBefore", candidate.WorkedWithCustomerBefore);
            AddParam(command, "@WorkedAtSiteBefore", candidate.WorkedAtSiteBefore);
            AddParam(command, "@RecommendationSummary", candidate.RecommendationSummary);
            AddParam(command, "@WarningsJson", candidate.WarningsJson);

            await command.ExecuteNonQueryAsync();
        }

        // =====================================================================
        // Result-set loaders (one per SP SELECT)
        // =====================================================================

        private static async Task<(DateTime? PlannedStart, DateTime? PlannedEnd, int? ParentWorkItemId, int? CustomerId, int? SiteId)>
            LoadTaskScalarsAsync(DbConnection connection, int workItemId)
        {
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT "PlannedStart", "PlannedEnd", "ParentWorkItemId", "CustomerId", "SiteId"
                FROM "WorkItems" WHERE "WorkItemId" = @WorkItemId
                """;
            AddParam(command, "@WorkItemId", workItemId);
            await using var reader = await command.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                return (
                    GetNullableDateTime(reader, "PlannedStart"),
                    GetNullableDateTime(reader, "PlannedEnd"),
                    GetNullableInt(reader, "ParentWorkItemId"),
                    GetNullableInt(reader, "CustomerId"),
                    GetNullableInt(reader, "SiteId"));
            }

            return (null, null, null, null, null);
        }

        private static async Task<(int? SiteId, int? CustomerId)> LoadProjectSiteCustomerAsync(
            DbConnection connection, int projectId)
        {
            await using var command = connection.CreateCommand();
            command.CommandText =
                """SELECT "SiteId", "CustomerId" FROM "WorkItems" WHERE "WorkItemId" = @ProjectId""";
            AddParam(command, "@ProjectId", projectId);
            await using var reader = await command.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                return (GetNullableInt(reader, "SiteId"), GetNullableInt(reader, "CustomerId"));
            }

            return (null, null);
        }

        // RS1 (saved task): task core + algorithm profile.
        private static async Task<TaskCoreDataModel?> LoadTaskCoreAsync(DbConnection connection, int workItemId)
        {
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT wi."WorkItemId", wi."Title", wi."WorkType", wi."Status", wi."PlannedStart",
                       wi."PlannedEnd", wi."EstimatedHours", wi."Priority", wi."RequiredRole", wi."IsLocked",
                       wi."SiteId", wi."CustomerId", wi."ParentWorkItemId",
                       ap."ProjectType", ap."RequiredWorkersCount", ap."AlgorithmPriorityOverride",
                       ap."UrgencyOverride", ap."PlanningNotes"
                FROM "WorkItems" wi
                LEFT JOIN "Rec_WorkItemAlgorithmProfile" ap ON ap."WorkItemId" = wi."WorkItemId"
                WHERE wi."WorkItemId" = @WorkItemId
                """;
            AddParam(command, "@WorkItemId", workItemId);
            await using var reader = await command.ExecuteReaderAsync();
            if (!await reader.ReadAsync())
            {
                return null;
            }

            return new TaskCoreDataModel
            {
                WorkItemId = GetInt(reader, "WorkItemId"),
                Title = GetString(reader, "Title"),
                WorkType = GetString(reader, "WorkType"),
                Status = GetString(reader, "Status"),
                PlannedStart = GetNullableDateTime(reader, "PlannedStart"),
                PlannedEnd = GetNullableDateTime(reader, "PlannedEnd"),
                EstimatedHours = GetNullableDecimal(reader, "EstimatedHours"),
                Priority = GetString(reader, "Priority"),
                RequiredRole = GetString(reader, "RequiredRole"),
                IsLocked = GetBool(reader, "IsLocked"),
                SiteId = GetNullableInt(reader, "SiteId"),
                CustomerId = GetNullableInt(reader, "CustomerId"),
                ParentWorkItemId = GetNullableInt(reader, "ParentWorkItemId"),
                ProjectType = GetString(reader, "ProjectType"),
                RequiredWorkersCount = GetNullableInt(reader, "RequiredWorkersCount"),
                AlgorithmPriorityOverride = GetString(reader, "AlgorithmPriorityOverride"),
                UrgencyOverride = GetString(reader, "UrgencyOverride"),
                PlanningNotes = GetString(reader, "PlanningNotes")
            };
        }

        // RS2: required skills (ordered by importance so parity is deterministic).
        private static async Task<List<RequiredSkillModel>> LoadRequiredSkillsAsync(DbConnection connection, int workItemId)
        {
            var list = new List<RequiredSkillModel>();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT r."WorkItemId", r."SkillId", s."SkillName", s."SkillCategory",
                       r."RequiredLevel", r."ImportanceLevel"
                FROM "Rec_WorkItemRequiredSkills" r
                INNER JOIN "Rec_Skills" s ON s."SkillId" = r."SkillId"
                WHERE r."WorkItemId" = @WorkItemId
                ORDER BY r."SkillId"
                """;
            AddParam(command, "@WorkItemId", workItemId);
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new RequiredSkillModel
                {
                    WorkItemId = GetInt(reader, "WorkItemId"),
                    SkillId = GetInt(reader, "SkillId"),
                    SkillName = GetString(reader, "SkillName"),
                    SkillCategory = GetString(reader, "SkillCategory"),
                    RequiredLevel = GetNullableInt(reader, "RequiredLevel") ?? 0,
                    ImportanceLevel = GetString(reader, "ImportanceLevel")
                });
            }

            return list;
        }

        // RS3: active + assignable employees.
        private static async Task<List<EmployeeCandidateModel>> LoadEmployeesAsync(DbConnection connection)
        {
            var list = new List<EmployeeCandidateModel>();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT "EmployeeId", "FullName", "PrimaryRole", "IsActive", "IsAssignable", "DailyCapacityHours"
                FROM "Employees"
                WHERE "IsActive" = true AND "IsAssignable" = true
                ORDER BY "EmployeeId"
                """;
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new EmployeeCandidateModel
                {
                    EmployeeId = GetInt(reader, "EmployeeId"),
                    FullName = GetString(reader, "FullName"),
                    PrimaryRole = GetString(reader, "PrimaryRole"),
                    IsActive = GetBool(reader, "IsActive"),
                    IsAssignable = GetBool(reader, "IsAssignable"),
                    DailyCapacityHours = GetNullableDecimal(reader, "DailyCapacityHours")
                });
            }

            return list;
        }

        // RS4: employee skills.
        private static async Task<List<EmployeeSkillModel>> LoadEmployeeSkillsAsync(DbConnection connection)
        {
            var list = new List<EmployeeSkillModel>();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT es."EmployeeId", es."SkillId", s."SkillName", es."SkillLevel",
                       es."YearsExperience", es."IsCertified"
                FROM "Rec_EmployeeSkills" es
                INNER JOIN "Rec_Skills" s ON s."SkillId" = es."SkillId"
                ORDER BY es."EmployeeId", es."SkillId"
                """;
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new EmployeeSkillModel
                {
                    EmployeeId = GetInt(reader, "EmployeeId"),
                    SkillId = GetInt(reader, "SkillId"),
                    SkillName = GetString(reader, "SkillName"),
                    SkillLevel = GetInt(reader, "SkillLevel"),
                    YearsExperience = GetNullableDecimal(reader, "YearsExperience"),
                    IsCertified = GetBool(reader, "IsCertified")
                });
            }

            return list;
        }

        // RS5: availability overlapping the task window.
        private static async Task<List<EmployeeAvailabilityModel>> LoadAvailabilityAsync(
            DbConnection connection, DateTime? startAt, DateTime? endAt)
        {
            var list = new List<EmployeeAvailabilityModel>();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT a."EmployeeId", a."AvailableFrom", a."AvailableTo", a."AvailabilityType", a."Source"
                FROM "Rec_EmployeeAvailability" a
                WHERE a."AvailableFrom" < @EndAt::timestamp
                  AND a."AvailableTo" > @StartAt::timestamp
                ORDER BY a."EmployeeId", a."AvailableFrom"
                """;
            AddParam(command, "@EndAt", endAt);
            AddParam(command, "@StartAt", startAt);
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new EmployeeAvailabilityModel
                {
                    EmployeeId = GetInt(reader, "EmployeeId"),
                    AvailableFrom = GetDateTime(reader, "AvailableFrom"),
                    AvailableTo = GetDateTime(reader, "AvailableTo"),
                    AvailabilityType = GetString(reader, "AvailabilityType"),
                    Source = GetString(reader, "Source")
                });
            }

            return list;
        }

        // RS6: employee capacities.
        private static async Task<List<EmployeeCapacityModel>> LoadCapacitiesAsync(DbConnection connection)
        {
            var list = new List<EmployeeCapacityModel>();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT c."EmployeeId", c."WeeklyCapacityHours", c."EffectiveFrom", c."EffectiveTo"
                FROM "Rec_EmployeeCapacity" c
                ORDER BY c."EmployeeId", c."EffectiveFrom"
                """;
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new EmployeeCapacityModel
                {
                    EmployeeId = GetInt(reader, "EmployeeId"),
                    WeeklyCapacityHours = GetDecimal(reader, "WeeklyCapacityHours"),
                    EffectiveFrom = GetDateTime(reader, "EffectiveFrom"),
                    EffectiveTo = GetNullableDateTime(reader, "EffectiveTo")
                });
            }

            return list;
        }

        // RS7: employee base addresses.
        private static async Task<List<EmployeeBaseAddressModel>> LoadBaseAddressesAsync(DbConnection connection)
        {
            var list = new List<EmployeeBaseAddressModel>();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT b."EmployeeId", b."FormattedAddress", b."City", b."ZoneId"
                FROM "Rec_EmployeeBaseAddress" b
                ORDER BY b."EmployeeId"
                """;
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new EmployeeBaseAddressModel
                {
                    EmployeeId = GetInt(reader, "EmployeeId"),
                    FormattedAddress = GetString(reader, "FormattedAddress"),
                    City = GetString(reader, "City"),
                    ZoneId = GetNullableInt(reader, "ZoneId")
                });
            }

            return list;
        }

        // RS8: site address for the task site. Null site id yields no row (parity with "= NULL").
        private static async Task<SiteAddressModel?> LoadSiteAddressAsync(DbConnection connection, int? siteId)
        {
            if (siteId is null)
            {
                return null;
            }

            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT p."SiteId", p."FormattedAddress", p."City", p."ZoneId"
                FROM "Rec_SiteAddressProfile" p
                WHERE p."SiteId" = @SiteId
                """;
            AddParam(command, "@SiteId", siteId);
            await using var reader = await command.ExecuteReaderAsync();
            if (!await reader.ReadAsync())
            {
                return null;
            }

            return new SiteAddressModel
            {
                SiteId = GetInt(reader, "SiteId"),
                FormattedAddress = GetString(reader, "FormattedAddress"),
                City = GetString(reader, "City"),
                ZoneId = GetNullableInt(reader, "ZoneId")
            };
        }

        // RS9: employee work zones.
        private static async Task<List<EmployeeWorkZoneModel>> LoadWorkZonesAsync(DbConnection connection)
        {
            var list = new List<EmployeeWorkZoneModel>();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT ewz."EmployeeId", ewz."ZoneId", ewz."IsPrimary"
                FROM "Rec_EmployeeWorkZones" ewz
                ORDER BY ewz."EmployeeId", ewz."ZoneId"
                """;
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new EmployeeWorkZoneModel
                {
                    EmployeeId = GetInt(reader, "EmployeeId"),
                    ZoneId = GetInt(reader, "ZoneId"),
                    IsPrimary = GetBool(reader, "IsPrimary")
                });
            }

            return list;
        }

        // RS10: planned stops on the task day.
        private static async Task<List<EmployeePlannedStopModel>> LoadPlannedStopsAsync(
            DbConnection connection, DateTime? startAt)
        {
            var list = new List<EmployeePlannedStopModel>();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT ps."EmployeeId", ps."SiteId", ps."PlannedStartAt", ps."PlannedEndAt", ps."FormattedAddress"
                FROM "Rec_EmployeePlannedStops" ps
                WHERE ps."PlannedDate" = @StartAt::date
                ORDER BY ps."EmployeeId", ps."PlannedEndAt"
                """;
            AddParam(command, "@StartAt", startAt);
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new EmployeePlannedStopModel
                {
                    EmployeeId = GetInt(reader, "EmployeeId"),
                    SiteId = GetNullableInt(reader, "SiteId"),
                    PlannedStartAt = GetNullableDateTime(reader, "PlannedStartAt"),
                    PlannedEndAt = GetNullableDateTime(reader, "PlannedEndAt"),
                    FormattedAddress = GetString(reader, "FormattedAddress")
                });
            }

            return list;
        }

        // RS11: location events on the task day.
        private static async Task<List<EmployeeLocationEventModel>> LoadLocationEventsAsync(
            DbConnection connection, DateTime? startAt)
        {
            var list = new List<EmployeeLocationEventModel>();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT le."EmployeeId", le."FormattedAddress", le."EventTime"
                FROM "Rec_EmployeeLocationEvents" le
                WHERE le."EventDate" = @StartAt::date
                ORDER BY le."EmployeeId", le."EventTime"
                """;
            AddParam(command, "@StartAt", startAt);
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new EmployeeLocationEventModel
                {
                    EmployeeId = GetInt(reader, "EmployeeId"),
                    FormattedAddress = GetString(reader, "FormattedAddress"),
                    EventTime = GetDateTime(reader, "EventTime")
                });
            }

            return list;
        }

        // RS12: current route estimates to the task site. Null site id yields no rows.
        private static async Task<List<RouteEstimateModel>> LoadRouteEstimatesAsync(DbConnection connection, int? siteId)
        {
            var list = new List<RouteEstimateModel>();
            if (siteId is null)
            {
                return list;
            }

            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT r."EmployeeId", r."TargetSiteId", r."OriginType", r."EstimatedDistanceKm", r."EstimatedTravelMinutes"
                FROM "Rec_RouteEstimates" r
                WHERE r."IsCurrent" = true AND r."TargetSiteId" = @SiteId
                ORDER BY r."EmployeeId", r."OriginType"
                """;
            AddParam(command, "@SiteId", siteId);
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new RouteEstimateModel
                {
                    EmployeeId = GetInt(reader, "EmployeeId"),
                    TargetSiteId = GetInt(reader, "TargetSiteId"),
                    OriginType = GetString(reader, "OriginType"),
                    EstimatedDistanceKm = GetNullableDecimal(reader, "EstimatedDistanceKm"),
                    EstimatedTravelMinutes = GetNullableInt(reader, "EstimatedTravelMinutes")
                });
            }

            return list;
        }

        // RS13: open assignments + committed hours on the (task/draft) day, from existing assignments.
        // excludeWorkItemId is the current saved task (null for a draft, which has no id yet).
        private static async Task<List<EmployeeCurrentLoadModel>> LoadCurrentLoadsAsync(
            DbConnection connection, DateTime? startAt, int? excludeWorkItemId)
        {
            var list = new List<EmployeeCurrentLoadModel>();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT e."EmployeeId",
                       COALESCE(load.open_count, 0) AS "OpenAssignmentsCount",
                       CAST(COALESCE(load.assigned_hours, 0) AS numeric(10,2)) AS "CurrentAssignedHours"
                FROM "Employees" e
                LEFT JOIN LATERAL (
                    SELECT COUNT(DISTINCT wiLoad."WorkItemId") AS open_count,
                           SUM(COALESCE(wiLoad."EstimatedHours", 0)) AS assigned_hours
                    FROM "WorkEmployeeAssignments" wea
                    INNER JOIN "WorkItems" wiLoad ON wiLoad."WorkItemId" = wea."WorkItemId"
                    WHERE wea."EmployeeId" = e."EmployeeId"
                      AND (@ExcludeWorkItemId::int IS NULL OR wiLoad."WorkItemId" <> @ExcludeWorkItemId::int)
                      AND @StartAt::timestamp IS NOT NULL
                      AND wiLoad."PlannedStart"::date = @StartAt::date
                      AND COALESCE(wiLoad."Status", '') NOT IN ('Closed', 'Cancelled', 'Canceled', 'Deleted')
                ) load ON true
                WHERE e."IsActive" = true AND e."IsAssignable" = true
                ORDER BY e."EmployeeId"
                """;
            AddParam(command, "@ExcludeWorkItemId", excludeWorkItemId);
            AddParam(command, "@StartAt", startAt);
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new EmployeeCurrentLoadModel
                {
                    EmployeeId = GetInt(reader, "EmployeeId"),
                    OpenAssignmentsCount = GetNullableInt(reader, "OpenAssignmentsCount") ?? 0,
                    CurrentAssignedHours = GetNullableDecimal(reader, "CurrentAssignedHours") ?? 0m
                });
            }

            return list;
        }

        // RS14: prior-assignment continuity vs the task's project (parent) / customer / site.
        private static async Task<List<EmployeeContinuityModel>> LoadContinuitiesAsync(
            DbConnection connection, int? parentWorkItemId, int? customerId, int? siteId, int? excludeWorkItemId)
        {
            var list = new List<EmployeeContinuityModel>();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT e."EmployeeId",
                       COALESCE(bool_or(@ParentWorkItemId::int IS NOT NULL AND wiHist."ParentWorkItemId" = @ParentWorkItemId::int), false) AS "WorkedOnProjectBefore",
                       COALESCE(bool_or(@CustomerId::int IS NOT NULL AND wiHist."CustomerId" = @CustomerId::int), false) AS "WorkedWithCustomerBefore",
                       COALESCE(bool_or(@SiteId::int IS NOT NULL AND wiHist."SiteId" = @SiteId::int), false) AS "WorkedAtSiteBefore",
                       COUNT(DISTINCT wiHist."WorkItemId") AS "TotalPriorAssignments"
                FROM "Employees" e
                LEFT JOIN "WorkEmployeeAssignments" weaHist ON weaHist."EmployeeId" = e."EmployeeId"
                LEFT JOIN "WorkItems" wiHist
                    ON wiHist."WorkItemId" = weaHist."WorkItemId"
                   AND (@ExcludeWorkItemId::int IS NULL OR wiHist."WorkItemId" <> @ExcludeWorkItemId::int)
                WHERE e."IsActive" = true AND e."IsAssignable" = true
                GROUP BY e."EmployeeId"
                ORDER BY e."EmployeeId"
                """;
            AddParam(command, "@ParentWorkItemId", parentWorkItemId);
            AddParam(command, "@CustomerId", customerId);
            AddParam(command, "@SiteId", siteId);
            AddParam(command, "@ExcludeWorkItemId", excludeWorkItemId);
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new EmployeeContinuityModel
                {
                    EmployeeId = GetInt(reader, "EmployeeId"),
                    WorkedOnProjectBefore = GetBool(reader, "WorkedOnProjectBefore"),
                    WorkedWithCustomerBefore = GetBool(reader, "WorkedWithCustomerBefore"),
                    WorkedAtSiteBefore = GetBool(reader, "WorkedAtSiteBefore"),
                    TotalPriorAssignments = GetNullableInt(reader, "TotalPriorAssignments") ?? 0
                });
            }

            return list;
        }

        // =====================================================================
        // Parameter + reader helpers
        // =====================================================================

        private static void AddParam(DbCommand command, string name, object? value)
        {
            var parameter = command.CreateParameter();
            parameter.ParameterName = name;
            parameter.Value = value ?? DBNull.Value;
            command.Parameters.Add(parameter);
        }

        private static string? GetString(DbDataReader reader, string column)
        {
            var ordinal = reader.GetOrdinal(column);
            return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
        }

        private static int GetInt(DbDataReader reader, string column) =>
            Convert.ToInt32(reader.GetValue(reader.GetOrdinal(column)));

        private static int? GetNullableInt(DbDataReader reader, string column)
        {
            var ordinal = reader.GetOrdinal(column);
            return reader.IsDBNull(ordinal) ? null : Convert.ToInt32(reader.GetValue(ordinal));
        }

        private static decimal GetDecimal(DbDataReader reader, string column) =>
            Convert.ToDecimal(reader.GetValue(reader.GetOrdinal(column)));

        private static decimal? GetNullableDecimal(DbDataReader reader, string column)
        {
            var ordinal = reader.GetOrdinal(column);
            return reader.IsDBNull(ordinal) ? null : Convert.ToDecimal(reader.GetValue(ordinal));
        }

        private static DateTime GetDateTime(DbDataReader reader, string column) =>
            Convert.ToDateTime(reader.GetValue(reader.GetOrdinal(column)));

        private static DateTime? GetNullableDateTime(DbDataReader reader, string column)
        {
            var ordinal = reader.GetOrdinal(column);
            return reader.IsDBNull(ordinal) ? null : Convert.ToDateTime(reader.GetValue(ordinal));
        }

        private static bool GetBool(DbDataReader reader, string column)
        {
            var ordinal = reader.GetOrdinal(column);
            return !reader.IsDBNull(ordinal) && Convert.ToBoolean(reader.GetValue(ordinal));
        }
    }
}

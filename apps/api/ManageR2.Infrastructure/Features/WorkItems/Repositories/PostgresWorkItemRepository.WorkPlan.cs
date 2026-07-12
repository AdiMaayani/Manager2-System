using System.Data.Common;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Features.WorkItems.Models;
using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Features.WorkItems.Repositories;

public sealed partial class PostgresWorkItemRepository
{
    // Mirrors GetWorkPlanAsync: project header (sp_GetWorkPlanProject) + tasks (sp_GetWorkPlanTasks)
    // + assignments (sp_GetWorkPlanAssignments), assembled over one connection.
    public async Task<WorkPlanResult?> GetWorkPlanAsync(int projectId)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        WorkItem? project = null;
        await using (var projectCommand = connection.CreateCommand())
        {
            projectCommand.CommandText =
                """
                SELECT wi."WorkItemId", wi."Title", wi."Description", wi."WorkType", wi."BillingType", wi."Status",
                       wi."EstimatedHours", wi."Priority", wi."PlannedStart", wi."PlannedEnd", wi."RequiredRole",
                       wi."IsLocked", wi."CustomerId", c."CustomerName", wi."SiteId", wi."CreatedAt", wi."ClosedAt",
                       wi."ParentWorkItemId"
                FROM "WorkItems" wi
                LEFT JOIN "Customers" c ON wi."CustomerId" = c."CustomerId"
                WHERE wi."WorkItemId" = @ProjectId
                """;
            AddParameter(projectCommand, "@ProjectId", projectId);
            await using var projectReader = await projectCommand.ExecuteReaderAsync();
            if (await projectReader.ReadAsync())
            {
                project = MapWorkItem(projectReader);
            }
        }

        if (project is null)
        {
            return null;
        }

        var tasks = new List<WorkItem>();
        await using (var tasksCommand = connection.CreateCommand())
        {
            tasksCommand.CommandText =
                """
                SELECT wi."WorkItemId", wi."Title", wi."Description", wi."WorkType", wi."BillingType", wi."Status",
                       wi."EstimatedHours", wi."ActualStart", wi."ActualEnd", wi."ActualHours", wi."Priority",
                       wi."PlannedStart", wi."PlannedEnd", wi."RequiredRole", wi."IsLocked", wi."CustomerId",
                       c."CustomerName", wi."SiteId", wi."CreatedAt", wi."ClosedAt", wi."ParentWorkItemId"
                FROM "WorkItems" wi
                LEFT JOIN "Customers" c ON wi."CustomerId" = c."CustomerId"
                WHERE wi."ParentWorkItemId" = @ProjectId
                ORDER BY wi."CreatedAt" DESC
                """;
            AddParameter(tasksCommand, "@ProjectId", projectId);
            await using var tasksReader = await tasksCommand.ExecuteReaderAsync();
            while (await tasksReader.ReadAsync())
            {
                tasks.Add(MapWorkItem(tasksReader));
            }
        }

        var assignments = new List<WorkPlanAssignmentResult>();
        await using (var assignmentsCommand = connection.CreateCommand())
        {
            assignmentsCommand.CommandText =
                """
                WITH "RelevantWorkItems" AS (
                    SELECT "WorkItemId" FROM "WorkItems" WHERE "WorkItemId" = @ProjectId
                    UNION
                    SELECT "WorkItemId" FROM "WorkItems" WHERE "ParentWorkItemId" = @ProjectId
                )
                SELECT wea."WorkItemId", wea."EmployeeId", CAST(NULL AS integer) AS "ContractorId",
                       CAST('Employee' AS varchar(50)) AS "AssignmentType", wea."AssignmentRole",
                       wea."AssignedHours", wea."IsManualAssignment", e."FullName" AS "EmployeeName",
                       CAST(NULL AS varchar(255)) AS "ContractorName"
                FROM "WorkEmployeeAssignments" wea
                INNER JOIN "RelevantWorkItems" rwi ON wea."WorkItemId" = rwi."WorkItemId"
                INNER JOIN "Employees" e ON wea."EmployeeId" = e."EmployeeId"
                UNION ALL
                SELECT wca."WorkItemId", CAST(NULL AS integer) AS "EmployeeId", wca."ContractorId",
                       CAST('Contractor' AS varchar(50)) AS "AssignmentType", wca."AssignmentRole",
                       CAST(NULL AS numeric(5,2)) AS "AssignedHours", CAST(false AS boolean) AS "IsManualAssignment",
                       CAST(NULL AS varchar(255)) AS "EmployeeName", c."FullName" AS "ContractorName"
                FROM "WorkContractorAssignments" wca
                INNER JOIN "RelevantWorkItems" rwi ON wca."WorkItemId" = rwi."WorkItemId"
                INNER JOIN "Contractors" c ON wca."ContractorId" = c."ContractorId"
                ORDER BY "WorkItemId"
                """;
            AddParameter(assignmentsCommand, "@ProjectId", projectId);
            await using var assignmentsReader = await assignmentsCommand.ExecuteReaderAsync();
            while (await assignmentsReader.ReadAsync())
            {
                assignments.Add(MapWorkPlanAssignment(assignmentsReader));
            }
        }

        return new WorkPlanResult { Project = project, Tasks = tasks, Assignments = assignments };
    }

    // Mirrors GetAllWorkPlansAsync: sp_GetAllProjectsForWorkPlans, then a work plan per project.
    public async Task<List<WorkPlanResult>> GetAllWorkPlansAsync()
    {
        var projects = new List<WorkItem>();
        await using (var connection = _connectionFactory.CreateConnection())
        {
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT wi."WorkItemId", wi."Title", wi."Description", wi."WorkType", wi."TaskCategory",
                       wi."BillingType", wi."Status", wi."CustomerId", c."CustomerName", wi."SiteId",
                       wi."CreatedAt", wi."ClosedAt", wi."ParentWorkItemId", wi."DealCloseDate",
                       wi."FinanceProjectNumber", wi."InvoiceNumber"
                FROM "WorkItems" wi
                LEFT JOIN "Customers" c ON wi."CustomerId" = c."CustomerId"
                WHERE wi."WorkType" = 'Project'
                  AND wi."IsArchived" = false
                  AND COALESCE(wi."FinanceProjectNumber", '') <> 'INTERNAL'
                ORDER BY wi."CreatedAt" DESC, wi."WorkItemId" DESC
                """;
            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                projects.Add(MapWorkItem(reader));
            }
        }

        var results = new List<WorkPlanResult>();
        foreach (var project in projects)
        {
            var workPlan = await GetWorkPlanAsync(project.WorkItemId);
            if (workPlan is not null)
            {
                results.Add(workPlan);
            }
        }

        return results;
    }

    // Mirrors sp_GetProjectMilestones: milestone rows shaped as work items; assignment columns are NULL,
    // so no nested employees/contractors are produced (identical to the SQL Server SP).
    public async Task<List<ProjectMilestoneResult>> GetProjectMilestonesAsync(int projectId)
    {
        var milestonesDictionary = new Dictionary<int, ProjectMilestoneResult>();
        await using var connection = _connectionFactory.CreateConnection();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT pm."ProjectMilestoneId" AS "WorkItemId", pm."Title", pm."Description",
                   'Milestone' AS "WorkType", pm."Status", CAST(NULL AS varchar(50)) AS "BillingType",
                   p."CustomerId", p."SiteId", pm."CreatedAt", pm."ProjectId" AS "ParentWorkItemId",
                   pm."PlannedStart", pm."PlannedEnd", pm."ActualEnd" AS "ClosedAt",
                   CAST(NULL AS varchar(20)) AS "Priority", CAST(NULL AS varchar(100)) AS "RequiredRole",
                   CAST(NULL AS numeric(5,2)) AS "EstimatedHours", pm."ActualStart", pm."ActualEnd",
                   CAST(NULL AS numeric(10,2)) AS "ActualHours", CAST(false AS boolean) AS "IsLocked",
                   CAST(NULL AS integer) AS "EmployeeId", CAST(NULL AS varchar(100)) AS "EmployeeName",
                   CAST(NULL AS varchar(100)) AS "AssignmentRole", CAST(NULL AS numeric(5,2)) AS "AssignedHours",
                   CAST(NULL AS boolean) AS "IsManualAssignment", CAST(NULL AS integer) AS "ContractorId",
                   CAST(NULL AS varchar(200)) AS "ContractorName", CAST(NULL AS varchar(200)) AS "ContractorAssignmentRole"
            FROM "ProjectMilestones" pm
            INNER JOIN "WorkItems" p ON p."WorkItemId" = pm."ProjectId"
            WHERE pm."ProjectId" = @ProjectId AND pm."IsActive" = true
            ORDER BY pm."SortOrder", pm."ProjectMilestoneId"
            """;
        AddParameter(command, "@ProjectId", projectId);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var workItemId = GetInt(reader, "WorkItemId");
            if (!milestonesDictionary.TryGetValue(workItemId, out var milestone))
            {
                milestone = new ProjectMilestoneResult
                {
                    WorkItemId = workItemId,
                    Title = GetString(reader, "Title") ?? string.Empty,
                    Description = GetString(reader, "Description"),
                    WorkType = GetString(reader, "WorkType") ?? string.Empty,
                    Status = GetString(reader, "Status") ?? string.Empty,
                    BillingType = GetString(reader, "BillingType"),
                    CustomerId = GetInt(reader, "CustomerId"),
                    SiteId = GetNullableInt(reader, "SiteId"),
                    CreatedAt = GetDateTime(reader, "CreatedAt") ?? DateTime.MinValue,
                    PlannedStart = GetDateTime(reader, "PlannedStart"),
                    PlannedEnd = GetDateTime(reader, "PlannedEnd"),
                    ClosedAt = GetDateTime(reader, "ClosedAt"),
                    Priority = GetString(reader, "Priority"),
                    RequiredRole = GetString(reader, "RequiredRole"),
                    EstimatedHours = GetNullableDecimal(reader, "EstimatedHours"),
                    ActualStart = GetDateTime(reader, "ActualStart"),
                    ActualEnd = GetDateTime(reader, "ActualEnd"),
                    ActualHours = GetNullableDecimal(reader, "ActualHours"),
                    IsLocked = GetBool(reader, "IsLocked")
                };
                milestonesDictionary.Add(workItemId, milestone);
            }

            var employeeId = GetNullableInt(reader, "EmployeeId");
            if (employeeId is > 0 && milestone.Employees.All(e => e.EmployeeId != employeeId.Value))
            {
                milestone.Employees.Add(new ProjectMilestoneEmployeeAssignmentResult
                {
                    EmployeeId = employeeId.Value,
                    EmployeeName = GetString(reader, "EmployeeName") ?? string.Empty,
                    AssignmentRole = GetString(reader, "AssignmentRole"),
                    AssignedHours = GetNullableDecimal(reader, "AssignedHours"),
                    IsManualAssignment = GetNullableBool(reader, "IsManualAssignment")
                });
            }

            var contractorId = GetNullableInt(reader, "ContractorId");
            if (contractorId is > 0 && milestone.Contractors.All(c => c.ContractorId != contractorId.Value))
            {
                milestone.Contractors.Add(new ProjectMilestoneContractorAssignmentResult
                {
                    ContractorId = contractorId.Value,
                    ContractorName = GetString(reader, "ContractorName") ?? string.Empty,
                    AssignmentRole = GetString(reader, "ContractorAssignmentRole")
                });
            }
        }

        return milestonesDictionary.Values.ToList();
    }

    // Mirrors sp_GetWorkPlanSchedule (4 result sets: scheduled, unscheduled, assignments, employees).
    public async Task<WorkPlanScheduleResult> GetWorkPlanScheduleAsync(WorkPlanScheduleQuery query)
    {
        ValidateScheduleQuery(query);

        var result = new WorkPlanScheduleResult();
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        await using (var scheduledCommand = connection.CreateCommand())
        {
            scheduledCommand.CommandText = ScheduledTasksSql;
            AddScheduleParameters(scheduledCommand, query);
            await using var reader = await scheduledCommand.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                result.ScheduledTasks.Add(MapScheduledTask(reader));
            }
        }

        await using (var unscheduledCommand = connection.CreateCommand())
        {
            unscheduledCommand.CommandText = UnscheduledTasksSql;
            AddScheduleParameters(unscheduledCommand, query);
            await using var reader = await unscheduledCommand.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                result.UnscheduledTasks.Add(MapScheduledTask(reader));
            }
        }

        await using (var assignmentsCommand = connection.CreateCommand())
        {
            assignmentsCommand.CommandText = ScheduleAssignmentsSql;
            AddScheduleParameters(assignmentsCommand, query);
            await using var reader = await assignmentsCommand.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                result.Assignments.Add(new WorkPlanAssignmentResult
                {
                    WorkItemId = GetInt(reader, "WorkItemId"),
                    EmployeeId = GetNullableInt(reader, "EmployeeId"),
                    AssignmentRole = GetString(reader, "AssignmentRole"),
                    AssignedHours = GetNullableDecimal(reader, "AssignedHours"),
                    IsManualAssignment = GetBool(reader, "IsManualAssignment"),
                    EmployeeName = GetString(reader, "EmployeeName"),
                    AssignmentType = "Employee",
                    AssignmentSource = GetString(reader, "AssignmentSource")
                });
            }
        }

        await using (var employeesCommand = connection.CreateCommand())
        {
            employeesCommand.CommandText =
                """
                SELECT "EmployeeId", "FullName", "PrimaryRole", "IsActive", "IsAssignable"
                FROM "Employees" WHERE "IsActive" = true ORDER BY "FullName"
                """;
            await using var reader = await employeesCommand.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                result.Employees.Add(new WorkPlanEmployeeResult
                {
                    EmployeeId = GetInt(reader, "EmployeeId"),
                    FullName = GetString(reader, "FullName") ?? string.Empty,
                    PrimaryRole = GetString(reader, "PrimaryRole"),
                    IsActive = GetBool(reader, "IsActive"),
                    IsAssignable = GetBool(reader, "IsAssignable")
                });
            }
        }

        return result;
    }

    private static void ValidateScheduleQuery(WorkPlanScheduleQuery query)
    {
        if (query.Scope is not ("company" or "personal" or "employee" or "project"))
        {
            throw new InvalidOperationException("Invalid schedule scope.");
        }

        if (query.Scope == "project" && query.ProjectId is null)
        {
            throw new InvalidOperationException("Project scope requires ProjectId.");
        }

        if (query.Scope == "employee" && query.EmployeeId is null)
        {
            throw new InvalidOperationException("Employee scope requires EmployeeId.");
        }

        if (query.Scope == "personal" && query.CurrentUserEmployeeId is null)
        {
            throw new InvalidOperationException("Personal scope requires CurrentUserEmployeeId.");
        }

        if (query.TaskCategory is not null &&
            query.TaskCategory is not ("Regular" or "Project" or "ServiceCall"))
        {
            throw new InvalidOperationException("Invalid TaskCategory filter.");
        }

        if ((query.FromUtc is null) != (query.ToUtc is null))
        {
            throw new InvalidOperationException("fromUtc and toUtc must both be supplied or both be null.");
        }

        if (query.FromUtc is not null && query.ToUtc <= query.FromUtc)
        {
            throw new InvalidOperationException("Invalid UTC range.");
        }
    }

    private static void AddScheduleParameters(DbCommand command, WorkPlanScheduleQuery query)
    {
        AddParameter(command, "@Scope", query.Scope);
        AddParameter(command, "@ProjectId", (object?)query.ProjectId ?? DBNull.Value);
        AddParameter(command, "@EmployeeId", (object?)query.EmployeeId ?? DBNull.Value);
        AddParameter(command, "@Status", (object?)query.Status ?? DBNull.Value);
        AddParameter(command, "@TaskCategory", (object?)query.TaskCategory ?? DBNull.Value);
        AddParameter(command, "@FromUtc", (object?)query.FromUtc ?? DBNull.Value);
        AddParameter(command, "@ToUtc", (object?)query.ToUtc ?? DBNull.Value);
        AddParameter(command, "@IncludeUnscheduled", query.IncludeUnscheduled);
        AddParameter(command, "@CurrentUserEmployeeId", (object?)query.CurrentUserEmployeeId ?? DBNull.Value);
    }

    // Shared eligibility predicate for the scheduled/unscheduled/assignment result sets.
    // Casts on nullable parameters are required so Npgsql/Postgres can resolve the type of a NULL
    // parameter used in a bare IS NULL / CASE (otherwise "could not determine data type of parameter").
    private const string EligibleFilter =
        """
        wi."IsArchived" = false AND wi."TaskCategory" IN ('Regular', 'Project', 'ServiceCall')
        AND (@Status::text IS NULL OR wi."Status" = @Status)
        AND (@TaskCategory::text IS NULL OR wi."TaskCategory" = @TaskCategory)
        AND (@Scope <> 'project' OR (wi."TaskCategory" = 'Project' AND wi."ParentWorkItemId" = @ProjectId::int))
        AND (@Scope NOT IN ('personal', 'employee') OR EXISTS (
            SELECT 1 FROM "WorkEmployeeAssignments" a
            WHERE a."WorkItemId" = wi."WorkItemId"
              AND a."EmployeeId" = CASE WHEN @Scope = 'personal' THEN @CurrentUserEmployeeId::int ELSE @EmployeeId::int END))
        """;

    private const string EligibleProjection =
        """
        SELECT wi."WorkItemId", wi."Title", wi."Description", wi."TaskCategory", wi."WorkType", wi."Status",
               wi."Priority", wi."PlannedStart", wi."PlannedEnd", wi."EstimatedHours", wi."IsLocked",
               wi."CustomerId", c."CustomerName", wi."SiteId", s."SiteName",
               wi."ParentWorkItemId" AS "ProjectId", p."Title" AS "ProjectTitle",
               wi."MilestoneId", m."Title" AS "MilestoneTitle"
        FROM "WorkItems" wi
        LEFT JOIN "Customers" c ON c."CustomerId" = wi."CustomerId"
        LEFT JOIN "Sites" s ON s."SiteId" = wi."SiteId"
        LEFT JOIN "WorkItems" p ON p."WorkItemId" = wi."ParentWorkItemId"
        LEFT JOIN "ProjectMilestones" m ON m."ProjectMilestoneId" = wi."MilestoneId"
        """;

    private static readonly string ScheduledTasksSql =
        $"""
        WITH "Eligible" AS (
            {EligibleProjection}
            WHERE {EligibleFilter}
        )
        SELECT *,
               (EXTRACT(EPOCH FROM ("PlannedEnd" - "PlannedStart")) / 60)::int AS "DerivedDurationMinutes",
               ("WorkType" = 'ServiceCall') AS "IsServiceCall"
        FROM "Eligible"
        WHERE "PlannedStart" IS NOT NULL AND "PlannedEnd" > "PlannedStart"
          AND (@FromUtc::timestamp IS NULL OR "PlannedStart" < @ToUtc)
          AND (@ToUtc::timestamp IS NULL OR "PlannedEnd" > @FromUtc)
        ORDER BY "PlannedStart", "WorkItemId"
        """;

    private static readonly string UnscheduledTasksSql =
        $"""
        WITH "Eligible" AS (
            {EligibleProjection}
            WHERE @IncludeUnscheduled = true AND {EligibleFilter}
        )
        SELECT *, CAST(NULL AS integer) AS "DerivedDurationMinutes",
               ("WorkType" = 'ServiceCall') AS "IsServiceCall"
        FROM "Eligible"
        WHERE "PlannedStart" IS NULL OR "PlannedEnd" IS NULL OR "PlannedEnd" <= "PlannedStart"
        ORDER BY "WorkItemId"
        """;

    private static readonly string ScheduleAssignmentsSql =
        $"""
        SELECT a."WorkItemId", a."EmployeeId", e."FullName" AS "EmployeeName", a."AssignmentRole",
               a."AssignedHours", a."IsManualAssignment", 'Task' AS "AssignmentSource"
        FROM "WorkEmployeeAssignments" a
        JOIN "Employees" e ON e."EmployeeId" = a."EmployeeId"
        JOIN "WorkItems" wi ON wi."WorkItemId" = a."WorkItemId"
        WHERE wi."IsArchived" = false AND wi."TaskCategory" IN ('Regular', 'Project', 'ServiceCall')
          AND (@Status::text IS NULL OR wi."Status" = @Status)
          AND (@TaskCategory::text IS NULL OR wi."TaskCategory" = @TaskCategory)
          AND (@Scope <> 'project' OR (wi."TaskCategory" = 'Project' AND wi."ParentWorkItemId" = @ProjectId::int))
          AND (@Scope NOT IN ('personal', 'employee') OR EXISTS (
              SELECT 1 FROM "WorkEmployeeAssignments" sx
              WHERE sx."WorkItemId" = wi."WorkItemId"
                AND sx."EmployeeId" = CASE WHEN @Scope = 'personal' THEN @CurrentUserEmployeeId::int ELSE @EmployeeId::int END))
          AND ((wi."PlannedStart" IS NOT NULL AND wi."PlannedEnd" > wi."PlannedStart"
                AND (@FromUtc::timestamp IS NULL OR wi."PlannedStart" < @ToUtc)
                AND (@ToUtc::timestamp IS NULL OR wi."PlannedEnd" > @FromUtc))
               OR (@IncludeUnscheduled = true
                   AND (wi."PlannedStart" IS NULL OR wi."PlannedEnd" IS NULL OR wi."PlannedEnd" <= wi."PlannedStart")))
        """;

    private static WorkPlanScheduledTaskResult MapScheduledTask(DbDataReader reader)
    {
        return new WorkPlanScheduledTaskResult
        {
            WorkItemId = GetInt(reader, "WorkItemId"),
            Title = GetString(reader, "Title") ?? string.Empty,
            Description = GetString(reader, "Description"),
            WorkType = GetString(reader, "WorkType"),
            TaskCategory = GetString(reader, "TaskCategory"),
            Status = GetString(reader, "Status"),
            Priority = GetString(reader, "Priority"),
            PlannedStart = GetDateTime(reader, "PlannedStart"),
            PlannedEnd = GetDateTime(reader, "PlannedEnd"),
            DerivedDurationMinutes = GetNullableInt(reader, "DerivedDurationMinutes"),
            EstimatedHours = GetNullableDecimal(reader, "EstimatedHours"),
            IsLocked = GetBool(reader, "IsLocked"),
            CustomerId = GetNullableInt(reader, "CustomerId"),
            CustomerName = GetString(reader, "CustomerName"),
            SiteId = GetNullableInt(reader, "SiteId"),
            SiteName = GetString(reader, "SiteName"),
            ProjectId = GetNullableInt(reader, "ProjectId"),
            ProjectTitle = GetString(reader, "ProjectTitle"),
            MilestoneId = GetNullableInt(reader, "MilestoneId"),
            MilestoneTitle = GetString(reader, "MilestoneTitle"),
            IsServiceCall = GetBool(reader, "IsServiceCall")
        };
    }
}

using System.Data; // מאפשר להשתמש ב-CommandType.StoredProcedure
using Microsoft.Data.SqlClient; // מאפשר עבודה מול SQL Server
using ManageR2.Infrastructure.DAL; // מאפשר להשתמש ב-DBServices
using ManageR2.Infrastructure.Models.SmartAssignment; // מאפשר להשתמש במודלים של SmartAssignment

namespace ManageR2.Infrastructure.Repositories.SmartAssignment
{
    // English: loads algorithm input only—Rec_GetTaskRecommendationInput multi-result → TaskRecommendationInputModel (no scoring here).
    // Repository = שכבה שתפקידה לדבר עם בסיס הנתונים בלבד
    // כאן לא מחשבים ציונים
    // כאן לא מדרגים עובדים
    // כאן רק קוראים ל-Stored Procedure וממפים תוצאות לאובייקטים
    public class SmartAssignmentRepository
    {
        // DBServices היא המחלקה הקיימת אצלכם שיודעת ליצור חיבור ל-DB
        private readonly DBServices _db;

        // Constructor - מקבל DBServices מבחוץ ושומר אותו לשימוש במחלקה
        public SmartAssignmentRepository(DBServices db)
        {
            _db = db;
        }

        // פעולה זו מביאה את כל הקלט הדרוש לאלגוריתם עבור משימה מסוימת
        // היא קוראת ל-SP המאוחד: Rec_GetTaskRecommendationInput
        // ה-SP מחזיר כמה Result Sets, וכל אחד מהם נכנס למודל המתאים
        // English: one SP call hydrates TaskRecommendationInputModel lists consumed by SmartAssignmentService scoring.
        public async Task<TaskRecommendationInputModel> GetTaskRecommendationInputAsync(int workItemId)
        {
            using var connection = _db.CreateConnection();
            using var command = new SqlCommand("Rec_GetTaskRecommendationInput", connection);
            command.CommandType = CommandType.StoredProcedure;
            command.Parameters.AddWithValue("@WorkItemId", workItemId);

            await connection.OpenAsync();
            using var reader = await command.ExecuteReaderAsync();
            return await MapInputAsync(reader);
        }

        // English: New Task draft path — same 12 result sets via Rec_GetDraftTaskRecommendationInput,
        // built from the draft context (project/date/site) rather than a saved work item.
        public async Task<TaskRecommendationInputModel> GetDraftTaskRecommendationInputAsync(
            DraftTaskRecommendationContextModel context)
        {
            using var connection = _db.CreateConnection();
            using var command = new SqlCommand("Rec_GetDraftTaskRecommendationInput", connection);
            command.CommandType = CommandType.StoredProcedure;
            command.Parameters.AddWithValue("@ProjectId", context.ProjectId);
            command.Parameters.AddWithValue("@PlannedStart", context.PlannedStart);
            command.Parameters.AddWithValue("@PlannedEnd", context.PlannedEnd);
            command.Parameters.AddWithValue("@EstimatedHours", (object?)context.EstimatedHours ?? DBNull.Value);
            command.Parameters.AddWithValue("@Priority", (object?)context.Priority ?? DBNull.Value);
            command.Parameters.AddWithValue("@RequiredRole", (object?)context.RequiredRole ?? DBNull.Value);
            command.Parameters.AddWithValue("@SiteId", (object?)context.SiteId ?? DBNull.Value);

            await connection.OpenAsync();
            using var reader = await command.ExecuteReaderAsync();
            return await MapInputAsync(reader);
        }

        // English: shared mapping of the 12 recommendation-input result sets into the unified model.
        private async Task<TaskRecommendationInputModel> MapInputAsync(SqlDataReader reader)
        {
            var result = new TaskRecommendationInputModel();

            // =====================================================
            // Result Set 1 - נתוני המשימה
            // =====================================================
            // צפויה בדרך כלל שורה אחת בלבד
            if (await reader.ReadAsync())
            {
                result.Task = new TaskCoreDataModel
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

            // מעבר ל-Result Set הבא
            await reader.NextResultAsync();

            // =====================================================
            // Result Set 2 - כישורים נדרשים למשימה
            // =====================================================
            while (await reader.ReadAsync())
            {
                result.RequiredSkills.Add(new RequiredSkillModel
                {
                    WorkItemId = GetInt(reader, "WorkItemId"),
                    SkillId = GetInt(reader, "SkillId"),
                    SkillName = GetString(reader, "SkillName"),
                    SkillCategory = GetString(reader, "SkillCategory"),
                    RequiredLevel = GetNullableInt(reader, "RequiredLevel") ?? 0,
                    ImportanceLevel = GetString(reader, "ImportanceLevel")
                });
            }

            await reader.NextResultAsync();

            // =====================================================
            // Result Set 3 - עובדים מועמדים
            // =====================================================
            while (await reader.ReadAsync())
            {
                result.Employees.Add(new EmployeeCandidateModel
                {
                    EmployeeId = GetInt(reader, "EmployeeId"),
                    FullName = GetString(reader, "FullName"),
                    PrimaryRole = GetString(reader, "PrimaryRole"),
                    IsActive = GetBool(reader, "IsActive"),
                    IsAssignable = GetBool(reader, "IsAssignable"),
                    DailyCapacityHours = GetNullableDecimal(reader, "DailyCapacityHours")
                });
            }

            await reader.NextResultAsync();

            // =====================================================
            // Result Set 4 - כישורי עובדים
            // =====================================================
            while (await reader.ReadAsync())
            {
                result.EmployeeSkills.Add(new EmployeeSkillModel
                {
                    EmployeeId = GetInt(reader, "EmployeeId"),
                    SkillId = GetInt(reader, "SkillId"),
                    SkillName = GetString(reader, "SkillName"),
                    SkillLevel = GetInt(reader, "SkillLevel"),
                    YearsExperience = GetNullableDecimal(reader, "YearsExperience"),
                    IsCertified = GetBool(reader, "IsCertified")
                });
            }

            await reader.NextResultAsync();

            // =====================================================
            // Result Set 5 - זמינות עובדים
            // =====================================================
            while (await reader.ReadAsync())
            {
                result.EmployeeAvailability.Add(new EmployeeAvailabilityModel
                {
                    EmployeeId = GetInt(reader, "EmployeeId"),
                    AvailableFrom = GetDateTime(reader, "AvailableFrom"),
                    AvailableTo = GetDateTime(reader, "AvailableTo"),
                    AvailabilityType = GetString(reader, "AvailabilityType"),
                    Source = GetString(reader, "Source")
                });
            }

            await reader.NextResultAsync();

            // =====================================================
            // Result Set 6 - קיבולת עובדים
            // =====================================================
            while (await reader.ReadAsync())
            {
                result.EmployeeCapacities.Add(new EmployeeCapacityModel
                {
                    EmployeeId = GetInt(reader, "EmployeeId"),
                    WeeklyCapacityHours = GetDecimal(reader, "WeeklyCapacityHours"),
                    EffectiveFrom = GetDateTime(reader, "EffectiveFrom"),
                    EffectiveTo = GetNullableDateTime(reader, "EffectiveTo")
                });
            }

            await reader.NextResultAsync();

            // =====================================================
            // Result Set 7 - כתובות בסיס של עובדים
            // =====================================================
            while (await reader.ReadAsync())
            {
                result.EmployeeBaseAddresses.Add(new EmployeeBaseAddressModel
                {
                    EmployeeId = GetInt(reader, "EmployeeId"),
                    FormattedAddress = GetString(reader, "FormattedAddress"),
                    City = GetString(reader, "City"),
                    ZoneId = GetNullableInt(reader, "ZoneId")
                });
            }

            await reader.NextResultAsync();

            // =====================================================
            // Result Set 8 - כתובת אתר המשימה
            // =====================================================
            // צפויה בדרך כלל שורה אחת בלבד
            if (await reader.ReadAsync())
            {
                result.SiteAddress = new SiteAddressModel
                {
                    SiteId = GetInt(reader, "SiteId"),
                    FormattedAddress = GetString(reader, "FormattedAddress"),
                    City = GetString(reader, "City"),
                    ZoneId = GetNullableInt(reader, "ZoneId")
                };
            }

            await reader.NextResultAsync();

            // =====================================================
            // Result Set 9 - אזורי עבודה של עובדים
            // =====================================================
            while (await reader.ReadAsync())
            {
                result.EmployeeWorkZones.Add(new EmployeeWorkZoneModel
                {
                    EmployeeId = GetInt(reader, "EmployeeId"),
                    ZoneId = GetInt(reader, "ZoneId"),
                    IsPrimary = GetBool(reader, "IsPrimary")
                });
            }

            await reader.NextResultAsync();

            // =====================================================
            // Result Set 10 - תחנות מתוכננות
            // =====================================================
            while (await reader.ReadAsync())
            {
                result.PlannedStops.Add(new EmployeePlannedStopModel
                {
                    EmployeeId = GetInt(reader, "EmployeeId"),
                    SiteId = GetNullableInt(reader, "SiteId"),
                    PlannedStartAt = GetNullableDateTime(reader, "PlannedStartAt"),
                    PlannedEndAt = GetNullableDateTime(reader, "PlannedEndAt"),
                    FormattedAddress = GetString(reader, "FormattedAddress")
                });
            }

            await reader.NextResultAsync();

            // =====================================================
            // Result Set 11 - אירועי מיקום
            // =====================================================
            while (await reader.ReadAsync())
            {
                result.LocationEvents.Add(new EmployeeLocationEventModel
                {
                    EmployeeId = GetInt(reader, "EmployeeId"),
                    FormattedAddress = GetString(reader, "FormattedAddress"),
                    EventTime = GetDateTime(reader, "EventTime")
                });
            }

            await reader.NextResultAsync();

            // =====================================================
            // Result Set 12 - זמני נסיעה / Route Estimates
            // =====================================================
            while (await reader.ReadAsync())
            {
                result.RouteEstimates.Add(new RouteEstimateModel
                {
                    EmployeeId = GetInt(reader, "EmployeeId"),
                    TargetSiteId = GetInt(reader, "TargetSiteId"),
                    OriginType = GetString(reader, "OriginType"),
                    EstimatedDistanceKm = GetNullableDecimal(reader, "EstimatedDistanceKm"),
                    EstimatedTravelMinutes = GetNullableInt(reader, "EstimatedTravelMinutes")
                });
            }

            // =====================================================
            // Result Set 13 - עומס נוכחי (שיבוצים פתוחים ושעות) ביום המשימה
            // Additive result set. When running against a DB that has not yet applied the
            // factor-activation migration, NextResultAsync simply returns false and the list stays empty.
            // =====================================================
            if (await reader.NextResultAsync())
            {
                while (await reader.ReadAsync())
                {
                    result.EmployeeCurrentLoads.Add(new EmployeeCurrentLoadModel
                    {
                        EmployeeId = GetInt(reader, "EmployeeId"),
                        OpenAssignmentsCount = GetNullableInt(reader, "OpenAssignmentsCount") ?? 0,
                        CurrentAssignedHours = GetNullableDecimal(reader, "CurrentAssignedHours") ?? 0m
                    });
                }
            }

            // =====================================================
            // Result Set 14 - רציפות (עבודה קודמת מול פרויקט / לקוח / אתר)
            // =====================================================
            if (await reader.NextResultAsync())
            {
                while (await reader.ReadAsync())
                {
                    result.EmployeeContinuities.Add(new EmployeeContinuityModel
                    {
                        EmployeeId = GetInt(reader, "EmployeeId"),
                        WorkedOnProjectBefore = GetBool(reader, "WorkedOnProjectBefore"),
                        WorkedWithCustomerBefore = GetBool(reader, "WorkedWithCustomerBefore"),
                        WorkedAtSiteBefore = GetBool(reader, "WorkedAtSiteBefore"),
                        TotalPriorAssignments = GetNullableInt(reader, "TotalPriorAssignments") ?? 0
                    });
                }
            }

            // בסוף מחזירים את כל הקלט המאוחד לאלגוריתם
            return result;
        }

        // =====================================================
        // Persistence (saveRun) — uses the existing Rec_ persistence procedures.
        // =====================================================

        // Creates a recommendation run header and returns its id (via OUTPUT parameter).
        public async Task<int> CreateRecommendationRunAsync(
            string scopeType,
            int? projectId,
            int? taskId,
            int? requestedByUserId,
            string algorithmVersion,
            string? inputSnapshotJson)
        {
            using var connection = _db.CreateConnection();
            using var command = new SqlCommand("Rec_CreateRecommendationRun", connection);
            command.CommandType = CommandType.StoredProcedure;

            command.Parameters.AddWithValue("@ScopeType", scopeType);
            command.Parameters.AddWithValue("@ProjectId", (object?)projectId ?? DBNull.Value);
            command.Parameters.AddWithValue("@TaskId", (object?)taskId ?? DBNull.Value);
            command.Parameters.AddWithValue("@RequestedByUserId", (object?)requestedByUserId ?? DBNull.Value);
            command.Parameters.AddWithValue(
                "@AlgorithmVersion",
                string.IsNullOrWhiteSpace(algorithmVersion) ? "1.0" : algorithmVersion);
            command.Parameters.AddWithValue("@InputSnapshotJson", (object?)inputSnapshotJson ?? DBNull.Value);

            var output = new SqlParameter("@RecommendationRunId", SqlDbType.Int)
            {
                Direction = ParameterDirection.Output
            };
            command.Parameters.Add(output);

            await connection.OpenAsync();
            await command.ExecuteNonQueryAsync();

            return output.Value == DBNull.Value ? 0 : Convert.ToInt32(output.Value);
        }

        // Persists one ranked candidate row for a task within a run.
        public async Task SaveTaskAssignmentRecommendationAsync(int runId, int taskId, EmployeeCandidateModel candidate)
        {
            using var connection = _db.CreateConnection();
            using var command = new SqlCommand("Rec_SaveTaskAssignmentRecommendation", connection);
            command.CommandType = CommandType.StoredProcedure;

            command.Parameters.AddWithValue("@RecommendationRunId", runId);
            command.Parameters.AddWithValue("@TaskId", taskId);
            command.Parameters.AddWithValue("@EmployeeId", candidate.EmployeeId);
            command.Parameters.AddWithValue("@UrgencyClass", DBNull.Value);
            command.Parameters.AddWithValue("@OriginTypeUsed", (object?)candidate.OriginTypeUsed ?? DBNull.Value);
            command.Parameters.AddWithValue("@RankOrder", candidate.RankOrder ?? 0);
            command.Parameters.AddWithValue("@TotalScore", candidate.TotalScore ?? 0m);
            command.Parameters.AddWithValue("@ProfessionalScore", (object?)candidate.ProfessionalScore ?? DBNull.Value);
            command.Parameters.AddWithValue("@AvailabilityScore", (object?)candidate.AvailabilityScore ?? DBNull.Value);
            command.Parameters.AddWithValue("@WorkloadScore", (object?)candidate.WorkloadScore ?? DBNull.Value);
            command.Parameters.AddWithValue("@ExperienceScore", (object?)candidate.ExperienceScore ?? DBNull.Value);
            command.Parameters.AddWithValue("@GeographicScore", (object?)candidate.GeographicScore ?? DBNull.Value);
            command.Parameters.AddWithValue("@ContinuityScore", (object?)candidate.ContinuityScore ?? DBNull.Value);
            command.Parameters.AddWithValue("@DistanceKm", (object?)candidate.DistanceKm ?? DBNull.Value);
            command.Parameters.AddWithValue("@TravelMinutes", (object?)candidate.TravelMinutes ?? DBNull.Value);
            command.Parameters.AddWithValue("@MatchedSkillsCount", (object?)candidate.MatchedSkillsCount ?? DBNull.Value);
            command.Parameters.AddWithValue("@MissingSkillsCount", (object?)candidate.MissingSkillsCount ?? DBNull.Value);
            command.Parameters.AddWithValue("@OpenAssignmentsCount", (object?)candidate.OpenAssignmentsCount ?? DBNull.Value);
            command.Parameters.AddWithValue("@CurrentWorkloadHours", (object?)candidate.CurrentWorkloadHours ?? DBNull.Value);
            command.Parameters.AddWithValue("@ZoneMatch", DBNull.Value);
            command.Parameters.AddWithValue("@WorkedWithCustomerBefore", (object?)candidate.WorkedWithCustomerBefore ?? DBNull.Value);
            command.Parameters.AddWithValue("@WorkedAtSiteBefore", (object?)candidate.WorkedAtSiteBefore ?? DBNull.Value);
            command.Parameters.AddWithValue("@RecommendationSummary", (object?)candidate.RecommendationSummary ?? DBNull.Value);
            command.Parameters.AddWithValue("@WarningsJson", (object?)candidate.WarningsJson ?? DBNull.Value);

            await connection.OpenAsync();
            await command.ExecuteNonQueryAsync();
        }

        // =====================================================
        // Helper Methods
        // פונקציות עזר לקריאה בטוחה מה-SqlDataReader
        // =====================================================

        // קורא טקסט מה-reader
        // אם הערך ב-DB הוא NULL, מחזיר null
        private static string? GetString(SqlDataReader reader, string columnName)
        {
            return reader[columnName] == DBNull.Value
                ? null
                : reader[columnName].ToString();
        }

        // קורא int רגיל
        // מתאים לשדות שחייבים להיות מלאים
        private static int GetInt(SqlDataReader reader, string columnName)
        {
            return Convert.ToInt32(reader[columnName]);
        }

        // קורא int שיכול להיות NULL
        private static int? GetNullableInt(SqlDataReader reader, string columnName)
        {
            return reader[columnName] == DBNull.Value
                ? null
                : Convert.ToInt32(reader[columnName]);
        }

        // קורא decimal רגיל
        // מתאים לשדות שחייבים להיות מלאים
        private static decimal GetDecimal(SqlDataReader reader, string columnName)
        {
            return Convert.ToDecimal(reader[columnName]);
        }

        // קורא decimal שיכול להיות NULL
        private static decimal? GetNullableDecimal(SqlDataReader reader, string columnName)
        {
            return reader[columnName] == DBNull.Value
                ? null
                : Convert.ToDecimal(reader[columnName]);
        }

        // קורא DateTime רגיל
        // מתאים לשדות שחייבים להיות מלאים
        private static DateTime GetDateTime(SqlDataReader reader, string columnName)
        {
            return Convert.ToDateTime(reader[columnName]);
        }

        // קורא DateTime שיכול להיות NULL
        private static DateTime? GetNullableDateTime(SqlDataReader reader, string columnName)
        {
            return reader[columnName] == DBNull.Value
                ? null
                : Convert.ToDateTime(reader[columnName]);
        }

        // קורא bool
        // ב-SQL זה בדרך כלל bit:
        // 1 = true
        // 0 = false
        private static bool GetBool(SqlDataReader reader, string columnName)
        {
            return reader[columnName] != DBNull.Value && Convert.ToBoolean(reader[columnName]);
        }
    }
}
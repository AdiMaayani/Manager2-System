using System.Data;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Models;
using Microsoft.Data.SqlClient;

namespace ManageR2.Infrastructure.Repositories;

// Repository implementation that isolates lifecycle DB access from API/controller layers.
public class ProjectLifecycleRepository : IProjectLifecycleRepository
{
    private readonly DBServices _dbServices;

    public ProjectLifecycleRepository(DBServices dbServices)
    {
        _dbServices = dbServices;
    }

    public async Task<ProjectLifecycleModel?> GetProjectLifecycleAsync(int projectId)
    {
        await using var connection = _dbServices.CreateConnection();
        await connection.OpenAsync();

        // Uses one stored procedure to fetch the full lifecycle as multiple ordered result sets.
        await using var command = new SqlCommand("dbo.sp_GetProjectLifecycle", connection)
        {
            CommandType = CommandType.StoredProcedure
        };
        command.Parameters.AddWithValue("@ProjectId", projectId);

        await using var reader = await command.ExecuteReaderAsync();

        if (!await reader.ReadAsync())
        {
            // First result set is project header; no row means project was not found.
            return null;
        }

        // Result set 1: project.
        var project = MapProject(reader);
        // Result set containers for lifecycle sections.
        var milestones = new List<ProjectLifecycleMilestoneModel>();
        var assignments = new List<ProjectLifecycleAssignmentModel>();
        var reports = new List<ProjectLifecycleReportModel>();
        var summary = new ProjectLifecycleSummaryModel();

        // Result set 2: milestones.
        if (await reader.NextResultAsync())
        {
            while (await reader.ReadAsync())
            {
                milestones.Add(MapMilestone(reader));
            }
        }

        // Result set 3: assignments.
        if (await reader.NextResultAsync())
        {
            while (await reader.ReadAsync())
            {
                assignments.Add(MapAssignment(reader));
            }
        }

        // Result set 4: reports.
        if (await reader.NextResultAsync())
        {
            while (await reader.ReadAsync())
            {
                reports.Add(MapReport(reader));
            }
        }

        // Result set 5: single summary row with progress, risk, and health indicators.
        if (await reader.NextResultAsync() && await reader.ReadAsync())
        {
            summary = MapSummary(reader);
        }

        // Combines all mapped sections into one domain model for API mapping.
        return new ProjectLifecycleModel
        {
            Project = project,
            Milestones = milestones,
            Assignments = assignments,
            Reports = reports,
            Summary = summary
        };
    }

    private static ProjectLifecycleProjectModel MapProject(SqlDataReader reader)
    {
        // Maps project columns from DB to infrastructure model.
        return new ProjectLifecycleProjectModel
        {
            WorkItemId = Convert.ToInt32(reader["WorkItemId"]),
            Title = reader["Title"]?.ToString() ?? string.Empty,
            Description = GetStringOrNull(reader, "Description"),
            Status = reader["Status"]?.ToString() ?? string.Empty,
            BillingType = GetStringOrNull(reader, "BillingType"),
            CustomerId = reader["CustomerId"] != DBNull.Value ? Convert.ToInt32(reader["CustomerId"]) : 0,
            CustomerName = GetStringOrNull(reader, "CustomerName"),
            SiteId = reader["SiteId"] != DBNull.Value ? Convert.ToInt32(reader["SiteId"]) : null,
            SiteName = GetStringOrNull(reader, "SiteName"),
            CreatedAt = reader["CreatedAt"] != DBNull.Value ? Convert.ToDateTime(reader["CreatedAt"]) : DateTime.MinValue,
            ClosedAt = GetDateTimeOrNull(reader, "ClosedAt"),
            DealCloseDate = GetDateTimeOrNull(reader, "DealCloseDate"),
            FinanceProjectNumber = GetStringOrNull(reader, "FinanceProjectNumber"),
            InvoiceNumber = GetStringOrNull(reader, "InvoiceNumber")
        };
    }

    private static ProjectLifecycleMilestoneModel MapMilestone(SqlDataReader reader)
    {
        // Maps milestone columns from DB to infrastructure model.
        return new ProjectLifecycleMilestoneModel
        {
            WorkItemId = reader["WorkItemId"] != DBNull.Value ? Convert.ToInt32(reader["WorkItemId"]) : 0,
            Title = reader["Title"]?.ToString() ?? string.Empty,
            Description = GetStringOrNull(reader, "Description"),
            Status = reader["Status"]?.ToString() ?? string.Empty,
            BillingType = GetStringOrNull(reader, "BillingType"),
            CreatedAt = reader["CreatedAt"] != DBNull.Value ? Convert.ToDateTime(reader["CreatedAt"]) : DateTime.MinValue,
            PlannedStart = GetDateTimeOrNull(reader, "PlannedStart"),
            PlannedEnd = GetDateTimeOrNull(reader, "PlannedEnd"),
            ClosedAt = GetDateTimeOrNull(reader, "ClosedAt"),
            EstimatedHours = GetDecimalOrNull(reader, "EstimatedHours"),
            Priority = GetStringOrNull(reader, "Priority"),
            RequiredRole = GetStringOrNull(reader, "RequiredRole"),
            IsLocked = reader["IsLocked"] != DBNull.Value && Convert.ToBoolean(reader["IsLocked"])
        };
    }

    private static ProjectLifecycleAssignmentModel MapAssignment(SqlDataReader reader)
    {
        // AssignmentType fallback avoids null string values in downstream layers.
        var assignmentType = GetStringOrNull(reader, "AssignmentType") ?? string.Empty;

        // Maps assignment columns from DB to infrastructure model.
        return new ProjectLifecycleAssignmentModel
        {
            WorkItemId = reader["WorkItemId"] != DBNull.Value ? Convert.ToInt32(reader["WorkItemId"]) : 0,
            EmployeeId = reader["EmployeeId"] != DBNull.Value ? Convert.ToInt32(reader["EmployeeId"]) : null,
            ContractorId = reader["ContractorId"] != DBNull.Value ? Convert.ToInt32(reader["ContractorId"]) : null,
            AssignmentType = assignmentType,
            AssignmentRole = GetStringOrNull(reader, "AssignmentRole"),
            AssignedHours = GetDecimalOrNull(reader, "AssignedHours"),
            IsManualAssignment = reader["IsManualAssignment"] != DBNull.Value && Convert.ToBoolean(reader["IsManualAssignment"]),
            EmployeeName = GetStringOrNull(reader, "EmployeeName"),
            ContractorName = GetStringOrNull(reader, "ContractorName")
        };
    }

    private static ProjectLifecycleReportModel MapReport(SqlDataReader reader)
    {
        // Maps report columns from DB to infrastructure model.
        return new ProjectLifecycleReportModel
        {
            WorkReportId = reader["WorkReportId"] != DBNull.Value ? Convert.ToInt32(reader["WorkReportId"]) : 0,
            WorkItemId = reader["WorkItemId"] != DBNull.Value ? Convert.ToInt32(reader["WorkItemId"]) : null,
            ReportType = GetStringOrNull(reader, "ReportType"),
            ReportDate = GetDateTimeOrNull(reader, "ReportDate"),
            Summary = GetStringOrNull(reader, "Summary"),
            Notes = GetStringOrNull(reader, "Notes"),
            ReporterName = GetStringOrNull(reader, "ReporterName"),
            Status = GetStringOrNull(reader, "Status"),
            FollowUpRequired = reader["FollowUpRequired"] != DBNull.Value && Convert.ToBoolean(reader["FollowUpRequired"])
        };
    }

    private static ProjectLifecycleSummaryModel MapSummary(SqlDataReader reader)
    {
        // Maps aggregated summary values computed by the stored procedure.
        // RiskLevel, HealthStatus, and RiskReason are business indicators for lifecycle monitoring.
        return new ProjectLifecycleSummaryModel
        {
            TotalMilestones = reader["TotalMilestones"] != DBNull.Value ? Convert.ToInt32(reader["TotalMilestones"]) : 0,
            OpenMilestones = reader["OpenMilestones"] != DBNull.Value ? Convert.ToInt32(reader["OpenMilestones"]) : 0,
            ClosedMilestones = reader["ClosedMilestones"] != DBNull.Value ? Convert.ToInt32(reader["ClosedMilestones"]) : 0,
            LockedMilestones = reader["LockedMilestones"] != DBNull.Value ? Convert.ToInt32(reader["LockedMilestones"]) : 0,
            CancelledMilestones = reader["CancelledMilestones"] != DBNull.Value ? Convert.ToInt32(reader["CancelledMilestones"]) : 0,
            DelayedMilestones = reader["DelayedMilestones"] != DBNull.Value ? Convert.ToInt32(reader["DelayedMilestones"]) : 0,
            InvalidScheduleMilestones = reader["InvalidScheduleMilestones"] != DBNull.Value ? Convert.ToInt32(reader["InvalidScheduleMilestones"]) : 0,
            UpcomingMilestones = reader["UpcomingMilestones"] != DBNull.Value ? Convert.ToInt32(reader["UpcomingMilestones"]) : 0,
            RiskLevel = reader["RiskLevel"]?.ToString() ?? string.Empty,
            HealthStatus = reader["HealthStatus"]?.ToString() ?? string.Empty,
            RiskReason = reader["RiskReason"]?.ToString() ?? string.Empty,
            ProgressPercent = GetDecimalOrNull(reader, "ProgressPercent") ?? 0m,
            TotalReports = reader["TotalReports"] != DBNull.Value ? Convert.ToInt32(reader["TotalReports"]) : 0,
            HasFollowUps = reader["HasFollowUps"] != DBNull.Value && Convert.ToBoolean(reader["HasFollowUps"])
        };
    }

    private static string? GetStringOrNull(SqlDataReader reader, string columnName)
    {
        // Converts DB nulls to C# null for optional text fields.
        return reader[columnName] == DBNull.Value ? null : reader[columnName]?.ToString();
    }

    private static DateTime? GetDateTimeOrNull(SqlDataReader reader, string columnName)
    {
        // Converts DB nulls to nullable DateTime for optional dates.
        return reader[columnName] == DBNull.Value ? null : Convert.ToDateTime(reader[columnName]);
    }

    private static decimal? GetDecimalOrNull(SqlDataReader reader, string columnName)
    {
        // Converts DB nulls to nullable decimal for optional numeric fields.
        return reader[columnName] == DBNull.Value ? null : Convert.ToDecimal(reader[columnName]);
    }
}

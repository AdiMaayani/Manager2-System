using System.Data;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Models;
using Microsoft.Data.SqlClient;

namespace ManageR2.Infrastructure.Repositories;

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

        await using var command = new SqlCommand("dbo.sp_GetProjectLifecycle", connection)
        {
            CommandType = CommandType.StoredProcedure
        };
        command.Parameters.AddWithValue("@ProjectId", projectId);

        await using var reader = await command.ExecuteReaderAsync();

        if (!await reader.ReadAsync())
        {
            return null;
        }

        var project = MapProject(reader);
        var milestones = new List<ProjectLifecycleMilestoneModel>();
        var assignments = new List<ProjectLifecycleAssignmentModel>();
        var reports = new List<ProjectLifecycleReportModel>();
        var summary = new ProjectLifecycleSummaryModel();

        if (await reader.NextResultAsync())
        {
            while (await reader.ReadAsync())
            {
                milestones.Add(MapMilestone(reader));
            }
        }

        if (await reader.NextResultAsync())
        {
            while (await reader.ReadAsync())
            {
                assignments.Add(MapAssignment(reader));
            }
        }

        if (await reader.NextResultAsync())
        {
            while (await reader.ReadAsync())
            {
                reports.Add(MapReport(reader));
            }
        }

        if (await reader.NextResultAsync() && await reader.ReadAsync())
        {
            summary = MapSummary(reader);
        }

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
        var assignmentType = GetStringOrNull(reader, "AssignmentType") ?? string.Empty;

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
        return new ProjectLifecycleSummaryModel
        {
            TotalMilestones = reader["TotalMilestones"] != DBNull.Value ? Convert.ToInt32(reader["TotalMilestones"]) : 0,
            OpenMilestones = reader["OpenMilestones"] != DBNull.Value ? Convert.ToInt32(reader["OpenMilestones"]) : 0,
            ClosedMilestones = reader["ClosedMilestones"] != DBNull.Value ? Convert.ToInt32(reader["ClosedMilestones"]) : 0,
            LockedMilestones = reader["LockedMilestones"] != DBNull.Value ? Convert.ToInt32(reader["LockedMilestones"]) : 0,
            ProgressPercent = GetDecimalOrNull(reader, "ProgressPercent") ?? 0m,
            TotalReports = reader["TotalReports"] != DBNull.Value ? Convert.ToInt32(reader["TotalReports"]) : 0,
            HasFollowUps = reader["HasFollowUps"] != DBNull.Value && Convert.ToBoolean(reader["HasFollowUps"])
        };
    }

    private static string? GetStringOrNull(SqlDataReader reader, string columnName)
    {
        return reader[columnName] == DBNull.Value ? null : reader[columnName]?.ToString();
    }

    private static DateTime? GetDateTimeOrNull(SqlDataReader reader, string columnName)
    {
        return reader[columnName] == DBNull.Value ? null : Convert.ToDateTime(reader[columnName]);
    }

    private static decimal? GetDecimalOrNull(SqlDataReader reader, string columnName)
    {
        return reader[columnName] == DBNull.Value ? null : Convert.ToDecimal(reader[columnName]);
    }
}

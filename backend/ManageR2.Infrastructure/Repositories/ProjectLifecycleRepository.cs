using System.Data;
using System.Linq;
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

        const string projectSql = @"
SELECT TOP 1
    wi.WorkItemId,
    wi.Title,
    wi.Description,
    wi.Status,
    wi.BillingType,
    wi.CustomerId,
    c.CustomerName,
    wi.SiteId,
    s.SiteName,
    wi.CreatedAt,
    wi.ClosedAt,
    wi.DealCloseDate,
    wi.FinanceProjectNumber,
    wi.InvoiceNumber
FROM dbo.WorkItems wi
LEFT JOIN dbo.Customers c ON c.CustomerId = wi.CustomerId
LEFT JOIN dbo.Sites s ON s.SiteId = wi.SiteId
WHERE wi.WorkItemId = @ProjectId
  AND wi.WorkType = 'Project';";

        await using var projectCommand = new SqlCommand(projectSql, connection)
        {
            CommandType = CommandType.Text
        };
        projectCommand.Parameters.AddWithValue("@ProjectId", projectId);

        await using var reader = await projectCommand.ExecuteReaderAsync();

        if (!await reader.ReadAsync())
        {
            return null;
        }

        var project = MapProject(reader);
        var milestones = await LoadMilestonesAsync(connection, projectId);

        var relatedWorkItemIds = new List<int> { projectId };
        relatedWorkItemIds.AddRange(milestones.Select(m => m.WorkItemId));

        var assignments = await LoadAssignmentsAsync(connection, relatedWorkItemIds);
        var reports = await LoadReportsAsync(connection, relatedWorkItemIds);
        var summary = BuildSummary(milestones, reports);

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

    private static async Task<List<ProjectLifecycleMilestoneModel>> LoadMilestonesAsync(SqlConnection connection, int projectId)
    {
        const string milestonesSql = @"
SELECT
    wi.WorkItemId,
    wi.Title,
    wi.Description,
    wi.Status,
    wi.BillingType,
    wi.CreatedAt,
    wi.PlannedStart,
    wi.PlannedEnd,
    wi.ClosedAt,
    wi.EstimatedHours,
    wi.Priority,
    wi.RequiredRole,
    wi.IsLocked
FROM dbo.WorkItems wi
WHERE wi.ParentWorkItemId = @ProjectId
  AND wi.WorkType = 'Task'
ORDER BY
    CASE WHEN wi.PlannedStart IS NULL THEN 1 ELSE 0 END,
    wi.PlannedStart ASC,
    wi.CreatedAt ASC;";

        var milestones = new List<ProjectLifecycleMilestoneModel>();

        await using var command = new SqlCommand(milestonesSql, connection)
        {
            CommandType = CommandType.Text
        };
        command.Parameters.AddWithValue("@ProjectId", projectId);

        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            milestones.Add(new ProjectLifecycleMilestoneModel
            {
                WorkItemId = Convert.ToInt32(reader["WorkItemId"]),
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
            });
        }

        return milestones;
    }

    private static async Task<List<ProjectLifecycleAssignmentModel>> LoadAssignmentsAsync(
        SqlConnection connection,
        List<int> relatedWorkItemIds)
    {
        var assignments = new List<ProjectLifecycleAssignmentModel>();
        var distinctIds = relatedWorkItemIds.Distinct().ToList();

        var employeeAssignmentsSql = @"
SELECT
    wea.WorkItemId,
    wea.EmployeeId,
    wea.AssignmentRole,
    wea.AssignedHours,
    wea.IsManualAssignment,
    e.FullName AS EmployeeName
FROM dbo.WorkEmployeeAssignments wea
LEFT JOIN dbo.Employees e ON e.EmployeeId = wea.EmployeeId
WHERE wea.WorkItemId IN ({WORK_ITEM_IDS});";

        await using (var employeeCommand = new SqlCommand(string.Empty, connection))
        {
            employeeCommand.CommandType = CommandType.Text;
            var employeeInClause = AddInClauseParameters(employeeCommand, distinctIds, "@EmployeeWorkItemId");
            employeeCommand.CommandText = employeeAssignmentsSql.Replace("{WORK_ITEM_IDS}", employeeInClause);

            await using var reader = await employeeCommand.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                assignments.Add(new ProjectLifecycleAssignmentModel
                {
                    WorkItemId = Convert.ToInt32(reader["WorkItemId"]),
                    EmployeeId = reader["EmployeeId"] != DBNull.Value ? Convert.ToInt32(reader["EmployeeId"]) : null,
                    ContractorId = null,
                    AssignmentType = "Employee",
                    AssignmentRole = GetStringOrNull(reader, "AssignmentRole"),
                    AssignedHours = GetDecimalOrNull(reader, "AssignedHours"),
                    IsManualAssignment = reader["IsManualAssignment"] != DBNull.Value && Convert.ToBoolean(reader["IsManualAssignment"]),
                    EmployeeName = GetStringOrNull(reader, "EmployeeName"),
                    ContractorName = null
                });
            }
        }

        var contractorAssignmentsSql = @"
SELECT
    wca.WorkItemId,
    wca.ContractorId,
    wca.AssignmentRole,
    c.ContractorName
FROM dbo.WorkContractorAssignments wca
LEFT JOIN dbo.Contractors c ON c.ContractorId = wca.ContractorId
WHERE wca.WorkItemId IN ({WORK_ITEM_IDS});";

        await using (var contractorCommand = new SqlCommand(string.Empty, connection))
        {
            contractorCommand.CommandType = CommandType.Text;
            var contractorInClause = AddInClauseParameters(contractorCommand, distinctIds, "@ContractorWorkItemId");
            contractorCommand.CommandText = contractorAssignmentsSql.Replace("{WORK_ITEM_IDS}", contractorInClause);

            await using var reader = await contractorCommand.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                assignments.Add(new ProjectLifecycleAssignmentModel
                {
                    WorkItemId = Convert.ToInt32(reader["WorkItemId"]),
                    EmployeeId = null,
                    ContractorId = reader["ContractorId"] != DBNull.Value ? Convert.ToInt32(reader["ContractorId"]) : null,
                    AssignmentType = "Contractor",
                    AssignmentRole = GetStringOrNull(reader, "AssignmentRole"),
                    AssignedHours = null,
                    IsManualAssignment = true,
                    EmployeeName = null,
                    ContractorName = GetStringOrNull(reader, "ContractorName")
                });
            }
        }

        return assignments;
    }

    private static async Task<List<ProjectLifecycleReportModel>> LoadReportsAsync(
        SqlConnection connection,
        List<int> relatedWorkItemIds)
    {
        var reports = new List<ProjectLifecycleReportModel>();
        var distinctIds = relatedWorkItemIds.Distinct().ToList();

        var reportsSql = @"
SELECT
    wr.WorkReportId,
    wr.WorkItemId,
    wr.ReportType,
    wr.ReportDate,
    wr.Summary,
    wr.Notes,
    wr.ReporterName,
    wr.Status,
    wr.FollowUpRequired
FROM dbo.WorkReports wr
WHERE wr.WorkItemId IN ({WORK_ITEM_IDS})
ORDER BY wr.ReportDate DESC, wr.WorkReportId DESC;";

        await using var command = new SqlCommand(string.Empty, connection)
        {
            CommandType = CommandType.Text
        };
        var inClause = AddInClauseParameters(command, distinctIds, "@ReportWorkItemId");
        command.CommandText = reportsSql.Replace("{WORK_ITEM_IDS}", inClause);

        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            reports.Add(new ProjectLifecycleReportModel
            {
                WorkReportId = Convert.ToInt32(reader["WorkReportId"]),
                WorkItemId = reader["WorkItemId"] != DBNull.Value ? Convert.ToInt32(reader["WorkItemId"]) : null,
                ReportType = GetStringOrNull(reader, "ReportType"),
                ReportDate = GetDateTimeOrNull(reader, "ReportDate"),
                Summary = GetStringOrNull(reader, "Summary"),
                Notes = GetStringOrNull(reader, "Notes"),
                ReporterName = GetStringOrNull(reader, "ReporterName"),
                Status = GetStringOrNull(reader, "Status"),
                FollowUpRequired = reader["FollowUpRequired"] != DBNull.Value && Convert.ToBoolean(reader["FollowUpRequired"])
            });
        }

        return reports;
    }

    private static ProjectLifecycleSummaryModel BuildSummary(
        List<ProjectLifecycleMilestoneModel> milestones,
        List<ProjectLifecycleReportModel> reports)
    {
        var totalMilestones = milestones.Count;
        var closedMilestones = milestones.Count(m =>
            string.Equals(m.Status, "Closed", StringComparison.OrdinalIgnoreCase) || m.ClosedAt.HasValue);
        var openMilestones = totalMilestones - closedMilestones;
        var lockedMilestones = milestones.Count(m => m.IsLocked);
        var progressPercent = totalMilestones == 0
            ? 0m
            : decimal.Round((decimal)closedMilestones / totalMilestones * 100m, 2, MidpointRounding.AwayFromZero);

        return new ProjectLifecycleSummaryModel
        {
            TotalMilestones = totalMilestones,
            OpenMilestones = openMilestones,
            ClosedMilestones = closedMilestones,
            LockedMilestones = lockedMilestones,
            ProgressPercent = progressPercent,
            TotalReports = reports.Count,
            HasFollowUps = reports.Any(r => r.FollowUpRequired)
        };
    }

    private static string AddInClauseParameters(SqlCommand command, List<int> values, string prefix)
    {
        var parameterNames = new List<string>(values.Count);

        for (int i = 0; i < values.Count; i++)
        {
            var parameterName = $"{prefix}{i}";
            command.Parameters.AddWithValue(parameterName, values[i]);
            parameterNames.Add(parameterName);
        }

        return string.Join(", ", parameterNames);
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

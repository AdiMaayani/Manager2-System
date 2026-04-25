using System.Data;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Models;
using Microsoft.Data.SqlClient;

namespace ManageR2.Infrastructure.Repositories;

// Repository implementation for work report create/read flows.
public class WorkReportRepository : IWorkReportRepository
{
    private readonly DBServices _dbServices;

    public WorkReportRepository(DBServices dbServices)
    {
        _dbServices = dbServices;
    }

    public async Task<int> CreateAsync(WorkReportCreateModel request)
    {
        // Uses one transaction so report header and related child rows are saved together.
        await using var connection = _dbServices.CreateConnection();
        await connection.OpenAsync();

        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync();

        try
        {
            int newWorkReportId;

            // Stored procedure inserts report header and returns WorkReportId.
            await using (var command = new SqlCommand("sp_CreateWorkReport", connection, transaction))
            {
                command.CommandType = CommandType.StoredProcedure;

                var parsedReportDate = ParseReportDate(request.Date);

                command.Parameters.AddWithValue("@WorkItemId", request.ProjectId ?? (object)DBNull.Value);
                command.Parameters.AddWithValue("@ReportType", request.ReportType ?? (object)DBNull.Value);
                command.Parameters.AddWithValue("@ReportDate", parsedReportDate ?? (object)DBNull.Value);
                command.Parameters.AddWithValue("@ProjectName", request.ProjectName ?? (object)DBNull.Value);
                command.Parameters.AddWithValue("@CustomerName", request.CustomerName ?? (object)DBNull.Value);
                command.Parameters.AddWithValue("@Site", request.Site ?? (object)DBNull.Value);
                command.Parameters.AddWithValue("@StartTime", request.Start ?? (object)DBNull.Value);
                command.Parameters.AddWithValue("@EndTime", request.End ?? (object)DBNull.Value);
                command.Parameters.AddWithValue("@Summary", request.Summary ?? (object)DBNull.Value);
                command.Parameters.AddWithValue("@Notes", request.Notes ?? (object)DBNull.Value);
               command.Parameters.AddWithValue("@ReporterEmployeeId", request.ReporterId ?? (object)DBNull.Value);
command.Parameters.AddWithValue("@ReporterName", request.ReporterName ?? (object)DBNull.Value);
command.Parameters.AddWithValue("@ReporterRole", request.Role ?? (object)DBNull.Value);
command.Parameters.AddWithValue("@Status", request.Status ?? (object)DBNull.Value);
command.Parameters.AddWithValue("@WorkersCount", request.RelatedWorkers?.Count ?? 0);
                command.Parameters.AddWithValue("@FollowUpRequired", request.Followup);
                command.Parameters.AddWithValue("@FollowUpReason", request.FollowupReason ?? (object)DBNull.Value);

                var result = await command.ExecuteScalarAsync();
                newWorkReportId = result != null ? Convert.ToInt32(result) : 0;
            }

            if (newWorkReportId <= 0)
            {
                throw new Exception("Failed to create work report.");
            }

            // Stores system names linked to the created report.
            if (request.Systems != null && request.Systems.Count > 0)
            {
                foreach (var systemName in request.Systems)
                {
                    if (string.IsNullOrWhiteSpace(systemName))
                    {
                        continue;
                    }

                    await using var systemCommand = new SqlCommand("sp_AddWorkReportSystem", connection, transaction)
                    {
                        CommandType = CommandType.StoredProcedure
                    };

                    systemCommand.Parameters.AddWithValue("@WorkReportId", newWorkReportId);
                    systemCommand.Parameters.AddWithValue("@SystemName", systemName.Trim());

                    await systemCommand.ExecuteNonQueryAsync();
                }
            }

            // Stores related employee assignments linked to the created report.
            if (request.RelatedWorkers != null && request.RelatedWorkers.Count > 0)
            {
                foreach (var worker in request.RelatedWorkers)
                {
                    await using var workerCommand = new SqlCommand("sp_AddWorkReportEmployeeAssignment", connection, transaction)
                    {
                        CommandType = CommandType.StoredProcedure
                    };

                    workerCommand.Parameters.AddWithValue("@WorkReportId", newWorkReportId);
                    workerCommand.Parameters.AddWithValue("@EmployeeId", worker.Id ?? (object)DBNull.Value);
                    workerCommand.Parameters.AddWithValue("@EmployeeName", worker.Name ?? (object)DBNull.Value);
                    workerCommand.Parameters.AddWithValue("@AssignmentRole", DBNull.Value);

                    await workerCommand.ExecuteNonQueryAsync();
                }
            }

            await transaction.CommitAsync();

            return newWorkReportId;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    private static DateTime? ParseReportDate(string? date)
    {
        // Accepts nullable date text from API payload and normalizes it for DB storage.
        if (string.IsNullOrWhiteSpace(date))
        {
            return null;
        }

        if (DateTime.TryParse(date, out var parsedDate))
        {
            return parsedDate;
        }

        return null;
    }

    public async Task<List<WorkReportListItemModel>> GetAllAsync()
{
    // Returns lightweight report rows for list screens.
    var reports = new List<WorkReportListItemModel>();

    await using var connection = _dbServices.CreateConnection();
    await using var command = new SqlCommand(
        @"SELECT 
      WorkReportId,
      ReportDate,
      ProjectName,
      CustomerName,
      ReporterName,
      Status,
      FollowUpRequired
  FROM dbo.WorkReports
  ORDER BY ReportDate DESC, WorkReportId DESC",
        connection)
    {
        CommandType = CommandType.Text
    };

    await connection.OpenAsync();
    await using var reader = await command.ExecuteReaderAsync();

    while (await reader.ReadAsync())
    {
        reports.Add(new WorkReportListItemModel
{
    WorkReportId = reader["WorkReportId"] != DBNull.Value ? Convert.ToInt32(reader["WorkReportId"]) : 0,
    ReportDate = reader["ReportDate"] != DBNull.Value ? Convert.ToDateTime(reader["ReportDate"]) : null,
    ProjectName = reader["ProjectName"]?.ToString(),
    CustomerName = reader["CustomerName"]?.ToString(),
    ReporterName = reader["ReporterName"]?.ToString(),
    Status = reader["Status"]?.ToString(),
    FollowUpRequired = reader["FollowUpRequired"] != DBNull.Value && Convert.ToBoolean(reader["FollowUpRequired"])
});
    }

    return reports;
}

public async Task<WorkReportDetailsModel?> GetByIdAsync(int workReportId)
{
    // Loads full report details plus related systems and workers.
    await using var connection = _dbServices.CreateConnection();
    await connection.OpenAsync();

    WorkReportDetailsModel? report = null;

    await using (var command = new SqlCommand(
@"SELECT 
      WorkReportId,
      WorkItemId,
      ReportType,
      ReportDate,
      ProjectName,
      CustomerName,
      Site,
      StartTime,
      EndTime,
      Summary,
      Notes,
      ReporterEmployeeId,
      ReporterName,
      ReporterRole,
      Status,
      FollowUpRequired,
      FollowUpReason
  FROM dbo.WorkReports
  WHERE WorkReportId = @WorkReportId",
        connection))
    {
        command.CommandType = CommandType.Text;
        command.Parameters.AddWithValue("@WorkReportId", workReportId);

        await using var reader = await command.ExecuteReaderAsync();

        if (await reader.ReadAsync())
        {
            report = new WorkReportDetailsModel
            {
                WorkReportId = reader["WorkReportId"] != DBNull.Value ? Convert.ToInt32(reader["WorkReportId"]) : 0,
                ProjectId = reader["WorkItemId"] != DBNull.Value ? Convert.ToInt32(reader["WorkItemId"]) : null,
                ReportType = reader["ReportType"]?.ToString(),
                ReportDate = reader["ReportDate"] != DBNull.Value ? Convert.ToDateTime(reader["ReportDate"]) : null,
                ProjectName = reader["ProjectName"]?.ToString(),
                CustomerName = reader["CustomerName"]?.ToString(),
                Site = reader["Site"]?.ToString(),
                Start = reader["StartTime"]?.ToString(),
                End = reader["EndTime"]?.ToString(),
                Summary = reader["Summary"]?.ToString(),
                Notes = reader["Notes"]?.ToString(),
                ReporterId = reader["ReporterEmployeeId"] != DBNull.Value ? Convert.ToInt32(reader["ReporterEmployeeId"]) : null,
                ReporterName = reader["ReporterName"]?.ToString(),
                Role = reader["ReporterRole"]?.ToString(),
                Status = reader["Status"]?.ToString(),
                Followup = reader["FollowUpRequired"] != DBNull.Value && Convert.ToBoolean(reader["FollowUpRequired"]),
                FollowupReason = reader["FollowUpReason"]?.ToString()
            };
        }
    }

    if (report == null)
    {
        return null;
    }

    // Loads child system records linked to this report.
    await using (var systemsCommand = new SqlCommand(
        @"SELECT SystemName
          FROM dbo.WorkReportSystems
          WHERE WorkReportId = @WorkReportId
          ORDER BY WorkReportSystemId",
        connection))
    {
        systemsCommand.CommandType = CommandType.Text;
        systemsCommand.Parameters.AddWithValue("@WorkReportId", workReportId);

        await using var systemsReader = await systemsCommand.ExecuteReaderAsync();

        while (await systemsReader.ReadAsync())
        {
            var systemName = systemsReader["SystemName"]?.ToString();
            if (!string.IsNullOrWhiteSpace(systemName))
            {
                report.Systems.Add(systemName);
            }
        }
    }

    // Loads child worker records linked to this report.
    await using (var workersCommand = new SqlCommand(
        @"SELECT 
              EmployeeId,
              EmployeeName
          FROM dbo.WorkReportEmployeeAssignments
          WHERE WorkReportId = @WorkReportId
          ORDER BY WorkReportEmployeeAssignmentId",
        connection))
    {
        workersCommand.CommandType = CommandType.Text;
        workersCommand.Parameters.AddWithValue("@WorkReportId", workReportId);

        await using var workersReader = await workersCommand.ExecuteReaderAsync();

        while (await workersReader.ReadAsync())
        {
            report.RelatedWorkers.Add(new WorkReportRelatedWorkerModel
            {
                Id = workersReader["EmployeeId"] != DBNull.Value ? Convert.ToInt32(workersReader["EmployeeId"]) : null,
                Name = workersReader["EmployeeName"]?.ToString()
            });
        }
    }

    return report;
}

}
using System.Data;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Models;
using Microsoft.Data.SqlClient;

namespace ManageR2.Infrastructure.Repositories;

// ReportsController -> this -> SQL Server stored procedures. No inline SQL lives in this repository.
public class WorkReportRepository : IWorkReportRepository
{
    private readonly DBServices _dbServices;

    public WorkReportRepository(DBServices dbServices)
    {
        _dbServices = dbServices;
    }

    // sp_CreateWorkReport + child SPs inside one SqlTransaction; returns new WorkReportId scalar to the API.
    public async Task<int> CreateAsync(WorkReportCreateModel request)
    {
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
                AddEditableReportParameters(command, request);

                var result = await command.ExecuteScalarAsync();
                newWorkReportId = result != null ? Convert.ToInt32(result) : 0;
            }

            if (newWorkReportId <= 0)
            {
                throw new Exception("Failed to create work report.");
            }

            await InsertChildRowsAsync(connection, transaction, newWorkReportId, request);

            await transaction.CommitAsync();

            return newWorkReportId;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<List<WorkReportListItemModel>> GetAllAsync()
    {
        var reports = new List<WorkReportListItemModel>();

        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_WorkReports_GetList", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            reports.Add(new WorkReportListItemModel
            {
                WorkReportId = GetIntValue(reader, "WorkReportId"),
                ReportDate = GetDateTimeValue(reader, "ReportDate"),
                ProjectName = GetStringValue(reader, "ProjectName"),
                CustomerName = GetStringValue(reader, "CustomerName"),
                ReporterName = GetStringValue(reader, "ReporterName"),
                Status = GetStringValue(reader, "Status"),
                FollowUpRequired = GetBoolValue(reader, "FollowUpRequired")
            });
        }

        return reports;
    }

    public async Task<WorkReportDetailsModel?> GetByIdAsync(int workReportId)
    {
        await using var connection = _dbServices.CreateConnection();
        await connection.OpenAsync();

        WorkReportDetailsModel? report = null;

        await using (var command = new SqlCommand("dbo.sp_WorkReports_GetById", connection))
        {
            command.CommandType = CommandType.StoredProcedure;
            command.Parameters.AddWithValue("@WorkReportId", workReportId);

            await using var reader = await command.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                report = MapDetails(reader);
            }
        }

        if (report == null)
        {
            return null;
        }

        await LoadSystemsAsync(connection, report);
        await LoadRelatedWorkersAsync(connection, report);

        return report;
    }

    public async Task<bool> UpdateAsync(WorkReportUpdateModel request)
    {
        await using var connection = _dbServices.CreateConnection();
        await connection.OpenAsync();

        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync();

        try
        {
            await using (var command = new SqlCommand("dbo.sp_WorkReports_Update", connection, transaction))
            {
                command.CommandType = CommandType.StoredProcedure;
                command.Parameters.AddWithValue("@WorkReportId", request.WorkReportId);
                AddEditableReportParameters(command, request);

                var result = await command.ExecuteScalarAsync();
                var rowsAffected = result != null && result != DBNull.Value
                    ? Convert.ToInt32(result)
                    : 0;

                if (rowsAffected <= 0)
                {
                    await transaction.RollbackAsync();
                    return false;
                }
            }

            await DeleteChildRowsAsync(connection, transaction, request.WorkReportId);
            await InsertChildRowsAsync(connection, transaction, request.WorkReportId, request);
            await transaction.CommitAsync();

            return true;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<bool> DeleteAsync(int workReportId)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_WorkReports_Delete", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        command.Parameters.AddWithValue("@WorkReportId", workReportId);

        await connection.OpenAsync();
        var result = await command.ExecuteScalarAsync();
        var rowsAffected = result != null && result != DBNull.Value
            ? Convert.ToInt32(result)
            : 0;

        return rowsAffected > 0;
    }

    private static async Task InsertChildRowsAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        int workReportId,
        WorkReportCreateModel request)
    {
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

                systemCommand.Parameters.AddWithValue("@WorkReportId", workReportId);
                systemCommand.Parameters.AddWithValue("@SystemName", systemName.Trim());

                await systemCommand.ExecuteNonQueryAsync();
            }
        }

        if (request.RelatedWorkers != null && request.RelatedWorkers.Count > 0)
        {
            foreach (var worker in request.RelatedWorkers)
            {
                await using var workerCommand = new SqlCommand("sp_AddWorkReportEmployeeAssignment", connection, transaction)
                {
                    CommandType = CommandType.StoredProcedure
                };

                workerCommand.Parameters.AddWithValue("@WorkReportId", workReportId);
                workerCommand.Parameters.AddWithValue("@EmployeeId", worker.Id.HasValue ? worker.Id.Value : DBNull.Value);
                workerCommand.Parameters.AddWithValue("@EmployeeName", (object?)worker.Name ?? DBNull.Value);
                workerCommand.Parameters.AddWithValue("@AssignmentRole", DBNull.Value);

                await workerCommand.ExecuteNonQueryAsync();
            }
        }
    }

    private static async Task DeleteChildRowsAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        int workReportId)
    {
        await using (var systemsCommand = new SqlCommand("dbo.sp_WorkReports_DeleteSystems", connection, transaction))
        {
            systemsCommand.CommandType = CommandType.StoredProcedure;
            systemsCommand.Parameters.AddWithValue("@WorkReportId", workReportId);
            await systemsCommand.ExecuteNonQueryAsync();
        }

        await using (var workersCommand = new SqlCommand("dbo.sp_WorkReports_DeleteEmployeeAssignments", connection, transaction))
        {
            workersCommand.CommandType = CommandType.StoredProcedure;
            workersCommand.Parameters.AddWithValue("@WorkReportId", workReportId);
            await workersCommand.ExecuteNonQueryAsync();
        }
    }

    private async Task LoadSystemsAsync(SqlConnection connection, WorkReportDetailsModel report)
    {
        await using var systemsCommand = new SqlCommand("dbo.sp_WorkReports_GetSystems", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        systemsCommand.Parameters.AddWithValue("@WorkReportId", report.WorkReportId);

        await using var systemsReader = await systemsCommand.ExecuteReaderAsync();

        while (await systemsReader.ReadAsync())
        {
            var systemName = GetStringValue(systemsReader, "SystemName");
            if (!string.IsNullOrWhiteSpace(systemName))
            {
                report.Systems.Add(systemName);
            }
        }
    }

    private async Task LoadRelatedWorkersAsync(SqlConnection connection, WorkReportDetailsModel report)
    {
        await using var workersCommand = new SqlCommand("dbo.sp_WorkReports_GetEmployeeAssignments", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        workersCommand.Parameters.AddWithValue("@WorkReportId", report.WorkReportId);

        await using var workersReader = await workersCommand.ExecuteReaderAsync();

        while (await workersReader.ReadAsync())
        {
            report.RelatedWorkers.Add(new WorkReportRelatedWorkerModel
            {
                Id = GetNullableIntValue(workersReader, "EmployeeId"),
                Name = GetStringValue(workersReader, "EmployeeName")
            });
        }
    }

    private static void AddEditableReportParameters(SqlCommand command, WorkReportCreateModel request)
    {
        var parsedReportDate = ParseReportDate(request.Date);

        command.Parameters.AddWithValue("@WorkItemId", request.ProjectId.HasValue ? request.ProjectId.Value : DBNull.Value);
        command.Parameters.AddWithValue("@ReportType", (object?)request.ReportType ?? DBNull.Value);
        command.Parameters.AddWithValue("@ReportDate", parsedReportDate.HasValue ? parsedReportDate.Value : DBNull.Value);
        command.Parameters.AddWithValue("@ProjectName", (object?)request.ProjectName ?? DBNull.Value);
        command.Parameters.AddWithValue("@CustomerName", (object?)request.CustomerName ?? DBNull.Value);
        command.Parameters.AddWithValue("@Site", (object?)request.Site ?? DBNull.Value);
        command.Parameters.AddWithValue("@StartTime", (object?)request.Start ?? DBNull.Value);
        command.Parameters.AddWithValue("@EndTime", (object?)request.End ?? DBNull.Value);
        command.Parameters.AddWithValue("@Summary", (object?)request.Summary ?? DBNull.Value);
        command.Parameters.AddWithValue("@Notes", (object?)request.Notes ?? DBNull.Value);
        command.Parameters.AddWithValue("@ReporterEmployeeId", request.ReporterId.HasValue ? request.ReporterId.Value : DBNull.Value);
        command.Parameters.AddWithValue("@ReporterName", (object?)request.ReporterName ?? DBNull.Value);
        command.Parameters.AddWithValue("@ReporterRole", (object?)request.Role ?? DBNull.Value);
        command.Parameters.AddWithValue("@Status", (object?)request.Status ?? DBNull.Value);
        command.Parameters.AddWithValue("@WorkersCount", request.RelatedWorkers?.Count ?? 0);
        command.Parameters.AddWithValue("@FollowUpRequired", request.Followup);
        command.Parameters.AddWithValue("@FollowUpReason", (object?)request.FollowupReason ?? DBNull.Value);
    }

    private static WorkReportDetailsModel MapDetails(SqlDataReader reader)
    {
        return new WorkReportDetailsModel
        {
            WorkReportId = GetIntValue(reader, "WorkReportId"),
            ProjectId = GetNullableIntValue(reader, "WorkItemId"),
            ReportType = GetStringValue(reader, "ReportType"),
            ReportDate = GetDateTimeValue(reader, "ReportDate"),
            ProjectName = GetStringValue(reader, "ProjectName"),
            CustomerName = GetStringValue(reader, "CustomerName"),
            Site = GetStringValue(reader, "Site"),
            Start = GetStringValue(reader, "StartTime"),
            End = GetStringValue(reader, "EndTime"),
            Summary = GetStringValue(reader, "Summary"),
            Notes = GetStringValue(reader, "Notes"),
            ReporterId = GetNullableIntValue(reader, "ReporterEmployeeId"),
            ReporterName = GetStringValue(reader, "ReporterName"),
            Role = GetStringValue(reader, "ReporterRole"),
            Status = GetStringValue(reader, "Status"),
            Followup = GetBoolValue(reader, "FollowUpRequired"),
            FollowupReason = GetStringValue(reader, "FollowUpReason")
        };
    }

    private static DateTime? ParseReportDate(string? date)
    {
        if (string.IsNullOrWhiteSpace(date))
        {
            return null;
        }

        return DateTime.TryParse(date, out var parsedDate) ? parsedDate : null;
    }

    private static string? GetStringValue(SqlDataReader reader, string columnName)
    {
        return reader[columnName] == DBNull.Value ? null : reader[columnName]?.ToString();
    }

    private static int GetIntValue(SqlDataReader reader, string columnName)
    {
        return reader[columnName] == DBNull.Value ? 0 : Convert.ToInt32(reader[columnName]);
    }

    private static int? GetNullableIntValue(SqlDataReader reader, string columnName)
    {
        return reader[columnName] == DBNull.Value ? null : Convert.ToInt32(reader[columnName]);
    }

    private static bool GetBoolValue(SqlDataReader reader, string columnName)
    {
        return reader[columnName] != DBNull.Value && Convert.ToBoolean(reader[columnName]);
    }

    private static DateTime? GetDateTimeValue(SqlDataReader reader, string columnName)
    {
        return reader[columnName] == DBNull.Value ? null : Convert.ToDateTime(reader[columnName]);
    }
}
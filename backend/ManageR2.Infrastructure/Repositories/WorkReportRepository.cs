using System.Data;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Models;
using Microsoft.Data.SqlClient;

namespace ManageR2.Infrastructure.Repositories;

public class WorkReportRepository : IWorkReportRepository
{
    private readonly DBServices _dbServices;

    public WorkReportRepository(DBServices dbServices)
    {
        _dbServices = dbServices;
    }

    public async Task<int> CreateAsync(WorkReportCreateModel request)
    {
        await using var connection = _dbServices.CreateConnection();
        await connection.OpenAsync();

        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync();

        try
        {
            int newWorkReportId;

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
}
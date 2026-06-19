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
                FollowUpRequired = GetBoolValue(reader, "FollowUpRequired"),
                LifecycleStatus = GetStringValue(reader, "LifecycleStatus"),
                FinalizedAt = GetDateTimeValue(reader, "FinalizedAt"),
                ReversedAt = GetDateTimeValue(reader, "ReversedAt"),
                AmendsWorkReportId = GetNullableIntValue(reader, "AmendsWorkReportId"),
                UpdatedAt = GetDateTimeValue(reader, "UpdatedAt")
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
        await LoadInventoryLinesAsync(connection, report);
        await LoadAttachmentsAsync(connection, report);

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

    public async Task<WorkReportLifecycleResultModel?> FinalizeAsync(int workReportId, int? finalizedByUserId)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_WorkReports_Finalize", connection)
        {
            CommandType = CommandType.StoredProcedure
        };
        command.Parameters.AddWithValue("@WorkReportId", workReportId);
        command.Parameters.AddWithValue("@FinalizedByUserId", (object?)finalizedByUserId ?? DBNull.Value);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        return await reader.ReadAsync() ? MapLifecycleResult(reader) : null;
    }

    public async Task<WorkReportLifecycleResultModel?> ReverseAsync(
        int workReportId,
        string reversalReason,
        int? reversedByUserId)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_WorkReports_Reverse", connection)
        {
            CommandType = CommandType.StoredProcedure
        };
        command.Parameters.AddWithValue("@WorkReportId", workReportId);
        command.Parameters.AddWithValue("@ReversalReason", reversalReason);
        command.Parameters.AddWithValue("@ReversedByUserId", (object?)reversedByUserId ?? DBNull.Value);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        return await reader.ReadAsync() ? MapLifecycleResult(reader) : null;
    }

    public async Task<int> AmendAsync(int reversedWorkReportId, WorkReportCreateModel request)
    {
        request.AmendsWorkReportId = reversedWorkReportId;
        return await CreateAsync(request);
    }

    public async Task<WorkReportInventoryLineModel?> AddInventoryLineAsync(
        int workReportId,
        int inventoryItemId,
        decimal quantity,
        string usageType,
        int? createdByUserId)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_WorkReportInventory_Add", connection)
        {
            CommandType = CommandType.StoredProcedure
        };
        command.Parameters.AddWithValue("@WorkReportId", workReportId);
        command.Parameters.AddWithValue("@InventoryItemId", inventoryItemId);
        command.Parameters.AddWithValue("@Quantity", quantity);
        command.Parameters.AddWithValue("@UsageType", usageType);
        command.Parameters.AddWithValue("@CreatedByUserId", (object?)createdByUserId ?? DBNull.Value);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        return await reader.ReadAsync() ? MapInventoryLine(reader) : null;
    }

    public async Task<bool> DeleteInventoryLineAsync(int workReportId, int workReportInventoryItemId)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_WorkReportInventory_Delete", connection)
        {
            CommandType = CommandType.StoredProcedure
        };
        command.Parameters.AddWithValue("@WorkReportId", workReportId);
        command.Parameters.AddWithValue("@WorkReportInventoryItemId", workReportInventoryItemId);

        await connection.OpenAsync();
        var result = await command.ExecuteScalarAsync();
        return result != null && result != DBNull.Value && Convert.ToInt32(result) > 0;
    }

    public async Task<List<WorkReportInventoryLineModel>> GetInventoryLinesAsync(int workReportId)
    {
        var lines = new List<WorkReportInventoryLineModel>();
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_WorkReportInventory_GetByReport", connection)
        {
            CommandType = CommandType.StoredProcedure
        };
        command.Parameters.AddWithValue("@WorkReportId", workReportId);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            lines.Add(MapInventoryLine(reader));
        }

        return lines;
    }

    public async Task<WorkReportAttachmentModel?> AddAttachmentAsync(
        int workReportId,
        string mediaType,
        string originalFileName,
        string storedFileName,
        string filePath,
        string contentType,
        long fileSizeBytes,
        int? uploadedByUserId)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_WorkReportAttachments_Add", connection)
        {
            CommandType = CommandType.StoredProcedure
        };
        command.Parameters.AddWithValue("@WorkReportId", workReportId);
        command.Parameters.AddWithValue("@MediaType", mediaType);
        command.Parameters.AddWithValue("@OriginalFileName", originalFileName);
        command.Parameters.AddWithValue("@StoredFileName", storedFileName);
        command.Parameters.AddWithValue("@FilePath", filePath);
        command.Parameters.AddWithValue("@ContentType", contentType);
        command.Parameters.AddWithValue("@FileSizeBytes", fileSizeBytes);
        command.Parameters.AddWithValue("@UploadedByUserId", (object?)uploadedByUserId ?? DBNull.Value);

        await connection.OpenAsync();
        var result = await command.ExecuteScalarAsync();
        var attachmentId = result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;
        if (attachmentId <= 0)
        {
            return null;
        }

        return await GetAttachmentAsync(workReportId, attachmentId);
    }

    public async Task<WorkReportAttachmentDeleteResultModel?> DeleteAttachmentAsync(
        int workReportId,
        int workReportAttachmentId)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_WorkReportAttachments_Delete", connection)
        {
            CommandType = CommandType.StoredProcedure
        };
        command.Parameters.AddWithValue("@WorkReportId", workReportId);
        command.Parameters.AddWithValue("@WorkReportAttachmentId", workReportAttachmentId);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            return null;
        }

        return new WorkReportAttachmentDeleteResultModel
        {
            WorkReportAttachmentId = GetIntValue(reader, "WorkReportAttachmentId"),
            StoredFileName = GetStringValue(reader, "StoredFileName"),
            FilePath = GetStringValue(reader, "FilePath"),
            ContentType = GetStringValue(reader, "ContentType"),
            FileSizeBytes = reader["FileSizeBytes"] == DBNull.Value ? null : Convert.ToInt64(reader["FileSizeBytes"])
        };
    }

    public async Task<List<WorkReportAttachmentModel>> GetAttachmentsAsync(int workReportId)
    {
        var attachments = new List<WorkReportAttachmentModel>();
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_WorkReportAttachments_GetByReport", connection)
        {
            CommandType = CommandType.StoredProcedure
        };
        command.Parameters.AddWithValue("@WorkReportId", workReportId);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            attachments.Add(MapAttachment(reader));
        }

        return attachments;
    }

    public async Task<WorkReportAttachmentModel?> GetAttachmentAsync(int workReportId, int workReportAttachmentId)
    {
        var attachments = await GetAttachmentsAsync(workReportId);
        return attachments.FirstOrDefault(attachment => attachment.WorkReportAttachmentId == workReportAttachmentId);
    }

    private static async Task LoadInventoryLinesAsync(SqlConnection connection, WorkReportDetailsModel report)
    {
        await using var command = new SqlCommand("dbo.sp_WorkReportInventory_GetByReport", connection)
        {
            CommandType = CommandType.StoredProcedure
        };
        command.Parameters.AddWithValue("@WorkReportId", report.WorkReportId);

        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            report.InventoryLines.Add(MapInventoryLine(reader));
        }
    }

    private static async Task LoadAttachmentsAsync(SqlConnection connection, WorkReportDetailsModel report)
    {
        await using var command = new SqlCommand("dbo.sp_WorkReportAttachments_GetByReport", connection)
        {
            CommandType = CommandType.StoredProcedure
        };
        command.Parameters.AddWithValue("@WorkReportId", report.WorkReportId);

        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            report.Attachments.Add(MapAttachment(reader));
        }
    }

    private static WorkReportInventoryLineModel MapInventoryLine(SqlDataReader reader)
    {
        return new WorkReportInventoryLineModel
        {
            WorkReportInventoryItemId = GetIntValue(reader, "WorkReportInventoryItemId"),
            WorkReportId = GetIntValue(reader, "WorkReportId"),
            InventoryItemId = GetIntValue(reader, "InventoryItemId"),
            Quantity = reader["Quantity"] == DBNull.Value ? 0m : Convert.ToDecimal(reader["Quantity"]),
            UsageType = GetStringValue(reader, "UsageType") ?? string.Empty,
            SkuSnapshot = GetStringValue(reader, "SkuSnapshot"),
            ItemNameSnapshot = GetStringValue(reader, "ItemNameSnapshot"),
            CreatedAt = GetDateTimeValue(reader, "CreatedAt"),
            CreatedByUserId = GetNullableIntValue(reader, "CreatedByUserId")
        };
    }

    private static WorkReportAttachmentModel MapAttachment(SqlDataReader reader)
    {
        return new WorkReportAttachmentModel
        {
            WorkReportAttachmentId = GetIntValue(reader, "WorkReportAttachmentId"),
            WorkReportId = GetIntValue(reader, "WorkReportId"),
            MediaType = GetStringValue(reader, "MediaType") ?? string.Empty,
            OriginalFileName = GetStringValue(reader, "OriginalFileName") ?? string.Empty,
            StoredFileName = GetStringValue(reader, "StoredFileName") ?? string.Empty,
            FilePath = GetStringValue(reader, "FilePath") ?? string.Empty,
            ContentType = GetStringValue(reader, "ContentType"),
            FileSizeBytes = reader["FileSizeBytes"] == DBNull.Value ? 0L : Convert.ToInt64(reader["FileSizeBytes"]),
            UploadedAt = GetDateTimeValue(reader, "UploadedAt"),
            UploadedByUserId = GetNullableIntValue(reader, "UploadedByUserId")
        };
    }

    private static WorkReportLifecycleResultModel MapLifecycleResult(SqlDataReader reader)
    {
        return new WorkReportLifecycleResultModel
        {
            WorkReportId = GetIntValue(reader, "WorkReportId"),
            Status = GetStringValue(reader, "Status"),
            LifecycleStatus = GetStringValue(reader, "LifecycleStatus") ?? string.Empty,
            FinalizedAt = GetDateTimeValue(reader, "FinalizedAt"),
            FinalizedByUserId = GetNullableIntValue(reader, "FinalizedByUserId"),
            ReversedAt = GetDateTimeValue(reader, "ReversedAt"),
            ReversedByUserId = GetNullableIntValue(reader, "ReversedByUserId"),
            ReversalReason = GetStringValue(reader, "ReversalReason")
        };
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
        var isServiceCallReport = string.Equals(request.ReportType, "service_call", StringComparison.OrdinalIgnoreCase);
        var linkedWorkItemId = request.WorkItemId
            ?? (isServiceCallReport ? request.ServiceCallId ?? request.ProjectId : request.ProjectId);
        var projectName = isServiceCallReport
            ? request.ServiceCallTitle ?? request.ProjectName
            : request.ProjectName;

        command.Parameters.AddWithValue("@WorkItemId", linkedWorkItemId.HasValue ? linkedWorkItemId.Value : DBNull.Value);
        command.Parameters.AddWithValue("@ReportType", (object?)request.ReportType ?? DBNull.Value);
        command.Parameters.AddWithValue("@ReportDate", parsedReportDate.HasValue ? parsedReportDate.Value : DBNull.Value);
        command.Parameters.AddWithValue("@ProjectName", (object?)projectName ?? DBNull.Value);
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
        command.Parameters.AddWithValue("@AmendsWorkReportId", (object?)request.AmendsWorkReportId ?? DBNull.Value);
        command.Parameters.AddWithValue("@UpdatedByUserId", (object?)request.UpdatedByUserId ?? DBNull.Value);
    }

    private static WorkReportDetailsModel MapDetails(SqlDataReader reader)
    {
        var reportType = GetStringValue(reader, "ReportType");
        var linkedWorkItemId = GetNullableIntValue(reader, "WorkItemId");
        var projectName = GetStringValue(reader, "ProjectName");
        var isServiceCallReport = string.Equals(reportType, "service_call", StringComparison.OrdinalIgnoreCase);

        return new WorkReportDetailsModel
        {
            WorkReportId = GetIntValue(reader, "WorkReportId"),
            ProjectId = linkedWorkItemId,
            ReportType = reportType,
            ReportDate = GetDateTimeValue(reader, "ReportDate"),
            ProjectName = projectName,
            CustomerName = GetStringValue(reader, "CustomerName"),
            ServiceCallId = isServiceCallReport ? linkedWorkItemId : null,
            ServiceCallTitle = isServiceCallReport ? projectName : null,
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
            FollowupReason = GetStringValue(reader, "FollowUpReason"),
            LifecycleStatus = GetStringValue(reader, "LifecycleStatus"),
            FinalizedAt = GetDateTimeValue(reader, "FinalizedAt"),
            FinalizedByUserId = GetNullableIntValue(reader, "FinalizedByUserId"),
            ReversedAt = GetDateTimeValue(reader, "ReversedAt"),
            ReversedByUserId = GetNullableIntValue(reader, "ReversedByUserId"),
            ReversalReason = GetStringValue(reader, "ReversalReason"),
            AmendsWorkReportId = GetNullableIntValue(reader, "AmendsWorkReportId"),
            UpdatedAt = GetDateTimeValue(reader, "UpdatedAt"),
            UpdatedByUserId = GetNullableIntValue(reader, "UpdatedByUserId")
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
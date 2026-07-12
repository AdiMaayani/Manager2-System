using System.Data.Common;
using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Repositories;

// PostgreSQL implementation of the WorkReports persistence (Wave 4). Reproduces the semantics of the
// dbo.sp_WorkReports_* / sp_CreateWorkReport / sp_WorkReportInventory_* / sp_WorkReportAttachments_*
// stored procedures, including the report lifecycle guards and the transactional inventory
// finalize/reverse orchestration (service-refactor of sp_InventoryStockMovements_ApplyForReport),
// using ADO.NET over Npgsql. Header + child-row work runs inside a single C# transaction, matching the
// SqlTransaction that WorkReportRepository opens.
public sealed partial class PostgresWorkReportRepository : IWorkReportRepository
{
    private readonly PostgresConnectionFactory _connectionFactory;

    public PostgresWorkReportRepository(PostgresConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    // Mirrors sp_CreateWorkReport + child inserts under one transaction; returns the new WorkReportId.
    public async Task<int> CreateAsync(WorkReportCreateModel request)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();

        try
        {
            // Amendment guard (sp_CreateWorkReport 51361): an amendment must reference a reversed report.
            if (request.AmendsWorkReportId is not null && !await ExistsAsync(connection, transaction,
                    """SELECT 1 FROM "WorkReports" WHERE "WorkReportId" = @a AND "LifecycleStatus" = 'Reversed'""",
                    ("@a", request.AmendsWorkReportId.Value)))
            {
                throw new InvalidOperationException("An amendment must reference a reversed work report.");
            }

            var editable = ResolveEditableFields(request);

            int newWorkReportId;
            await using (var command = connection.CreateCommand())
            {
                command.Transaction = transaction;
                command.CommandText =
                    """
                    INSERT INTO "WorkReports"
                        ("WorkItemId", "ReportType", "ReportDate", "ProjectName", "CustomerName", "Site",
                         "StartTime", "EndTime", "Summary", "Notes", "ReporterEmployeeId", "ReporterName",
                         "ReporterRole", "WorkersCount", "Status", "FollowUpRequired", "FollowUpReason",
                         "CreatedAt", "LifecycleStatus", "AmendsWorkReportId", "UpdatedAt", "UpdatedByUserId")
                    VALUES
                        (@WorkItemId, @ReportType, @ReportDate, @ProjectName, @CustomerName, @Site,
                         @StartTime, @EndTime, @Summary, @Notes, @ReporterEmployeeId, @ReporterName,
                         @ReporterRole, @WorkersCount, @Status, @FollowUpRequired, @FollowUpReason,
                         (now() at time zone 'utc'), 'Draft', @AmendsWorkReportId, (now() at time zone 'utc'), @UpdatedByUserId)
                    RETURNING "WorkReportId"
                    """;
                AddEditableReportParameters(command, editable, request);
                var result = await command.ExecuteScalarAsync();
                newWorkReportId = result is null or DBNull ? 0 : Convert.ToInt32(result);
            }

            if (newWorkReportId <= 0)
            {
                throw new InvalidOperationException("Failed to create work report.");
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

    // Mirrors sp_WorkReports_GetList: header list ordered by ReportDate DESC, WorkReportId DESC.
    public async Task<List<WorkReportListItemModel>> GetAllAsync()
    {
        var reports = new List<WorkReportListItemModel>();

        await using var connection = _connectionFactory.CreateConnection();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT "WorkReportId", "ReportDate", "ProjectName", "CustomerName", "ReporterName", "Status",
                   "FollowUpRequired", "LifecycleStatus", "FinalizedAt", "ReversedAt", "AmendsWorkReportId", "UpdatedAt"
            FROM "WorkReports"
            ORDER BY "ReportDate" DESC, "WorkReportId" DESC
            """;

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            reports.Add(new WorkReportListItemModel
            {
                WorkReportId = GetInt(reader, "WorkReportId"),
                ReportDate = GetDateTime(reader, "ReportDate"),
                ProjectName = GetString(reader, "ProjectName"),
                CustomerName = GetString(reader, "CustomerName"),
                ReporterName = GetString(reader, "ReporterName"),
                Status = GetString(reader, "Status"),
                FollowUpRequired = GetBool(reader, "FollowUpRequired"),
                LifecycleStatus = GetString(reader, "LifecycleStatus"),
                FinalizedAt = GetDateTime(reader, "FinalizedAt"),
                ReversedAt = GetDateTime(reader, "ReversedAt"),
                AmendsWorkReportId = GetNullableInt(reader, "AmendsWorkReportId"),
                UpdatedAt = GetDateTime(reader, "UpdatedAt")
            });
        }

        return reports;
    }

    // Mirrors sp_WorkReports_GetById + the four child selects assembled over one connection.
    public async Task<WorkReportDetailsModel?> GetByIdAsync(int workReportId)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        WorkReportDetailsModel? report = null;
        await using (var command = connection.CreateCommand())
        {
            command.CommandText =
                """
                SELECT "WorkReportId", "WorkItemId", "ReportType", "ReportDate", "ProjectName", "CustomerName",
                       "Site", "StartTime", "EndTime", "Summary", "Notes", "ReporterEmployeeId", "ReporterName",
                       "ReporterRole", "Status", "FollowUpRequired", "FollowUpReason", "LifecycleStatus",
                       "FinalizedAt", "FinalizedByUserId", "ReversedAt", "ReversedByUserId", "ReversalReason",
                       "AmendsWorkReportId", "UpdatedAt", "UpdatedByUserId"
                FROM "WorkReports"
                WHERE "WorkReportId" = @WorkReportId
                """;
            AddParameter(command, "@WorkReportId", workReportId);

            await using var reader = await command.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                report = MapDetails(reader);
            }
        }

        if (report is null)
        {
            return null;
        }

        await LoadSystemsAsync(connection, report);
        await LoadRelatedWorkersAsync(connection, report);
        await LoadInventoryLinesAsync(connection, null, report);
        await LoadAttachmentsAsync(connection, null, report);
        return report;
    }

    // Mirrors sp_WorkReports_Update + child replacement under one transaction.
    public async Task<bool> UpdateAsync(WorkReportUpdateModel request)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();

        try
        {
            // Reversed reports are read-only (sp_WorkReports_Update 51360).
            if (await ExistsAsync(connection, transaction,
                    """SELECT 1 FROM "WorkReports" WHERE "WorkReportId" = @id AND "LifecycleStatus" = 'Reversed'""",
                    ("@id", request.WorkReportId)))
            {
                throw new InvalidOperationException("Reversed reports are read-only.");
            }

            var editable = ResolveEditableFields(request);

            int rowsAffected;
            await using (var command = connection.CreateCommand())
            {
                command.Transaction = transaction;
                command.CommandText =
                    """
                    UPDATE "WorkReports"
                    SET "WorkItemId" = @WorkItemId, "ReportType" = @ReportType, "ReportDate" = @ReportDate,
                        "ProjectName" = @ProjectName, "CustomerName" = @CustomerName, "Site" = @Site,
                        "StartTime" = @StartTime, "EndTime" = @EndTime, "Summary" = @Summary, "Notes" = @Notes,
                        "ReporterEmployeeId" = @ReporterEmployeeId, "ReporterName" = @ReporterName,
                        "ReporterRole" = @ReporterRole, "WorkersCount" = @WorkersCount, "Status" = @Status,
                        "FollowUpRequired" = @FollowUpRequired, "FollowUpReason" = @FollowUpReason,
                        "AmendsWorkReportId" = @AmendsWorkReportId, "UpdatedAt" = (now() at time zone 'utc'),
                        "UpdatedByUserId" = @UpdatedByUserId
                    WHERE "WorkReportId" = @WorkReportId AND "LifecycleStatus" IN ('Draft', 'Finalized')
                    """;
                AddParameter(command, "@WorkReportId", request.WorkReportId);
                AddEditableReportParameters(command, editable, request);
                rowsAffected = await command.ExecuteNonQueryAsync();
            }

            if (rowsAffected <= 0)
            {
                await transaction.RollbackAsync();
                return false;
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

    // Mirrors sp_WorkReports_Delete: child assignments + systems, then the report; returns rows removed.
    public async Task<bool> DeleteAsync(int workReportId)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();

        try
        {
            await ExecuteAsync(connection, transaction,
                """DELETE FROM "WorkReportEmployeeAssignments" WHERE "WorkReportId" = @id""", workReportId);
            await ExecuteAsync(connection, transaction,
                """DELETE FROM "WorkReportSystems" WHERE "WorkReportId" = @id""", workReportId);

            int rowsAffected;
            await using (var command = connection.CreateCommand())
            {
                command.Transaction = transaction;
                command.CommandText = """DELETE FROM "WorkReports" WHERE "WorkReportId" = @id""";
                AddParameter(command, "@id", workReportId);
                rowsAffected = await command.ExecuteNonQueryAsync();
            }

            await transaction.CommitAsync();
            return rowsAffected > 0;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    // AmendAsync mirrors WorkReportRepository: stamp the source report id and create a fresh Draft report.
    public async Task<int> AmendAsync(int reversedWorkReportId, WorkReportCreateModel request)
    {
        request.AmendsWorkReportId = reversedWorkReportId;
        return await CreateAsync(request);
    }

    private async Task LoadSystemsAsync(DbConnection connection, WorkReportDetailsModel report)
    {
        await using var command = connection.CreateCommand();
        command.CommandText =
            """SELECT "SystemName" FROM "WorkReportSystems" WHERE "WorkReportId" = @id ORDER BY "WorkReportSystemId" """;
        AddParameter(command, "@id", report.WorkReportId);

        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var systemName = GetString(reader, "SystemName");
            if (!string.IsNullOrWhiteSpace(systemName))
            {
                report.Systems.Add(systemName);
            }
        }
    }

    private async Task LoadRelatedWorkersAsync(DbConnection connection, WorkReportDetailsModel report)
    {
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT "EmployeeId", "EmployeeName" FROM "WorkReportEmployeeAssignments"
            WHERE "WorkReportId" = @id ORDER BY "WorkReportEmployeeAssignmentId"
            """;
        AddParameter(command, "@id", report.WorkReportId);

        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            report.RelatedWorkers.Add(new WorkReportRelatedWorkerModel
            {
                Id = GetNullableInt(reader, "EmployeeId"),
                Name = GetString(reader, "EmployeeName")
            });
        }
    }

    // Reproduces AddEditableReportParameters: derives the linked WorkItem id and display project name
    // from report type (service_call vs project), so the persisted row matches WorkReportRepository.
    private static EditableReportFields ResolveEditableFields(WorkReportCreateModel request)
    {
        var isServiceCallReport = string.Equals(request.ReportType, "service_call", StringComparison.OrdinalIgnoreCase);
        var linkedWorkItemId = request.WorkItemId
            ?? (isServiceCallReport ? request.ServiceCallId ?? request.ProjectId : request.ProjectId);
        var projectName = isServiceCallReport
            ? request.ServiceCallTitle ?? request.ProjectName
            : request.ProjectName;

        return new EditableReportFields(linkedWorkItemId, projectName, ParseReportDate(request.Date));
    }

    private static void AddEditableReportParameters(DbCommand command, EditableReportFields editable, WorkReportCreateModel request)
    {
        AddParameter(command, "@WorkItemId", (object?)editable.LinkedWorkItemId ?? DBNull.Value);
        AddParameter(command, "@ReportType", (object?)request.ReportType ?? DBNull.Value);
        AddParameter(command, "@ReportDate", (object?)editable.ReportDate ?? DBNull.Value);
        AddParameter(command, "@ProjectName", (object?)editable.ProjectName ?? DBNull.Value);
        AddParameter(command, "@CustomerName", (object?)request.CustomerName ?? DBNull.Value);
        AddParameter(command, "@Site", (object?)request.Site ?? DBNull.Value);
        AddParameter(command, "@StartTime", (object?)request.Start ?? DBNull.Value);
        AddParameter(command, "@EndTime", (object?)request.End ?? DBNull.Value);
        AddParameter(command, "@Summary", (object?)request.Summary ?? DBNull.Value);
        AddParameter(command, "@Notes", (object?)request.Notes ?? DBNull.Value);
        AddParameter(command, "@ReporterEmployeeId", (object?)request.ReporterId ?? DBNull.Value);
        AddParameter(command, "@ReporterName", (object?)request.ReporterName ?? DBNull.Value);
        AddParameter(command, "@ReporterRole", (object?)request.Role ?? DBNull.Value);
        // WorkReports.Status is NOT NULL; fall back to the SP's Hebrew "draft" default when unset.
        AddParameter(command, "@Status", (object?)request.Status ?? "טיוטה");
        AddParameter(command, "@WorkersCount", request.RelatedWorkers?.Count ?? 0);
        AddParameter(command, "@FollowUpRequired", request.Followup);
        AddParameter(command, "@FollowUpReason", (object?)request.FollowupReason ?? DBNull.Value);
        AddParameter(command, "@AmendsWorkReportId", (object?)request.AmendsWorkReportId ?? DBNull.Value);
        AddParameter(command, "@UpdatedByUserId", (object?)request.UpdatedByUserId ?? DBNull.Value);
    }

    private static async Task InsertChildRowsAsync(
        DbConnection connection, DbTransaction transaction, int workReportId, WorkReportCreateModel request)
    {
        if (request.Systems is { Count: > 0 })
        {
            foreach (var systemName in request.Systems)
            {
                if (string.IsNullOrWhiteSpace(systemName))
                {
                    continue;
                }

                await using var command = connection.CreateCommand();
                command.Transaction = transaction;
                command.CommandText =
                    """
                    INSERT INTO "WorkReportSystems" ("WorkReportId", "SystemName", "CreatedAt")
                    VALUES (@WorkReportId, @SystemName, localtimestamp)
                    """;
                AddParameter(command, "@WorkReportId", workReportId);
                AddParameter(command, "@SystemName", systemName.Trim());
                await command.ExecuteNonQueryAsync();
            }
        }

        if (request.RelatedWorkers is { Count: > 0 })
        {
            foreach (var worker in request.RelatedWorkers)
            {
                await using var command = connection.CreateCommand();
                command.Transaction = transaction;
                command.CommandText =
                    """
                    INSERT INTO "WorkReportEmployeeAssignments"
                        ("WorkReportId", "EmployeeId", "EmployeeName", "AssignmentRole", "AssignedAt")
                    VALUES (@WorkReportId, @EmployeeId, @EmployeeName, NULL, localtimestamp)
                    """;
                AddParameter(command, "@WorkReportId", workReportId);
                AddParameter(command, "@EmployeeId", (object?)worker.Id ?? DBNull.Value);
                AddParameter(command, "@EmployeeName", (object?)worker.Name ?? DBNull.Value);
                await command.ExecuteNonQueryAsync();
            }
        }
    }

    private static async Task DeleteChildRowsAsync(DbConnection connection, DbTransaction transaction, int workReportId)
    {
        await ExecuteAsync(connection, transaction,
            """DELETE FROM "WorkReportSystems" WHERE "WorkReportId" = @id""", workReportId);
        await ExecuteAsync(connection, transaction,
            """DELETE FROM "WorkReportEmployeeAssignments" WHERE "WorkReportId" = @id""", workReportId);
    }

    private static WorkReportDetailsModel MapDetails(DbDataReader reader)
    {
        var reportType = GetString(reader, "ReportType");
        var linkedWorkItemId = GetNullableInt(reader, "WorkItemId");
        var projectName = GetString(reader, "ProjectName");
        var isServiceCallReport = string.Equals(reportType, "service_call", StringComparison.OrdinalIgnoreCase);

        return new WorkReportDetailsModel
        {
            WorkReportId = GetInt(reader, "WorkReportId"),
            ProjectId = linkedWorkItemId,
            ReportType = reportType,
            ReportDate = GetDateTime(reader, "ReportDate"),
            ProjectName = projectName,
            CustomerName = GetString(reader, "CustomerName"),
            ServiceCallId = isServiceCallReport ? linkedWorkItemId : null,
            ServiceCallTitle = isServiceCallReport ? projectName : null,
            Site = GetString(reader, "Site"),
            Start = GetString(reader, "StartTime"),
            End = GetString(reader, "EndTime"),
            Summary = GetString(reader, "Summary"),
            Notes = GetString(reader, "Notes"),
            ReporterId = GetNullableInt(reader, "ReporterEmployeeId"),
            ReporterName = GetString(reader, "ReporterName"),
            Role = GetString(reader, "ReporterRole"),
            Status = GetString(reader, "Status"),
            Followup = GetBool(reader, "FollowUpRequired"),
            FollowupReason = GetString(reader, "FollowUpReason"),
            LifecycleStatus = GetString(reader, "LifecycleStatus"),
            FinalizedAt = GetDateTime(reader, "FinalizedAt"),
            FinalizedByUserId = GetNullableInt(reader, "FinalizedByUserId"),
            ReversedAt = GetDateTime(reader, "ReversedAt"),
            ReversedByUserId = GetNullableInt(reader, "ReversedByUserId"),
            ReversalReason = GetString(reader, "ReversalReason"),
            AmendsWorkReportId = GetNullableInt(reader, "AmendsWorkReportId"),
            UpdatedAt = GetDateTime(reader, "UpdatedAt"),
            UpdatedByUserId = GetNullableInt(reader, "UpdatedByUserId")
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

    private sealed record EditableReportFields(int? LinkedWorkItemId, string? ProjectName, DateTime? ReportDate);
}

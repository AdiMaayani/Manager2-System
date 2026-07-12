using System.Data.Common;
using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Repositories;

public sealed partial class PostgresWorkReportRepository
{
    // Mirrors sp_WorkReportInventory_Add: Draft-only guard, quantity/usage-type validation, active-item
    // snapshot capture and the report+item+usage upsert (SQL Server MERGE -> ON CONFLICT DO UPDATE).
    public async Task<WorkReportInventoryLineModel?> AddInventoryLineAsync(
        int workReportId,
        int inventoryItemId,
        decimal quantity,
        string usageType,
        int? createdByUserId)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();

        try
        {
            var lifecycleStatus = await LockLifecycleStatusAsync(connection, transaction, workReportId);
            if (lifecycleStatus != "Draft")
            {
                throw new InvalidOperationException("Inventory lines are editable only on Draft reports.");
            }

            if (quantity <= 0 || usageType is not ("Sold" or "Installed" or "Used"))
            {
                throw new InvalidOperationException("Invalid inventory quantity or usage type.");
            }

            string? sku = null;
            string? itemName = null;
            await using (var lookup = connection.CreateCommand())
            {
                lookup.Transaction = transaction;
                lookup.CommandText =
                    """SELECT "SkuCode", "ItemName" FROM "InventoryItems" WHERE "InventoryItemId" = @item AND "IsActive" = true""";
                AddParameter(lookup, "@item", inventoryItemId);
                await using var reader = await lookup.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    sku = reader.IsDBNull(0) ? null : reader.GetString(0);
                    itemName = reader.IsDBNull(1) ? null : reader.GetString(1);
                }
            }

            if (sku is null)
            {
                throw new InvalidOperationException("Active inventory item not found.");
            }

            await using (var upsert = connection.CreateCommand())
            {
                upsert.Transaction = transaction;
                upsert.CommandText =
                    """
                    INSERT INTO "WorkReportInventoryItems"
                        ("WorkReportId", "InventoryItemId", "Quantity", "UsageType", "SkuSnapshot", "ItemNameSnapshot", "CreatedByUserId")
                    VALUES (@WorkReportId, @InventoryItemId, @Quantity, @UsageType, @Sku, @Name, @CreatedByUserId)
                    ON CONFLICT ("WorkReportId", "InventoryItemId", "UsageType")
                    DO UPDATE SET "Quantity" = EXCLUDED."Quantity",
                                  "SkuSnapshot" = EXCLUDED."SkuSnapshot",
                                  "ItemNameSnapshot" = EXCLUDED."ItemNameSnapshot"
                    """;
                AddParameter(upsert, "@WorkReportId", workReportId);
                AddParameter(upsert, "@InventoryItemId", inventoryItemId);
                AddParameter(upsert, "@Quantity", quantity);
                AddParameter(upsert, "@UsageType", usageType);
                AddParameter(upsert, "@Sku", sku);
                AddParameter(upsert, "@Name", (object?)itemName ?? DBNull.Value);
                AddParameter(upsert, "@CreatedByUserId", (object?)createdByUserId ?? DBNull.Value);
                await upsert.ExecuteNonQueryAsync();
            }

            WorkReportInventoryLineModel? line = null;
            await using (var select = connection.CreateCommand())
            {
                select.Transaction = transaction;
                select.CommandText =
                    """
                    SELECT "WorkReportInventoryItemId", "WorkReportId", "InventoryItemId", "Quantity", "UsageType",
                           "SkuSnapshot", "ItemNameSnapshot", "CreatedAt", "CreatedByUserId"
                    FROM "WorkReportInventoryItems"
                    WHERE "WorkReportId" = @WorkReportId AND "InventoryItemId" = @InventoryItemId AND "UsageType" = @UsageType
                    """;
                AddParameter(select, "@WorkReportId", workReportId);
                AddParameter(select, "@InventoryItemId", inventoryItemId);
                AddParameter(select, "@UsageType", usageType);
                await using var reader = await select.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    line = MapInventoryLine(reader);
                }
            }

            await transaction.CommitAsync();
            return line;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    // Mirrors sp_WorkReportInventory_Delete: Draft-only guard, delete by line + report scope.
    public async Task<bool> DeleteInventoryLineAsync(int workReportId, int workReportInventoryItemId)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();

        try
        {
            var lifecycleStatus = await LockLifecycleStatusAsync(connection, transaction, workReportId);
            if (lifecycleStatus != "Draft")
            {
                throw new InvalidOperationException("Inventory lines are editable only on Draft reports.");
            }

            int rowsAffected;
            await using (var command = connection.CreateCommand())
            {
                command.Transaction = transaction;
                command.CommandText =
                    """
                    DELETE FROM "WorkReportInventoryItems"
                    WHERE "WorkReportInventoryItemId" = @LineId AND "WorkReportId" = @WorkReportId
                    """;
                AddParameter(command, "@LineId", workReportInventoryItemId);
                AddParameter(command, "@WorkReportId", workReportId);
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

    // Mirrors sp_WorkReportInventory_GetByReport.
    public async Task<List<WorkReportInventoryLineModel>> GetInventoryLinesAsync(int workReportId)
    {
        var lines = new List<WorkReportInventoryLineModel>();
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();
        await LoadInventoryLinesInto(connection, null, workReportId, lines);
        return lines;
    }

    // Mirrors sp_WorkReportAttachments_Add: Draft/Finalized-only guard, insert, then fetch the new row.
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
        int attachmentId;
        await using (var connection = _connectionFactory.CreateConnection())
        {
            await connection.OpenAsync();
            await using var transaction = await connection.BeginTransactionAsync();

            try
            {
                var lifecycleStatus = await LockLifecycleStatusAsync(connection, transaction, workReportId);
                if (lifecycleStatus is not ("Draft" or "Finalized"))
                {
                    throw new InvalidOperationException("Attachments are editable only on Draft or Finalized reports.");
                }

                await using var command = connection.CreateCommand();
                command.Transaction = transaction;
                command.CommandText =
                    """
                    INSERT INTO "WorkReportAttachments"
                        ("WorkReportId", "MediaType", "OriginalFileName", "StoredFileName", "FilePath",
                         "ContentType", "FileSizeBytes", "UploadedByUserId")
                    VALUES (@WorkReportId, @MediaType, @OriginalFileName, @StoredFileName, @FilePath,
                            @ContentType, @FileSizeBytes, @UploadedByUserId)
                    RETURNING "WorkReportAttachmentId"
                    """;
                AddParameter(command, "@WorkReportId", workReportId);
                AddParameter(command, "@MediaType", mediaType);
                AddParameter(command, "@OriginalFileName", originalFileName);
                AddParameter(command, "@StoredFileName", storedFileName);
                AddParameter(command, "@FilePath", filePath);
                AddParameter(command, "@ContentType", contentType);
                AddParameter(command, "@FileSizeBytes", fileSizeBytes);
                AddParameter(command, "@UploadedByUserId", (object?)uploadedByUserId ?? DBNull.Value);

                var result = await command.ExecuteScalarAsync();
                attachmentId = result is null or DBNull ? 0 : Convert.ToInt32(result);
                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        return attachmentId <= 0 ? null : await GetAttachmentAsync(workReportId, attachmentId);
    }

    // Mirrors sp_WorkReportAttachments_Delete: Draft/Finalized-only guard, delete with OUTPUT of the
    // removed row so the caller can delete the stored file.
    public async Task<WorkReportAttachmentDeleteResultModel?> DeleteAttachmentAsync(
        int workReportId, int workReportAttachmentId)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();

        try
        {
            var lifecycleStatus = await LockLifecycleStatusAsync(connection, transaction, workReportId);
            if (lifecycleStatus is not ("Draft" or "Finalized"))
            {
                throw new InvalidOperationException("Attachments are editable only on Draft or Finalized reports.");
            }

            WorkReportAttachmentDeleteResultModel? deleted = null;
            await using (var command = connection.CreateCommand())
            {
                command.Transaction = transaction;
                command.CommandText =
                    """
                    DELETE FROM "WorkReportAttachments"
                    WHERE "WorkReportAttachmentId" = @AttachmentId AND "WorkReportId" = @WorkReportId
                    RETURNING "WorkReportAttachmentId", "StoredFileName", "FilePath", "ContentType", "FileSizeBytes"
                    """;
                AddParameter(command, "@AttachmentId", workReportAttachmentId);
                AddParameter(command, "@WorkReportId", workReportId);
                await using var reader = await command.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    deleted = new WorkReportAttachmentDeleteResultModel
                    {
                        WorkReportAttachmentId = GetInt(reader, "WorkReportAttachmentId"),
                        StoredFileName = GetString(reader, "StoredFileName"),
                        FilePath = GetString(reader, "FilePath"),
                        ContentType = GetString(reader, "ContentType"),
                        FileSizeBytes = GetNullableLong(reader, "FileSizeBytes")
                    };
                }
            }

            await transaction.CommitAsync();
            return deleted;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    // Mirrors sp_WorkReportAttachments_GetByReport.
    public async Task<List<WorkReportAttachmentModel>> GetAttachmentsAsync(int workReportId)
    {
        var attachments = new List<WorkReportAttachmentModel>();
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();
        await LoadAttachmentsInto(connection, null, workReportId, attachments);
        return attachments;
    }

    public async Task<WorkReportAttachmentModel?> GetAttachmentAsync(int workReportId, int workReportAttachmentId)
    {
        var attachments = await GetAttachmentsAsync(workReportId);
        return attachments.FirstOrDefault(attachment => attachment.WorkReportAttachmentId == workReportAttachmentId);
    }

    private static async Task LoadInventoryLinesAsync(
        DbConnection connection, DbTransaction? transaction, WorkReportDetailsModel report)
    {
        await LoadInventoryLinesInto(connection, transaction, report.WorkReportId, report.InventoryLines);
    }

    private static async Task LoadInventoryLinesInto(
        DbConnection connection, DbTransaction? transaction, int workReportId, List<WorkReportInventoryLineModel> lines)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            SELECT "WorkReportInventoryItemId", "WorkReportId", "InventoryItemId", "Quantity", "UsageType",
                   "SkuSnapshot", "ItemNameSnapshot", "CreatedAt", "CreatedByUserId"
            FROM "WorkReportInventoryItems"
            WHERE "WorkReportId" = @id
            ORDER BY "WorkReportInventoryItemId"
            """;
        AddParameter(command, "@id", workReportId);
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            lines.Add(MapInventoryLine(reader));
        }
    }

    private static async Task LoadAttachmentsAsync(
        DbConnection connection, DbTransaction? transaction, WorkReportDetailsModel report)
    {
        await LoadAttachmentsInto(connection, transaction, report.WorkReportId, report.Attachments);
    }

    private static async Task LoadAttachmentsInto(
        DbConnection connection, DbTransaction? transaction, int workReportId, List<WorkReportAttachmentModel> attachments)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            SELECT "WorkReportAttachmentId", "WorkReportId", "MediaType", "OriginalFileName", "StoredFileName",
                   "FilePath", "ContentType", "FileSizeBytes", "UploadedAt", "UploadedByUserId"
            FROM "WorkReportAttachments"
            WHERE "WorkReportId" = @id
            ORDER BY "UploadedAt", "WorkReportAttachmentId"
            """;
        AddParameter(command, "@id", workReportId);
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            attachments.Add(MapAttachment(reader));
        }
    }

    private static WorkReportInventoryLineModel MapInventoryLine(DbDataReader reader)
    {
        return new WorkReportInventoryLineModel
        {
            WorkReportInventoryItemId = GetInt(reader, "WorkReportInventoryItemId"),
            WorkReportId = GetInt(reader, "WorkReportId"),
            InventoryItemId = GetInt(reader, "InventoryItemId"),
            Quantity = GetDecimal(reader, "Quantity"),
            UsageType = GetString(reader, "UsageType") ?? string.Empty,
            SkuSnapshot = GetString(reader, "SkuSnapshot"),
            ItemNameSnapshot = GetString(reader, "ItemNameSnapshot"),
            CreatedAt = GetDateTime(reader, "CreatedAt"),
            CreatedByUserId = GetNullableInt(reader, "CreatedByUserId")
        };
    }

    private static WorkReportAttachmentModel MapAttachment(DbDataReader reader)
    {
        return new WorkReportAttachmentModel
        {
            WorkReportAttachmentId = GetInt(reader, "WorkReportAttachmentId"),
            WorkReportId = GetInt(reader, "WorkReportId"),
            MediaType = GetString(reader, "MediaType") ?? string.Empty,
            OriginalFileName = GetString(reader, "OriginalFileName") ?? string.Empty,
            StoredFileName = GetString(reader, "StoredFileName") ?? string.Empty,
            FilePath = GetString(reader, "FilePath") ?? string.Empty,
            ContentType = GetString(reader, "ContentType"),
            FileSizeBytes = GetNullableLong(reader, "FileSizeBytes") ?? 0L,
            UploadedAt = GetDateTime(reader, "UploadedAt"),
            UploadedByUserId = GetNullableInt(reader, "UploadedByUserId")
        };
    }
}

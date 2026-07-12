using System.Data.Common;
using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Repositories;

public sealed partial class PostgresWorkReportRepository
{
    // Mirrors sp_WorkReports_Finalize: locks the report, applies inventory usage movements as a validated
    // C# transaction (service-refactor of sp_InventoryStockMovements_ApplyForReport), then flips the
    // report to Finalized. Idempotent: an already-Finalized report is a no-op that returns its row.
    public async Task<WorkReportLifecycleResultModel?> FinalizeAsync(int workReportId, int? finalizedByUserId)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();

        try
        {
            var lifecycleStatus = await LockLifecycleStatusAsync(connection, transaction, workReportId);
            if (lifecycleStatus is null)
            {
                throw new InvalidOperationException("Work report not found.");
            }

            if (lifecycleStatus == "Reversed")
            {
                throw new InvalidOperationException("A reversed report cannot be finalized.");
            }

            if (lifecycleStatus == "Draft")
            {
                await ApplyInventoryMovementsAsync(connection, transaction, workReportId, "ReportUsage", finalizedByUserId);

                await using var update = connection.CreateCommand();
                update.Transaction = transaction;
                update.CommandText =
                    """
                    UPDATE "WorkReports"
                    SET "LifecycleStatus" = 'Finalized', "FinalizedAt" = (now() at time zone 'utc'),
                        "FinalizedByUserId" = @UserId, "UpdatedAt" = (now() at time zone 'utc'), "UpdatedByUserId" = @UserId
                    WHERE "WorkReportId" = @WorkReportId
                    """;
                AddParameter(update, "@UserId", (object?)finalizedByUserId ?? DBNull.Value);
                AddParameter(update, "@WorkReportId", workReportId);
                await update.ExecuteNonQueryAsync();
            }

            var result = await ReadLifecycleResultAsync(connection, transaction, workReportId);
            await transaction.CommitAsync();
            return result;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    // Mirrors sp_WorkReports_Reverse: locks the report, requires a reason, applies inventory reversal
    // movements as a validated C# transaction, then flips the report to Reversed. Idempotent for an
    // already-Reversed report.
    public async Task<WorkReportLifecycleResultModel?> ReverseAsync(
        int workReportId, string reversalReason, int? reversedByUserId)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();

        try
        {
            var lifecycleStatus = await LockLifecycleStatusAsync(connection, transaction, workReportId);
            if (lifecycleStatus is null)
            {
                throw new InvalidOperationException("Work report not found.");
            }

            if (lifecycleStatus == "Draft")
            {
                throw new InvalidOperationException("A Draft report cannot be reversed.");
            }

            if (lifecycleStatus == "Finalized")
            {
                if (string.IsNullOrWhiteSpace(reversalReason))
                {
                    throw new InvalidOperationException("Reversal reason is required.");
                }

                await ApplyInventoryMovementsAsync(connection, transaction, workReportId, "ReportReversal", reversedByUserId);

                await using var update = connection.CreateCommand();
                update.Transaction = transaction;
                update.CommandText =
                    """
                    UPDATE "WorkReports"
                    SET "LifecycleStatus" = 'Reversed', "ReversedAt" = (now() at time zone 'utc'),
                        "ReversedByUserId" = @UserId, "ReversalReason" = @ReversalReason,
                        "UpdatedAt" = (now() at time zone 'utc'), "UpdatedByUserId" = @UserId
                    WHERE "WorkReportId" = @WorkReportId
                    """;
                AddParameter(update, "@UserId", (object?)reversedByUserId ?? DBNull.Value);
                AddParameter(update, "@ReversalReason", reversalReason);
                AddParameter(update, "@WorkReportId", workReportId);
                await update.ExecuteNonQueryAsync();
            }

            var result = await ReadLifecycleResultAsync(connection, transaction, workReportId);
            await transaction.CommitAsync();
            return result;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    // Service-refactor reimplementation of sp_InventoryStockMovements_ApplyForReport. Runs inside the
    // caller's transaction. Enforces the same guards (no double-usage, reversal requires matching usage,
    // reversal quantity must equal the immutable line), applies the per-item stock delta with the same
    // insufficient/inactive protection, and writes the immutable movement ledger idempotently.
    private static async Task ApplyInventoryMovementsAsync(
        DbConnection connection, DbTransaction transaction, int workReportId, string movementType, int? userId)
    {
        if (movementType is not ("ReportUsage" or "ReportReversal"))
        {
            throw new InvalidOperationException("Invalid movement type.");
        }

        if (movementType == "ReportUsage" && await ExistsAsync(connection, transaction,
                """
                SELECT 1 FROM "WorkReportInventoryItems" l
                JOIN "InventoryStockMovements" m
                  ON m."WorkReportInventoryItemId" = l."WorkReportInventoryItemId" AND m."MovementType" = 'ReportUsage'
                WHERE l."WorkReportId" = @id
                """, ("@id", workReportId)))
        {
            throw new InvalidOperationException("Draft report already has usage movements; manual repair is required.");
        }

        if (movementType == "ReportReversal" && await ExistsAsync(connection, transaction,
                """
                SELECT 1 FROM "WorkReportInventoryItems" l
                WHERE l."WorkReportId" = @id
                  AND NOT EXISTS (
                        SELECT 1 FROM "InventoryStockMovements" m
                        WHERE m."WorkReportInventoryItemId" = l."WorkReportInventoryItemId" AND m."MovementType" = 'ReportUsage'
                  )
                """, ("@id", workReportId)))
        {
            throw new InvalidOperationException("Cannot reverse inventory lines without matching usage movements.");
        }

        if (movementType == "ReportReversal" && await ExistsAsync(connection, transaction,
                """
                SELECT 1 FROM "WorkReportInventoryItems" l
                JOIN "InventoryStockMovements" m
                  ON m."WorkReportInventoryItemId" = l."WorkReportInventoryItemId" AND m."MovementType" = 'ReportUsage'
                WHERE l."WorkReportId" = @id AND m."QuantityDelta" <> -l."Quantity"
                """, ("@id", workReportId)))
        {
            throw new InvalidOperationException("Cannot reverse: usage movement quantity does not match its immutable report line.");
        }

        // Aggregate the required quantity per inventory item (fully materialized before any UPDATE, since
        // Npgsql does not allow a second command while a reader is open on the same connection).
        var requiredQuantities = new List<(int InventoryItemId, decimal Quantity)>();
        await using (var aggregate = connection.CreateCommand())
        {
            aggregate.Transaction = transaction;
            aggregate.CommandText =
                """
                SELECT "InventoryItemId", SUM("Quantity") AS "Quantity"
                FROM "WorkReportInventoryItems"
                WHERE "WorkReportId" = @id
                GROUP BY "InventoryItemId"
                ORDER BY "InventoryItemId"
                """;
            AddParameter(aggregate, "@id", workReportId);
            await using var reader = await aggregate.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                requiredQuantities.Add((Convert.ToInt32(reader.GetValue(0)), Convert.ToDecimal(reader.GetValue(1))));
            }
        }

        foreach (var (inventoryItemId, quantity) in requiredQuantities)
        {
            await using var applyStock = connection.CreateCommand();
            applyStock.Transaction = transaction;

            if (movementType == "ReportUsage")
            {
                applyStock.CommandText =
                    """
                    UPDATE "InventoryItems"
                    SET "QuantityOnHand" = "QuantityOnHand" - @Quantity, "UpdatedAt" = (now() at time zone 'utc')
                    WHERE "InventoryItemId" = @InventoryItemId AND "IsActive" = true AND "QuantityOnHand" >= @Quantity
                    """;
                AddParameter(applyStock, "@Quantity", quantity);
                AddParameter(applyStock, "@InventoryItemId", inventoryItemId);
                if (await applyStock.ExecuteNonQueryAsync() != 1)
                {
                    throw new InvalidOperationException("Insufficient or inactive inventory item; no stock was applied.");
                }
            }
            else
            {
                applyStock.CommandText =
                    """
                    UPDATE "InventoryItems"
                    SET "QuantityOnHand" = "QuantityOnHand" + @Quantity, "UpdatedAt" = (now() at time zone 'utc')
                    WHERE "InventoryItemId" = @InventoryItemId
                    """;
                AddParameter(applyStock, "@Quantity", quantity);
                AddParameter(applyStock, "@InventoryItemId", inventoryItemId);
                if (await applyStock.ExecuteNonQueryAsync() != 1)
                {
                    throw new InvalidOperationException("Inventory item missing during reversal.");
                }
            }
        }

        // Immutable ledger: one movement per report line without an existing movement of this type.
        await using var insertMovements = connection.CreateCommand();
        insertMovements.Transaction = transaction;
        insertMovements.CommandText =
            """
            INSERT INTO "InventoryStockMovements"
                ("InventoryItemId", "WorkReportInventoryItemId", "QuantityDelta", "MovementType",
                 "SourceType", "SourceId", "UsageType", "CreatedByUserId")
            SELECT l."InventoryItemId", l."WorkReportInventoryItemId",
                   CASE WHEN @MovementType = 'ReportUsage' THEN -l."Quantity" ELSE l."Quantity" END,
                   @MovementType, 'WorkReport', @WorkReportId, l."UsageType", @UserId
            FROM "WorkReportInventoryItems" l
            WHERE l."WorkReportId" = @WorkReportId
              AND NOT EXISTS (
                    SELECT 1 FROM "InventoryStockMovements" m
                    WHERE m."WorkReportInventoryItemId" = l."WorkReportInventoryItemId" AND m."MovementType" = @MovementType
              )
            """;
        AddParameter(insertMovements, "@MovementType", movementType);
        AddParameter(insertMovements, "@WorkReportId", workReportId);
        AddParameter(insertMovements, "@UserId", (object?)userId ?? DBNull.Value);
        await insertMovements.ExecuteNonQueryAsync();
    }

    private static async Task<string?> LockLifecycleStatusAsync(
        DbConnection connection, DbTransaction transaction, int workReportId)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """SELECT "LifecycleStatus" FROM "WorkReports" WHERE "WorkReportId" = @id FOR UPDATE""";
        AddParameter(command, "@id", workReportId);
        var result = await command.ExecuteScalarAsync();
        return result is null or DBNull ? null : result.ToString();
    }

    private static async Task<WorkReportLifecycleResultModel?> ReadLifecycleResultAsync(
        DbConnection connection, DbTransaction transaction, int workReportId)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            SELECT "WorkReportId", "Status", "LifecycleStatus", "FinalizedAt", "FinalizedByUserId",
                   "ReversedAt", "ReversedByUserId", "ReversalReason"
            FROM "WorkReports"
            WHERE "WorkReportId" = @id
            """;
        AddParameter(command, "@id", workReportId);

        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            return null;
        }

        return new WorkReportLifecycleResultModel
        {
            WorkReportId = GetInt(reader, "WorkReportId"),
            Status = GetString(reader, "Status"),
            LifecycleStatus = GetString(reader, "LifecycleStatus") ?? string.Empty,
            FinalizedAt = GetDateTime(reader, "FinalizedAt"),
            FinalizedByUserId = GetNullableInt(reader, "FinalizedByUserId"),
            ReversedAt = GetDateTime(reader, "ReversedAt"),
            ReversedByUserId = GetNullableInt(reader, "ReversedByUserId"),
            ReversalReason = GetString(reader, "ReversalReason")
        };
    }
}

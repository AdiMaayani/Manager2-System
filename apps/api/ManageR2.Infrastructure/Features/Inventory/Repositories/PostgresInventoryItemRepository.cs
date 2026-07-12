using System.Data.Common;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Interfaces;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Repositories;

// PostgreSQL implementation of the Inventory persistence (Wave 4). Reproduces the semantics of the
// dbo.sp_Inventory_* stored procedures — value normalization (btrim/NULLIF), required-field and
// non-negative guards, the active-SKU uniqueness rule, the canonical-category guard on
// create-with-image, and the previous-image reporting on set/clear — using ADO.NET over Npgsql.
public sealed class PostgresInventoryItemRepository : IInventoryItemRepository
{
    // Canonical categories: mirrors dbo.InventoryCategories / the sp_Inventory_CreateWithImage guard.
    private static readonly string[] CanonicalCategories =
    {
        "חשמל חכם",
        "מולטימדיה",
        "שו\"ב",
        "רשת מחשבים",
        "מצלמות אבטחה",
        "מערכות אזעקה",
        "טלפוניה ואינטרקום",
        "כבילה ותשתיות"
    };

    private readonly PostgresConnectionFactory _connectionFactory;
    private readonly ILogger<PostgresInventoryItemRepository> _logger;

    public PostgresInventoryItemRepository(
        PostgresConnectionFactory connectionFactory,
        ILogger<PostgresInventoryItemRepository> logger)
    {
        _connectionFactory = connectionFactory;
        _logger = logger;
    }

    // Mirrors sp_Inventory_GetList: normalized status/category/search filters, low-stock filter and
    // the IsActive DESC, ItemName ASC, InventoryItemId ASC ordering.
    public async Task<IEnumerable<InventoryItem>> GetListAsync(
        string? search,
        string? category,
        string? status,
        bool lowStockOnly)
    {
        var normalizedStatus = (NormalizeOrNull(status) ?? "active").ToLowerInvariant();
        if (normalizedStatus is not ("active" or "inactive" or "all"))
        {
            throw new UserValidationException("Status must be active, inactive, or all.");
        }

        var inventoryItems = new List<InventoryItem>();

        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT "InventoryItemId", "SkuCode", "ItemName", "Category", "QuantityOnHand", "Unit",
                       "MinimumQuantity", "LocationName", "Notes", "IsActive", "CreatedAt", "UpdatedAt",
                       "DeletedAt", "ImagePath", "ImageContentType", "ImageFileSizeBytes"
                FROM "InventoryItems"
                WHERE (
                        @Status = 'all'
                        OR (@Status = 'active' AND "IsActive" = true)
                        OR (@Status = 'inactive' AND "IsActive" = false)
                      )
                  AND (@Category::text IS NULL OR "Category" = @Category)
                  AND (@LowStockOnly = false OR ("MinimumQuantity" IS NOT NULL AND "QuantityOnHand" <= "MinimumQuantity"))
                  AND (
                        @Search::text IS NULL
                        OR "SkuCode" ILIKE '%' || @Search || '%'
                        OR "ItemName" ILIKE '%' || @Search || '%'
                        OR COALESCE("Category", '') ILIKE '%' || @Search || '%'
                        OR COALESCE("LocationName", '') ILIKE '%' || @Search || '%'
                        OR COALESCE("Notes", '') ILIKE '%' || @Search || '%'
                      )
                ORDER BY "IsActive" DESC, "ItemName" ASC, "InventoryItemId" ASC
                """;
            AddParameter(command, "@Status", normalizedStatus);
            AddParameter(command, "@Category", (object?)NormalizeOrNull(category) ?? DBNull.Value);
            AddParameter(command, "@LowStockOnly", lowStockOnly);
            AddParameter(command, "@Search", (object?)NormalizeOrNull(search) ?? DBNull.Value);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                inventoryItems.Add(MapInventoryItem(reader));
            }

            return inventoryItems;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "GetListAsync failed with SQL error for Inventory.");
            throw new UserValidationException("Failed to retrieve inventory items from the database.", ex);
        }
    }

    public async Task<InventoryItem?> GetByIdAsync(int inventoryItemId)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                SELECT "InventoryItemId", "SkuCode", "ItemName", "Category", "QuantityOnHand", "Unit",
                       "MinimumQuantity", "LocationName", "Notes", "IsActive", "CreatedAt", "UpdatedAt",
                       "DeletedAt", "ImagePath", "ImageContentType", "ImageFileSizeBytes"
                FROM "InventoryItems"
                WHERE "InventoryItemId" = @InventoryItemId
                """;
            AddParameter(command, "@InventoryItemId", inventoryItemId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            return await reader.ReadAsync() ? MapInventoryItem(reader) : null;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "GetByIdAsync failed with SQL error for InventoryItemId={InventoryItemId}.", inventoryItemId);
            throw new UserValidationException("Failed to retrieve the requested inventory item.", ex);
        }
    }

    // Mirrors sp_Inventory_Create: required-field/non-negative guards, active-SKU uniqueness, insert.
    public async Task<int> CreateAsync(InventoryItem inventoryItem)
    {
        var sku = NormalizeOrNull(inventoryItem.SkuCode) ?? throw new UserValidationException("SkuCode is required.");
        var itemName = NormalizeOrNull(inventoryItem.ItemName) ?? throw new UserValidationException("ItemName is required.");
        var unit = NormalizeOrNull(inventoryItem.Unit) ?? throw new UserValidationException("Unit is required.");
        ValidateQuantities(inventoryItem);

        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await connection.OpenAsync();

            if (inventoryItem.IsActive && await ActiveSkuExistsAsync(connection, null, sku, null))
            {
                throw new UserValidationException("An active inventory item with this SKU already exists.");
            }

            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                INSERT INTO "InventoryItems"
                    ("SkuCode", "ItemName", "Category", "QuantityOnHand", "Unit", "MinimumQuantity",
                     "LocationName", "Notes", "IsActive", "CreatedAt")
                VALUES
                    (@SkuCode, @ItemName, @Category, @QuantityOnHand, @Unit, @MinimumQuantity,
                     @LocationName, @Notes, @IsActive, (now() at time zone 'utc'))
                RETURNING "InventoryItemId"
                """;
            AddUpsertParameters(command, inventoryItem, sku, itemName, unit);

            var result = await command.ExecuteScalarAsync();
            return result is null or DBNull ? 0 : Convert.ToInt32(result);
        }
        catch (DbException ex) when (IsUniqueViolation(ex))
        {
            _logger.LogWarning(ex, "CreateAsync failed for SkuCode={SkuCode} because it already exists.", sku);
            throw new UserValidationException("An active inventory item with this SKU already exists.", ex);
        }
        catch (DbException ex) when (IsCheckViolation(ex))
        {
            throw new UserValidationException("Failed to create inventory item because one or more values are invalid.", ex);
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "CreateAsync failed with SQL error for SkuCode={SkuCode}.", sku);
            throw new UserValidationException("Failed to create inventory item.", ex);
        }
    }

    // Mirrors sp_Inventory_CreateWithImage: same guards plus canonical-category and image-metadata
    // validation, committing a complete row (item + image columns) atomically.
    public async Task<int> CreateWithImageAsync(InventoryItem inventoryItem)
    {
        var sku = NormalizeOrNull(inventoryItem.SkuCode) ?? throw new UserValidationException("SkuCode is required.");
        var itemName = NormalizeOrNull(inventoryItem.ItemName) ?? throw new UserValidationException("ItemName is required.");
        var unit = NormalizeOrNull(inventoryItem.Unit) ?? throw new UserValidationException("Unit is required.");
        ValidateQuantities(inventoryItem);

        var imagePath = NormalizeOrNull(inventoryItem.ImagePath) ?? throw new UserValidationException("ImagePath is required.");
        if (inventoryItem.ImageFileSizeBytes is < 0)
        {
            throw new UserValidationException("ImageFileSizeBytes cannot be negative.");
        }

        var category = NormalizeOrNull(inventoryItem.Category);
        if (category is null || Array.IndexOf(CanonicalCategories, category) < 0)
        {
            throw new UserValidationException("Category must be one of the supported inventory categories.");
        }

        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await connection.OpenAsync();
            await using var transaction = await connection.BeginTransactionAsync();

            if (inventoryItem.IsActive && await ActiveSkuExistsAsync(connection, transaction, sku, null))
            {
                throw new UserValidationException("An active inventory item with this SKU already exists.");
            }

            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText =
                """
                INSERT INTO "InventoryItems"
                    ("SkuCode", "ItemName", "Category", "QuantityOnHand", "Unit", "MinimumQuantity",
                     "LocationName", "Notes", "IsActive", "CreatedAt", "ImagePath", "ImageContentType", "ImageFileSizeBytes")
                VALUES
                    (@SkuCode, @ItemName, @Category, @QuantityOnHand, @Unit, @MinimumQuantity,
                     @LocationName, @Notes, @IsActive, (now() at time zone 'utc'), @ImagePath, @ImageContentType, @ImageFileSizeBytes)
                RETURNING "InventoryItemId"
                """;
            AddUpsertParameters(command, inventoryItem, sku, itemName, unit, category);
            AddParameter(command, "@ImagePath", imagePath);
            AddParameter(command, "@ImageContentType", (object?)NormalizeOrNull(inventoryItem.ImageContentType) ?? DBNull.Value);
            AddParameter(command, "@ImageFileSizeBytes", (object?)inventoryItem.ImageFileSizeBytes ?? DBNull.Value);

            var result = await command.ExecuteScalarAsync();
            await transaction.CommitAsync();
            return result is null or DBNull ? 0 : Convert.ToInt32(result);
        }
        catch (DbException ex) when (IsUniqueViolation(ex))
        {
            _logger.LogWarning(ex, "CreateWithImageAsync failed for SkuCode={SkuCode} because it already exists.", sku);
            throw new UserValidationException("An active inventory item with this SKU already exists.", ex);
        }
        catch (DbException ex) when (IsCheckViolation(ex))
        {
            throw new UserValidationException("Failed to create inventory item because one or more values are invalid.", ex);
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "CreateWithImageAsync failed with SQL error for SkuCode={SkuCode}.", sku);
            throw new UserValidationException("Failed to create inventory item.", ex);
        }
    }

    // Mirrors sp_Inventory_Update: guards, active-SKU uniqueness excluding self, DeletedAt reconciliation.
    public async Task<bool> UpdateAsync(InventoryItem inventoryItem)
    {
        var sku = NormalizeOrNull(inventoryItem.SkuCode) ?? throw new UserValidationException("SkuCode is required.");
        var itemName = NormalizeOrNull(inventoryItem.ItemName) ?? throw new UserValidationException("ItemName is required.");
        var unit = NormalizeOrNull(inventoryItem.Unit) ?? throw new UserValidationException("Unit is required.");
        ValidateQuantities(inventoryItem);

        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await connection.OpenAsync();

            if (inventoryItem.IsActive && await ActiveSkuExistsAsync(connection, null, sku, inventoryItem.InventoryItemId))
            {
                throw new UserValidationException("An active inventory item with this SKU already exists.");
            }

            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                UPDATE "InventoryItems"
                SET "SkuCode" = @SkuCode,
                    "ItemName" = @ItemName,
                    "Category" = @Category,
                    "QuantityOnHand" = @QuantityOnHand,
                    "Unit" = @Unit,
                    "MinimumQuantity" = @MinimumQuantity,
                    "LocationName" = @LocationName,
                    "Notes" = @Notes,
                    "IsActive" = @IsActive,
                    "UpdatedAt" = (now() at time zone 'utc'),
                    "DeletedAt" = CASE WHEN @IsActive = true THEN NULL
                                       ELSE COALESCE("DeletedAt", (now() at time zone 'utc')) END
                WHERE "InventoryItemId" = @InventoryItemId
                """;
            AddUpsertParameters(command, inventoryItem, sku, itemName, unit);
            AddParameter(command, "@InventoryItemId", inventoryItem.InventoryItemId);

            var rowsAffected = await command.ExecuteNonQueryAsync();
            return rowsAffected > 0;
        }
        catch (DbException ex) when (IsUniqueViolation(ex))
        {
            _logger.LogWarning(ex, "UpdateAsync failed for SkuCode={SkuCode} because it already exists.", sku);
            throw new UserValidationException("An active inventory item with this SKU already exists.", ex);
        }
        catch (DbException ex) when (IsCheckViolation(ex))
        {
            throw new UserValidationException("Failed to update inventory item because one or more values are invalid.", ex);
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "UpdateAsync failed with SQL error for InventoryItemId={InventoryItemId}.", inventoryItem.InventoryItemId);
            throw new UserValidationException("Failed to update inventory item.", ex);
        }
    }

    // Mirrors sp_Inventory_Deactivate: soft-delete of an active row only.
    public async Task<bool> DeactivateAsync(int inventoryItemId)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                UPDATE "InventoryItems"
                SET "IsActive" = false,
                    "UpdatedAt" = (now() at time zone 'utc'),
                    "DeletedAt" = (now() at time zone 'utc')
                WHERE "InventoryItemId" = @InventoryItemId AND "IsActive" = true
                """;
            AddParameter(command, "@InventoryItemId", inventoryItemId);

            await connection.OpenAsync();
            var rowsAffected = await command.ExecuteNonQueryAsync();
            return rowsAffected > 0;
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "DeactivateAsync failed with SQL error for InventoryItemId={InventoryItemId}.", inventoryItemId);
            throw new UserValidationException("Failed to deactivate inventory item.", ex);
        }
    }

    // Mirrors sp_Inventory_SetImage: OUTPUT deleted.ImagePath -> previous path via a CTE snapshot.
    public async Task<InventoryImageMutationResult> SetImageAsync(
        int inventoryItemId,
        string imagePath,
        string? imageContentType,
        long? imageFileSizeBytes)
    {
        var normalizedImagePath = NormalizeOrNull(imagePath) ?? throw new UserValidationException("ImagePath is required.");
        if (imageFileSizeBytes is < 0)
        {
            throw new UserValidationException("ImageFileSizeBytes cannot be negative.");
        }

        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                WITH prev AS (
                    SELECT "InventoryItemId", "ImagePath" AS "PreviousImagePath"
                    FROM "InventoryItems"
                    WHERE "InventoryItemId" = @InventoryItemId
                )
                UPDATE "InventoryItems" i
                SET "ImagePath" = @ImagePath,
                    "ImageContentType" = @ImageContentType,
                    "ImageFileSizeBytes" = @ImageFileSizeBytes,
                    "UpdatedAt" = (now() at time zone 'utc')
                FROM prev
                WHERE i."InventoryItemId" = prev."InventoryItemId"
                RETURNING prev."PreviousImagePath"
                """;
            AddParameter(command, "@InventoryItemId", inventoryItemId);
            AddParameter(command, "@ImagePath", normalizedImagePath);
            AddParameter(command, "@ImageContentType", (object?)NormalizeOrNull(imageContentType) ?? DBNull.Value);
            AddParameter(command, "@ImageFileSizeBytes", (object?)imageFileSizeBytes ?? DBNull.Value);

            await connection.OpenAsync();
            return await ReadImageMutationResultAsync(command);
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "SetImageAsync failed with SQL error for InventoryItemId={InventoryItemId}.", inventoryItemId);
            throw new UserValidationException("Failed to save the inventory item image.", ex);
        }
    }

    // Mirrors sp_Inventory_ClearImage: only rows that currently have an image are cleared.
    public async Task<InventoryImageMutationResult> ClearImageAsync(int inventoryItemId)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                WITH prev AS (
                    SELECT "InventoryItemId", "ImagePath" AS "PreviousImagePath"
                    FROM "InventoryItems"
                    WHERE "InventoryItemId" = @InventoryItemId AND "ImagePath" IS NOT NULL
                )
                UPDATE "InventoryItems" i
                SET "ImagePath" = NULL,
                    "ImageContentType" = NULL,
                    "ImageFileSizeBytes" = NULL,
                    "UpdatedAt" = (now() at time zone 'utc')
                FROM prev
                WHERE i."InventoryItemId" = prev."InventoryItemId"
                RETURNING prev."PreviousImagePath"
                """;
            AddParameter(command, "@InventoryItemId", inventoryItemId);

            await connection.OpenAsync();
            return await ReadImageMutationResultAsync(command);
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "ClearImageAsync failed with SQL error for InventoryItemId={InventoryItemId}.", inventoryItemId);
            throw new UserValidationException("Failed to remove the inventory item image.", ex);
        }
    }

    // Mirrors sp_Inventory_GetBySku: active row by normalized SKU; returns the reduced column set.
    public async Task<InventoryItem?> GetBySkuAsync(string skuCode)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT "InventoryItemId", "SkuCode", "ItemName", "Category", "QuantityOnHand", "Unit",
                   "MinimumQuantity", "LocationName", "Notes", "IsActive"
            FROM "InventoryItems"
            WHERE "IsActive" = true AND "SkuCode" = @SkuCode
            """;
        AddParameter(command, "@SkuCode", (object?)NormalizeOrNull(skuCode) ?? DBNull.Value);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        return await reader.ReadAsync() ? MapInventoryItem(reader) : null;
    }

    private static async Task<InventoryImageMutationResult> ReadImageMutationResultAsync(DbCommand command)
    {
        await using var reader = await command.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            var previousImagePath = reader.IsDBNull(0) ? null : reader.GetString(0);
            return new InventoryImageMutationResult(true, previousImagePath);
        }

        return new InventoryImageMutationResult(false, null);
    }

    private static async Task<bool> ActiveSkuExistsAsync(
        DbConnection connection, DbTransaction? transaction, string sku, int? excludeInventoryItemId)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            SELECT 1 FROM "InventoryItems"
            WHERE "SkuCode" = @SkuCode AND "IsActive" = true
              AND (@ExcludeId::int IS NULL OR "InventoryItemId" <> @ExcludeId)
            LIMIT 1
            """;
        AddParameter(command, "@SkuCode", sku);
        AddParameter(command, "@ExcludeId", (object?)excludeInventoryItemId ?? DBNull.Value);
        var result = await command.ExecuteScalarAsync();
        return result is not null && result != DBNull.Value;
    }

    private static void ValidateQuantities(InventoryItem inventoryItem)
    {
        if (inventoryItem.QuantityOnHand < 0)
        {
            throw new UserValidationException("QuantityOnHand cannot be negative.");
        }

        if (inventoryItem.MinimumQuantity is < 0)
        {
            throw new UserValidationException("MinimumQuantity cannot be negative.");
        }
    }

    private static void AddUpsertParameters(
        DbCommand command, InventoryItem inventoryItem, string sku, string itemName, string unit, string? categoryOverride = null)
    {
        AddParameter(command, "@SkuCode", sku);
        AddParameter(command, "@ItemName", itemName);
        AddParameter(command, "@Category", (object?)(categoryOverride ?? NormalizeOrNull(inventoryItem.Category)) ?? DBNull.Value);
        AddParameter(command, "@QuantityOnHand", inventoryItem.QuantityOnHand);
        AddParameter(command, "@Unit", unit);
        AddParameter(command, "@MinimumQuantity", (object?)inventoryItem.MinimumQuantity ?? DBNull.Value);
        AddParameter(command, "@LocationName", (object?)NormalizeOrNull(inventoryItem.LocationName) ?? DBNull.Value);
        AddParameter(command, "@Notes", (object?)NormalizeOrNull(inventoryItem.Notes) ?? DBNull.Value);
        AddParameter(command, "@IsActive", inventoryItem.IsActive);
    }

    private static string? NormalizeOrNull(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    private static bool IsUniqueViolation(DbException ex) => ex.SqlState == "23505";

    private static bool IsCheckViolation(DbException ex) => ex.SqlState is "23514" or "23503";

    private static void AddParameter(DbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }

    private static InventoryItem MapInventoryItem(DbDataReader reader)
    {
        return new InventoryItem
        {
            InventoryItemId = GetInt(reader, "InventoryItemId"),
            SkuCode = GetString(reader, "SkuCode") ?? string.Empty,
            ItemName = GetString(reader, "ItemName") ?? string.Empty,
            Category = GetString(reader, "Category"),
            QuantityOnHand = GetDecimal(reader, "QuantityOnHand"),
            Unit = GetString(reader, "Unit") ?? string.Empty,
            MinimumQuantity = GetNullableDecimal(reader, "MinimumQuantity"),
            LocationName = GetString(reader, "LocationName"),
            Notes = GetString(reader, "Notes"),
            IsActive = GetBool(reader, "IsActive"),
            CreatedAt = GetDateTime(reader, "CreatedAt") ?? DateTime.MinValue,
            UpdatedAt = GetDateTime(reader, "UpdatedAt"),
            DeletedAt = GetDateTime(reader, "DeletedAt"),
            ImagePath = GetString(reader, "ImagePath"),
            ImageContentType = GetString(reader, "ImageContentType"),
            ImageFileSizeBytes = GetNullableLong(reader, "ImageFileSizeBytes")
        };
    }

    private static bool HasColumn(DbDataReader reader, string columnName)
    {
        for (var i = 0; i < reader.FieldCount; i++)
        {
            if (string.Equals(reader.GetName(i), columnName, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private static string? GetString(DbDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName))
        {
            return null;
        }

        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : reader.GetValue(ordinal)?.ToString();
    }

    private static int GetInt(DbDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName))
        {
            return 0;
        }

        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? 0 : Convert.ToInt32(reader.GetValue(ordinal));
    }

    private static decimal GetDecimal(DbDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName))
        {
            return 0m;
        }

        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? 0m : Convert.ToDecimal(reader.GetValue(ordinal));
    }

    private static decimal? GetNullableDecimal(DbDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName))
        {
            return null;
        }

        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : Convert.ToDecimal(reader.GetValue(ordinal));
    }

    private static long? GetNullableLong(DbDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName))
        {
            return null;
        }

        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : Convert.ToInt64(reader.GetValue(ordinal));
    }

    private static bool GetBool(DbDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName))
        {
            return false;
        }

        var ordinal = reader.GetOrdinal(columnName);
        return !reader.IsDBNull(ordinal) && Convert.ToBoolean(reader.GetValue(ordinal));
    }

    private static DateTime? GetDateTime(DbDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName))
        {
            return null;
        }

        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : Convert.ToDateTime(reader.GetValue(ordinal));
    }
}

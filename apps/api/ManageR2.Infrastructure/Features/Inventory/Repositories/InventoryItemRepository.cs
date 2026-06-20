using System.Data;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Interfaces;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Repositories;

// Inventory persistence: ADO.NET stored procedure calls only, no inline SQL.
public class InventoryItemRepository : IInventoryItemRepository
{
    private readonly DBServices _dbServices;
    private readonly ILogger<InventoryItemRepository> _logger;

    public InventoryItemRepository(DBServices dbServices, ILogger<InventoryItemRepository> logger)
    {
        _dbServices = dbServices;
        _logger = logger;
    }

    public async Task<IEnumerable<InventoryItem>> GetListAsync(
        string? search,
        string? category,
        string? status,
        bool lowStockOnly)
    {
        _logger.LogInformation(
            "GetListAsync started for Inventory. Search={Search}, Category={Category}, Status={Status}, LowStockOnly={LowStockOnly}.",
            search,
            category,
            status,
            lowStockOnly);

        var inventoryItems = new List<InventoryItem>();

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_Inventory_GetList", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@Search", (object?)search ?? DBNull.Value);
            command.Parameters.AddWithValue("@Category", (object?)category ?? DBNull.Value);
            command.Parameters.AddWithValue("@Status", (object?)status ?? DBNull.Value);
            command.Parameters.AddWithValue("@LowStockOnly", lowStockOnly);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                inventoryItems.Add(MapInventoryItem(reader));
            }

            _logger.LogInformation("GetListAsync succeeded for Inventory. Returned {Count} records.", inventoryItems.Count);

            return inventoryItems;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetListAsync failed with SQL error for Inventory.");
            throw new UserValidationException("Failed to retrieve inventory items from the database.", ex);
        }
    }

    public async Task<InventoryItem?> GetByIdAsync(int inventoryItemId)
    {
        _logger.LogInformation("GetByIdAsync started for InventoryItemId={InventoryItemId}.", inventoryItemId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_Inventory_GetById", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@InventoryItemId", inventoryItemId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                var inventoryItem = MapInventoryItem(reader);

                _logger.LogInformation("GetByIdAsync succeeded for InventoryItemId={InventoryItemId}.", inventoryItemId);

                return inventoryItem;
            }

            _logger.LogWarning("GetByIdAsync returned no record for InventoryItemId={InventoryItemId}.", inventoryItemId);

            return null;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "GetByIdAsync failed with SQL error for InventoryItemId={InventoryItemId}.", inventoryItemId);
            throw new UserValidationException("Failed to retrieve the requested inventory item.", ex);
        }
    }

    public async Task<int> CreateAsync(InventoryItem inventoryItem)
    {
        _logger.LogInformation(
            "CreateAsync started for Inventory SkuCode={SkuCode}, ItemName={ItemName}.",
            inventoryItem.SkuCode,
            inventoryItem.ItemName);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_Inventory_Create", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            AddUpsertParameters(command, inventoryItem, includeId: false);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var newInventoryItemId = result != null && result != DBNull.Value
                ? Convert.ToInt32(result)
                : 0;

            _logger.LogInformation("CreateAsync succeeded. Created InventoryItemId={InventoryItemId}.", newInventoryItemId);

            return newInventoryItemId;
        }
        catch (SqlException ex) when (ex.Number == 2601 || ex.Number == 2627)
        {
            _logger.LogWarning(ex, "CreateAsync failed for SkuCode={SkuCode} because it already exists.", inventoryItem.SkuCode);
            throw new UserValidationException("An active inventory item with this SKU already exists.", ex);
        }
        catch (SqlException ex) when (ex.Number == 547)
        {
            _logger.LogWarning(ex, "CreateAsync failed for SkuCode={SkuCode} because of a CHECK constraint.", inventoryItem.SkuCode);
            throw new UserValidationException("Failed to create inventory item because one or more values are invalid.", ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "CreateAsync failed with SQL error for SkuCode={SkuCode}.", inventoryItem.SkuCode);
            throw new UserValidationException("Failed to create inventory item.", ex);
        }
    }

    public async Task<int> CreateWithImageAsync(InventoryItem inventoryItem)
    {
        _logger.LogInformation(
            "CreateWithImageAsync started for Inventory SkuCode={SkuCode}, ItemName={ItemName}.",
            inventoryItem.SkuCode,
            inventoryItem.ItemName);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_Inventory_CreateWithImage", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            AddUpsertParameters(command, inventoryItem, includeId: false);
            command.Parameters.AddWithValue("@ImagePath", (object?)inventoryItem.ImagePath ?? DBNull.Value);
            command.Parameters.AddWithValue("@ImageContentType", (object?)inventoryItem.ImageContentType ?? DBNull.Value);
            command.Parameters.AddWithValue("@ImageFileSizeBytes", (object?)inventoryItem.ImageFileSizeBytes ?? DBNull.Value);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var newInventoryItemId = result != null && result != DBNull.Value
                ? Convert.ToInt32(result)
                : 0;

            _logger.LogInformation("CreateWithImageAsync succeeded. Created InventoryItemId={InventoryItemId}.", newInventoryItemId);

            return newInventoryItemId;
        }
        catch (SqlException ex) when (ex.Number == 51206 || ex.Number == 2601 || ex.Number == 2627)
        {
            // 51206 = the procedure's explicit active-SKU guard; 2601/2627 = the filtered unique index
            // (UX_InventoryItems_SkuCode_Active) firing on a concurrent insert. Both mean an active dup.
            _logger.LogWarning(ex, "CreateWithImageAsync failed for SkuCode={SkuCode} because it already exists.", inventoryItem.SkuCode);
            throw new UserValidationException("An active inventory item with this SKU already exists.", ex);
        }
        catch (SqlException ex) when (ex.Number == 547)
        {
            _logger.LogWarning(ex, "CreateWithImageAsync failed for SkuCode={SkuCode} because of a CHECK constraint.", inventoryItem.SkuCode);
            throw new UserValidationException("Failed to create inventory item because one or more values are invalid.", ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "CreateWithImageAsync failed with SQL error for SkuCode={SkuCode}.", inventoryItem.SkuCode);
            throw new UserValidationException("Failed to create inventory item.", ex);
        }
    }

    public async Task<bool> UpdateAsync(InventoryItem inventoryItem)
    {
        _logger.LogInformation(
            "UpdateAsync started for InventoryItemId={InventoryItemId}, SkuCode={SkuCode}.",
            inventoryItem.InventoryItemId,
            inventoryItem.SkuCode);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_Inventory_Update", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            AddUpsertParameters(command, inventoryItem, includeId: true);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value
                ? Convert.ToInt32(result)
                : 0;

            var updated = rowsAffected > 0;

            if (updated)
            {
                _logger.LogInformation("UpdateAsync succeeded for InventoryItemId={InventoryItemId}.", inventoryItem.InventoryItemId);
            }
            else
            {
                _logger.LogWarning("UpdateAsync affected 0 rows for InventoryItemId={InventoryItemId}.", inventoryItem.InventoryItemId);
            }

            return updated;
        }
        catch (SqlException ex) when (ex.Number == 2601 || ex.Number == 2627)
        {
            _logger.LogWarning(ex, "UpdateAsync failed for SkuCode={SkuCode} because it already exists.", inventoryItem.SkuCode);
            throw new UserValidationException("An active inventory item with this SKU already exists.", ex);
        }
        catch (SqlException ex) when (ex.Number == 547)
        {
            _logger.LogWarning(
                ex,
                "UpdateAsync failed for InventoryItemId={InventoryItemId} because of a CHECK constraint.",
                inventoryItem.InventoryItemId);

            throw new UserValidationException("Failed to update inventory item because one or more values are invalid.", ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "UpdateAsync failed with SQL error for InventoryItemId={InventoryItemId}.", inventoryItem.InventoryItemId);
            throw new UserValidationException("Failed to update inventory item.", ex);
        }
    }

    public async Task<bool> DeactivateAsync(int inventoryItemId)
    {
        _logger.LogInformation("DeactivateAsync started for InventoryItemId={InventoryItemId}.", inventoryItemId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_Inventory_Deactivate", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@InventoryItemId", inventoryItemId);

            await connection.OpenAsync();

            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value
                ? Convert.ToInt32(result)
                : 0;

            var deactivated = rowsAffected > 0;

            if (deactivated)
            {
                _logger.LogInformation("DeactivateAsync succeeded for InventoryItemId={InventoryItemId}.", inventoryItemId);
            }
            else
            {
                _logger.LogWarning("DeactivateAsync affected 0 rows for InventoryItemId={InventoryItemId}.", inventoryItemId);
            }

            return deactivated;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "DeactivateAsync failed with SQL error for InventoryItemId={InventoryItemId}.", inventoryItemId);
            throw new UserValidationException("Failed to deactivate inventory item.", ex);
        }
    }

    public async Task<InventoryImageMutationResult> SetImageAsync(
        int inventoryItemId,
        string imagePath,
        string? imageContentType,
        long? imageFileSizeBytes)
    {
        _logger.LogInformation("SetImageAsync started for InventoryItemId={InventoryItemId}.", inventoryItemId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_Inventory_SetImage", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@InventoryItemId", inventoryItemId);
            command.Parameters.AddWithValue("@ImagePath", imagePath);
            command.Parameters.AddWithValue("@ImageContentType", (object?)imageContentType ?? DBNull.Value);
            command.Parameters.AddWithValue("@ImageFileSizeBytes", (object?)imageFileSizeBytes ?? DBNull.Value);

            await connection.OpenAsync();

            var result = await ReadImageMutationResultAsync(command);

            _logger.LogInformation(
                "SetImageAsync completed for InventoryItemId={InventoryItemId}. ItemFound={ItemFound}.",
                inventoryItemId,
                result.ItemFound);

            return result;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "SetImageAsync failed with SQL error for InventoryItemId={InventoryItemId}.", inventoryItemId);
            throw new UserValidationException("Failed to save the inventory item image.", ex);
        }
    }

    public async Task<InventoryImageMutationResult> ClearImageAsync(int inventoryItemId)
    {
        _logger.LogInformation("ClearImageAsync started for InventoryItemId={InventoryItemId}.", inventoryItemId);

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_Inventory_ClearImage", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@InventoryItemId", inventoryItemId);

            await connection.OpenAsync();

            var result = await ReadImageMutationResultAsync(command);

            _logger.LogInformation(
                "ClearImageAsync completed for InventoryItemId={InventoryItemId}. RowsCleared={RowsCleared}.",
                inventoryItemId,
                result.ItemFound);

            return result;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "ClearImageAsync failed with SQL error for InventoryItemId={InventoryItemId}.", inventoryItemId);
            throw new UserValidationException("Failed to remove the inventory item image.", ex);
        }
    }

    private static async Task<InventoryImageMutationResult> ReadImageMutationResultAsync(SqlCommand command)
    {
        await using var reader = await command.ExecuteReaderAsync();

        if (await reader.ReadAsync())
        {
            var rowsAffected = GetIntValue(reader, "RowsAffected");
            var previousImagePath = GetStringValue(reader, "PreviousImagePath");
            return new InventoryImageMutationResult(rowsAffected > 0, previousImagePath);
        }

        return new InventoryImageMutationResult(false, null);
    }

    private static void AddUpsertParameters(SqlCommand command, InventoryItem inventoryItem, bool includeId)
    {
        if (includeId)
        {
            command.Parameters.AddWithValue("@InventoryItemId", inventoryItem.InventoryItemId);
        }

        command.Parameters.AddWithValue("@SkuCode", inventoryItem.SkuCode);
        command.Parameters.AddWithValue("@ItemName", inventoryItem.ItemName);
        command.Parameters.AddWithValue("@Category", (object?)inventoryItem.Category ?? DBNull.Value);
        command.Parameters.AddWithValue("@QuantityOnHand", inventoryItem.QuantityOnHand);
        command.Parameters.AddWithValue("@Unit", inventoryItem.Unit);
        command.Parameters.AddWithValue("@MinimumQuantity", (object?)inventoryItem.MinimumQuantity ?? DBNull.Value);
        command.Parameters.AddWithValue("@LocationName", (object?)inventoryItem.LocationName ?? DBNull.Value);
        command.Parameters.AddWithValue("@Notes", (object?)inventoryItem.Notes ?? DBNull.Value);
        command.Parameters.AddWithValue("@IsActive", inventoryItem.IsActive);
    }

    public async Task<InventoryItem?> GetBySkuAsync(string skuCode)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_Inventory_GetBySku", connection)
        {
            CommandType = CommandType.StoredProcedure
        };
        command.Parameters.AddWithValue("@SkuCode", skuCode);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        return await reader.ReadAsync() ? MapInventoryItem(reader) : null;
    }

    private static InventoryItem MapInventoryItem(SqlDataReader reader)
    {
        return new InventoryItem
        {
            InventoryItemId = GetIntValue(reader, "InventoryItemId"),
            SkuCode = GetStringValue(reader, "SkuCode") ?? string.Empty,
            ItemName = GetStringValue(reader, "ItemName") ?? string.Empty,
            Category = GetStringValue(reader, "Category"),
            QuantityOnHand = GetDecimalValue(reader, "QuantityOnHand"),
            Unit = GetStringValue(reader, "Unit") ?? string.Empty,
            MinimumQuantity = GetNullableDecimalValue(reader, "MinimumQuantity"),
            LocationName = GetStringValue(reader, "LocationName"),
            Notes = GetStringValue(reader, "Notes"),
            IsActive = GetBoolValue(reader, "IsActive"),
            CreatedAt = GetDateTimeValue(reader, "CreatedAt") ?? DateTime.MinValue,
            UpdatedAt = GetDateTimeValue(reader, "UpdatedAt"),
            DeletedAt = GetDateTimeValue(reader, "DeletedAt"),
            ImagePath = GetStringValue(reader, "ImagePath"),
            ImageContentType = GetStringValue(reader, "ImageContentType"),
            ImageFileSizeBytes = GetNullableLongValue(reader, "ImageFileSizeBytes")
        };
    }

    private static bool HasColumn(SqlDataReader reader, string columnName)
    {
        for (int i = 0; i < reader.FieldCount; i++)
        {
            if (string.Equals(reader.GetName(i), columnName, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private static string? GetStringValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return null;
        }

        return reader[columnName]?.ToString();
    }

    private static int GetIntValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return 0;
        }

        return Convert.ToInt32(reader[columnName]);
    }

    private static decimal GetDecimalValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return 0;
        }

        return Convert.ToDecimal(reader[columnName]);
    }

    private static decimal? GetNullableDecimalValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return null;
        }

        return Convert.ToDecimal(reader[columnName]);
    }

    private static long? GetNullableLongValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return null;
        }

        return Convert.ToInt64(reader[columnName]);
    }

    private static bool GetBoolValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return false;
        }

        return Convert.ToBoolean(reader[columnName]);
    }

    private static DateTime? GetDateTimeValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return null;
        }

        return Convert.ToDateTime(reader[columnName]);
    }
}

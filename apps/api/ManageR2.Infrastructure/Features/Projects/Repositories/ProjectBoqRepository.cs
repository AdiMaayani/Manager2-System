using System.Data;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Models;
using Microsoft.Data.SqlClient;

namespace ManageR2.Infrastructure.Repositories;

public class ProjectBoqRepository : IProjectBoqRepository
{
    private readonly DBServices _dbServices;

    public ProjectBoqRepository(DBServices dbServices)
    {
        _dbServices = dbServices;
    }

    public async Task<IReadOnlyList<ProjectBoqItemModel>> GetByProjectIdAsync(int projectId)
    {
        var boqItems = new List<ProjectBoqItemModel>();

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_ProjectBoq_GetByProject", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@ProjectId", projectId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                boqItems.Add(MapProjectBoqItem(reader));
            }

            return boqItems;
        }
        catch (SqlException ex)
        {
            throw new UserValidationException("Failed to retrieve project BOQ items.", ex);
        }
    }

    public async Task<int> CreateAsync(ProjectBoqItemModel boqItem)
    {
        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_ProjectBoq_Create", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@ProjectId", boqItem.ProjectId);
            command.Parameters.AddWithValue("@SystemName", (object?)boqItem.SystemName ?? DBNull.Value);
            command.Parameters.AddWithValue("@InventoryItemId", (object?)boqItem.InventoryItemId ?? DBNull.Value);
            command.Parameters.AddWithValue("@ItemDescription", boqItem.ItemDescription);
            command.Parameters.AddWithValue("@Quantity", boqItem.Quantity);
            command.Parameters.AddWithValue("@Unit", boqItem.Unit);
            command.Parameters.AddWithValue("@UnitPrice", (object?)boqItem.UnitPrice ?? DBNull.Value);
            command.Parameters.AddWithValue("@SortOrder", boqItem.SortOrder > 0 ? boqItem.SortOrder : DBNull.Value);

            await connection.OpenAsync();
            var result = await command.ExecuteScalarAsync();

            return result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;
        }
        catch (SqlException ex)
        {
            throw new UserValidationException("Failed to create project BOQ item.", ex);
        }
    }

    public async Task<bool> UpdateAsync(ProjectBoqItemModel boqItem)
    {
        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_ProjectBoq_Update", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@ProjectBoqItemId", boqItem.ProjectBoqItemId);
            command.Parameters.AddWithValue("@ProjectId", boqItem.ProjectId);
            command.Parameters.AddWithValue("@SystemName", (object?)boqItem.SystemName ?? DBNull.Value);
            command.Parameters.AddWithValue("@InventoryItemId", (object?)boqItem.InventoryItemId ?? DBNull.Value);
            command.Parameters.AddWithValue("@ItemDescription", boqItem.ItemDescription);
            command.Parameters.AddWithValue("@Quantity", boqItem.Quantity);
            command.Parameters.AddWithValue("@Unit", boqItem.Unit);
            command.Parameters.AddWithValue("@UnitPrice", (object?)boqItem.UnitPrice ?? DBNull.Value);
            command.Parameters.AddWithValue("@SortOrder", boqItem.SortOrder);

            await connection.OpenAsync();
            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;

            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            throw new UserValidationException("Failed to update project BOQ item.", ex);
        }
    }

    public async Task<bool> DeleteAsync(int projectId, int projectBoqItemId)
    {
        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_ProjectBoq_Delete", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@ProjectId", projectId);
            command.Parameters.AddWithValue("@ProjectBoqItemId", projectBoqItemId);

            await connection.OpenAsync();
            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;

            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            throw new UserValidationException("Failed to delete project BOQ item.", ex);
        }
    }

    public async Task<bool> ReorderAsync(
        int projectId,
        IReadOnlyList<ProjectBoqSortOrderModel> sortOrders)
    {
        if (sortOrders.Count == 0)
        {
            return true;
        }

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await connection.OpenAsync();
            await using var transaction = await connection.BeginTransactionAsync();

            foreach (var sortOrder in sortOrders)
            {
                await using var command = new SqlCommand("dbo.sp_ProjectBoq_Reorder", connection)
                {
                    CommandType = CommandType.StoredProcedure,
                    Transaction = (SqlTransaction)transaction
                };

                command.Parameters.AddWithValue("@ProjectId", projectId);
                command.Parameters.AddWithValue("@ProjectBoqItemId", sortOrder.ProjectBoqItemId);
                command.Parameters.AddWithValue("@SortOrder", sortOrder.SortOrder);

                var result = await command.ExecuteScalarAsync();
                var rowsAffected = result != null && result != DBNull.Value
                    ? Convert.ToInt32(result)
                    : 0;

                if (rowsAffected == 0)
                {
                    await transaction.RollbackAsync();
                    return false;
                }
            }

            await transaction.CommitAsync();
            return true;
        }
        catch (SqlException ex)
        {
            throw new UserValidationException("Failed to reorder project BOQ items.", ex);
        }
    }

    private static ProjectBoqItemModel MapProjectBoqItem(SqlDataReader reader)
    {
        return new ProjectBoqItemModel
        {
            ProjectBoqItemId = GetIntValue(reader, "ProjectBoqItemId"),
            ProjectId = GetIntValue(reader, "ProjectId"),
            SystemName = GetStringValue(reader, "SystemName"),
            InventoryItemId = GetNullableIntValue(reader, "InventoryItemId"),
            InventorySkuCode = GetStringValue(reader, "InventorySkuCode"),
            InventoryItemName = GetStringValue(reader, "InventoryItemName"),
            InventoryCategory = GetStringValue(reader, "InventoryCategory"),
            ItemDescription = GetStringValue(reader, "ItemDescription") ?? string.Empty,
            Quantity = GetDecimalValue(reader, "Quantity"),
            Unit = GetStringValue(reader, "Unit") ?? string.Empty,
            UnitPrice = GetNullableDecimalValue(reader, "UnitPrice"),
            SortOrder = GetIntValue(reader, "SortOrder"),
            CreatedAt = GetDateTimeValue(reader, "CreatedAt") ?? DateTime.MinValue,
            UpdatedAt = GetDateTimeValue(reader, "UpdatedAt")
        };
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

    private static decimal GetDecimalValue(SqlDataReader reader, string columnName)
    {
        return reader[columnName] == DBNull.Value ? 0 : Convert.ToDecimal(reader[columnName]);
    }

    private static decimal? GetNullableDecimalValue(SqlDataReader reader, string columnName)
    {
        return reader[columnName] == DBNull.Value ? null : Convert.ToDecimal(reader[columnName]);
    }

    private static DateTime? GetDateTimeValue(SqlDataReader reader, string columnName)
    {
        return reader[columnName] == DBNull.Value ? null : Convert.ToDateTime(reader[columnName]);
    }
}

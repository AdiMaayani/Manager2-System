using System.Data;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Models;
using Microsoft.Data.SqlClient;

namespace ManageR2.Infrastructure.Repositories;

public class ProjectEquipmentRepository : IProjectEquipmentRepository
{
    private readonly DBServices _dbServices;

    public ProjectEquipmentRepository(DBServices dbServices)
    {
        _dbServices = dbServices;
    }

    public async Task<IReadOnlyList<ProjectEquipmentItemModel>> GetByProjectIdAsync(int projectId)
    {
        var equipmentItems = new List<ProjectEquipmentItemModel>();

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_ProjectEquipment_GetByProject", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@ProjectId", projectId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                equipmentItems.Add(MapProjectEquipmentItem(reader));
            }

            return equipmentItems;
        }
        catch (SqlException ex)
        {
            throw new UserValidationException("Failed to retrieve project equipment.", ex);
        }
    }

    public async Task<int> CreateAsync(ProjectEquipmentItemModel equipmentItem)
    {
        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_ProjectEquipment_Create", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@ProjectId", equipmentItem.ProjectId);
            command.Parameters.AddWithValue("@InventoryItemId", (object?)equipmentItem.InventoryItemId ?? DBNull.Value);
            command.Parameters.AddWithValue("@EquipmentName", equipmentItem.EquipmentName);
            command.Parameters.AddWithValue("@Status", equipmentItem.Status);
            command.Parameters.AddWithValue("@Location", (object?)equipmentItem.Location ?? DBNull.Value);
            command.Parameters.AddWithValue("@SortOrder", equipmentItem.SortOrder > 0 ? equipmentItem.SortOrder : DBNull.Value);

            await connection.OpenAsync();
            var result = await command.ExecuteScalarAsync();

            return result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;
        }
        catch (SqlException ex)
        {
            throw new UserValidationException("Failed to create project equipment item.", ex);
        }
    }

    public async Task<bool> UpdateAsync(ProjectEquipmentItemModel equipmentItem)
    {
        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_ProjectEquipment_Update", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@ProjectEquipmentItemId", equipmentItem.ProjectEquipmentItemId);
            command.Parameters.AddWithValue("@ProjectId", equipmentItem.ProjectId);
            command.Parameters.AddWithValue("@InventoryItemId", (object?)equipmentItem.InventoryItemId ?? DBNull.Value);
            command.Parameters.AddWithValue("@EquipmentName", equipmentItem.EquipmentName);
            command.Parameters.AddWithValue("@Status", equipmentItem.Status);
            command.Parameters.AddWithValue("@Location", (object?)equipmentItem.Location ?? DBNull.Value);
            command.Parameters.AddWithValue("@SortOrder", equipmentItem.SortOrder);

            await connection.OpenAsync();
            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;

            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            throw new UserValidationException("Failed to update project equipment item.", ex);
        }
    }

    public async Task<bool> DeleteAsync(int projectId, int projectEquipmentItemId)
    {
        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_ProjectEquipment_Delete", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@ProjectId", projectId);
            command.Parameters.AddWithValue("@ProjectEquipmentItemId", projectEquipmentItemId);

            await connection.OpenAsync();
            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;

            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            throw new UserValidationException("Failed to delete project equipment item.", ex);
        }
    }

    public async Task<bool> ReorderAsync(
        int projectId,
        IReadOnlyList<ProjectEquipmentSortOrderModel> sortOrders)
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
                await using var command = new SqlCommand("dbo.sp_ProjectEquipment_Reorder", connection)
                {
                    CommandType = CommandType.StoredProcedure,
                    Transaction = (SqlTransaction)transaction
                };

                command.Parameters.AddWithValue("@ProjectId", projectId);
                command.Parameters.AddWithValue(
                    "@ProjectEquipmentItemId",
                    sortOrder.ProjectEquipmentItemId);
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
            throw new UserValidationException("Failed to reorder project equipment items.", ex);
        }
    }

    private static ProjectEquipmentItemModel MapProjectEquipmentItem(SqlDataReader reader)
    {
        return new ProjectEquipmentItemModel
        {
            ProjectEquipmentItemId = GetIntValue(reader, "ProjectEquipmentItemId"),
            ProjectId = GetIntValue(reader, "ProjectId"),
            InventoryItemId = GetNullableIntValue(reader, "InventoryItemId"),
            InventorySkuCode = GetStringValue(reader, "InventorySkuCode"),
            InventoryItemName = GetStringValue(reader, "InventoryItemName"),
            InventoryCategory = GetStringValue(reader, "InventoryCategory"),
            EquipmentName = GetStringValue(reader, "EquipmentName") ?? string.Empty,
            Status = GetStringValue(reader, "Status") ?? string.Empty,
            Location = GetStringValue(reader, "Location"),
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

    private static DateTime? GetDateTimeValue(SqlDataReader reader, string columnName)
    {
        return reader[columnName] == DBNull.Value ? null : Convert.ToDateTime(reader[columnName]);
    }
}

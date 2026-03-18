using System.Data;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.DAL;
using Microsoft.Data.SqlClient;

namespace ManageR2.Infrastructure.Repositories;

public class WorkItemRepository : IWorkItemRepository
{
    private readonly DBServices _dbServices;

    public WorkItemRepository(DBServices dbServices)
    {
        _dbServices = dbServices;
    }

    public async Task<List<WorkItem>> GetWorkItemsAsync()
    {
        var workItems = new List<WorkItem>();

        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("sp_GetWorkItems", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            workItems.Add(MapWorkItem(reader));
        }

        return workItems;
    }

    public async Task<List<WorkItem>> GetByTypeAsync(string workType)
    {
        var workItems = new List<WorkItem>();

        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("sp_GetWorkItemsByType", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        command.Parameters.AddWithValue("@WorkType", workType);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            workItems.Add(MapWorkItem(reader));
        }

        return workItems;
    }

    public async Task<bool> UpdateAsync(WorkItem workItem)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("sp_UpdateWorkItem", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        command.Parameters.AddWithValue("@WorkItemId", workItem.WorkItemId);
        command.Parameters.AddWithValue("@Title", workItem.Title ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@Description", workItem.Description ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@WorkType", workItem.WorkType ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@BillingType", workItem.BillingType ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@Status", workItem.Status ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@CustomerId", workItem.CustomerId);
        command.Parameters.AddWithValue("@SiteId", workItem.SiteId);

        await connection.OpenAsync();

        var result = await command.ExecuteScalarAsync();
        var rowsAffected = result != null ? Convert.ToInt32(result) : 0;

        return rowsAffected > 0;
    }

    public async Task<bool> CloseAsync(int workItemId)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("sp_CloseWorkItem", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        command.Parameters.AddWithValue("@WorkItemId", workItemId);

        await connection.OpenAsync();

        var result = await command.ExecuteScalarAsync();
        var rowsAffected = result != null ? Convert.ToInt32(result) : 0;

        return rowsAffected > 0;
    }

    private static WorkItem MapWorkItem(SqlDataReader reader)
    {
        return new WorkItem
        {
            WorkItemId = reader["WorkItemId"] != DBNull.Value ? Convert.ToInt32(reader["WorkItemId"]) : 0,
            Title = reader["Title"] != DBNull.Value ? reader["Title"].ToString()! : string.Empty,
            Description = reader["Description"] != DBNull.Value ? reader["Description"].ToString()! : string.Empty,
            WorkType = reader["WorkType"] != DBNull.Value ? reader["WorkType"].ToString()! : string.Empty,
            BillingType = reader["BillingType"] != DBNull.Value ? reader["BillingType"].ToString()! : string.Empty,
            Status = reader["Status"] != DBNull.Value ? reader["Status"].ToString()! : string.Empty,
            CustomerId = reader["CustomerId"] != DBNull.Value ? Convert.ToInt32(reader["CustomerId"]) : 0,
            SiteId = reader["SiteId"] != DBNull.Value ? Convert.ToInt32(reader["SiteId"]) : 0,
            CreatedAt = reader["CreatedAt"] != DBNull.Value ? Convert.ToDateTime(reader["CreatedAt"]) : DateTime.MinValue,
            ClosedAt = reader["ClosedAt"] != DBNull.Value ? Convert.ToDateTime(reader["ClosedAt"]) : null
        };
    }
}
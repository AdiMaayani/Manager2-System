using System.Data;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Repositories;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace ManageR2.Infrastructure.Repositories;

public class WorkItemRepository : IWorkItemRepository
{
    private readonly string _connectionString;

    public WorkItemRepository(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("DefaultConnection connection string was not found.");
    }

    public async Task<List<WorkItem>> GetWorkItemsAsync()
    {
        var workItems = new List<WorkItem>();

        await using var connection = new SqlConnection(_connectionString);
        await using var command = new SqlCommand("sp_GetWorkItems", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        await connection.OpenAsync();

        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            var workItem = new WorkItem
            {
                WorkItemId = HasColumn(reader, "WorkItemId") && reader["WorkItemId"] != DBNull.Value
                    ? Convert.ToInt32(reader["WorkItemId"])
                    : 0,

                Title = HasColumn(reader, "Title") && reader["Title"] != DBNull.Value
                    ? reader["Title"]?.ToString() ?? string.Empty
                    : string.Empty,

                Description = HasColumn(reader, "Description") && reader["Description"] != DBNull.Value
                    ? reader["Description"]?.ToString()
                    : null,

                Status = HasColumn(reader, "Status") && reader["Status"] != DBNull.Value
                    ? reader["Status"]?.ToString()
                    : null,

                Priority = HasColumn(reader, "Priority") && reader["Priority"] != DBNull.Value
                    ? reader["Priority"]?.ToString()
                    : null,

                CustomerId = HasColumn(reader, "CustomerId") && reader["CustomerId"] != DBNull.Value
                    ? Convert.ToInt32(reader["CustomerId"])
                    : 0,

                SiteId = HasColumn(reader, "SiteId") && reader["SiteId"] != DBNull.Value
                    ? Convert.ToInt32(reader["SiteId"])
                    : 0,

                CreatedAt = HasColumn(reader, "CreatedAt") && reader["CreatedAt"] != DBNull.Value
                    ? Convert.ToDateTime(reader["CreatedAt"])
                    : DateTime.MinValue
            };

            workItems.Add(workItem);
        }

        return workItems;
    }

    private static bool HasColumn(SqlDataReader reader, string columnName)
    {
        for (int i = 0; i < reader.FieldCount; i++)
        {
            if (reader.GetName(i).Equals(columnName, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }
}
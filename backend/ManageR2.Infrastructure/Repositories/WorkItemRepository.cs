using System.Data;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Models;
using Microsoft.Data.SqlClient;

namespace ManageR2.Infrastructure.Repositories;

public class WorkItemRepository : IWorkItemRepository
{
    private readonly DBServices _dbServices;

    public WorkItemRepository(DBServices dbServices)
    {
        _dbServices = dbServices;
    }

    public async Task<List<WorkItem>> GetAllAsync()
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

    public async Task<WorkItem?> GetByIdAsync(int workItemId)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("sp_GetWorkItemDetails", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        command.Parameters.AddWithValue("@WorkItemId", workItemId);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();

        if (await reader.ReadAsync())
        {
            return MapWorkItem(reader);
        }

        return null;
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

    public async Task<List<WorkItem>> GetTasksByParentIdAsync(int parentWorkItemId)
    {
        var workItems = new List<WorkItem>();

        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand(
            @"SELECT 
                  WorkItemId,
                  Title,
                  Description,
                  WorkType,
                  BillingType,
                  Status,
                  CustomerId,
                  SiteId,
                  CreatedAt,
                  ClosedAt,
                  ParentWorkItemId
              FROM dbo.WorkItems
              WHERE ParentWorkItemId = @ParentWorkItemId
              ORDER BY CreatedAt DESC",
            connection)
        {
            CommandType = CommandType.Text
        };

        command.Parameters.AddWithValue("@ParentWorkItemId", parentWorkItemId);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            workItems.Add(MapWorkItem(reader));
        }

        return workItems;
    }

    public async Task<int> CreateAsync(WorkItem workItem)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("sp_CreateWorkItem", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        command.Parameters.AddWithValue("@Title", workItem.Title ?? string.Empty);
        command.Parameters.AddWithValue("@WorkType", workItem.WorkType ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@Status", workItem.Status ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@BillingType", workItem.BillingType ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@Description", workItem.Description ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@CustomerId", workItem.CustomerId);
        command.Parameters.AddWithValue("@SiteId", workItem.SiteId);
        command.Parameters.AddWithValue("@ParentWorkItemId", workItem.ParentWorkItemId ?? (object)DBNull.Value);

        await connection.OpenAsync();

        var result = await command.ExecuteScalarAsync();
        var newWorkItemId = result != null ? Convert.ToInt32(result) : 0;

        return newWorkItemId;
    }

    public async Task<bool> UpdateAsync(int id, WorkItem workItem)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("sp_UpdateWorkItem", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        command.Parameters.AddWithValue("@WorkItemId", id);
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

    public async Task<bool> AssignEmployeeToWorkAsync(int workItemId, int employeeId, string assignmentRole)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("sp_AssignEmployeeToWork", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        command.Parameters.AddWithValue("@WorkItemId", workItemId);
        command.Parameters.AddWithValue("@EmployeeId", employeeId);
        command.Parameters.AddWithValue("@AssignmentRole", assignmentRole);

        await connection.OpenAsync();
        await command.ExecuteNonQueryAsync();

        return true;
    }

    public async Task<bool> AssignContractorToWorkAsync(int workItemId, int contractorId, string assignmentRole)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("sp_AssignContractorToWork", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        command.Parameters.AddWithValue("@WorkItemId", workItemId);
        command.Parameters.AddWithValue("@ContractorId", contractorId);
        command.Parameters.AddWithValue("@AssignmentRole", assignmentRole);

        await connection.OpenAsync();
        await command.ExecuteNonQueryAsync();

        return true;
    }

    public async Task<bool> EmployeeExistsAsync(int employeeId)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand(
            "SELECT COUNT(1) FROM dbo.Employees WHERE EmployeeId = @EmployeeId",
            connection)
        {
            CommandType = CommandType.Text
        };

        command.Parameters.AddWithValue("@EmployeeId", employeeId);

        await connection.OpenAsync();

        var result = await command.ExecuteScalarAsync();
        var count = result != null ? Convert.ToInt32(result) : 0;

        return count > 0;
    }

    public async Task<bool> ContractorExistsAsync(int contractorId)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand(
            "SELECT COUNT(1) FROM dbo.Contractors WHERE ContractorId = @ContractorId",
            connection)
        {
            CommandType = CommandType.Text
        };

        command.Parameters.AddWithValue("@ContractorId", contractorId);

        await connection.OpenAsync();

        var result = await command.ExecuteScalarAsync();
        var count = result != null ? Convert.ToInt32(result) : 0;

        return count > 0;
    }

    public async Task<WorkPlanResult?> GetWorkPlanAsync(int projectId)
    {
        await using var connection = _dbServices.CreateConnection();
        await connection.OpenAsync();

        WorkItem? project = null;
        var tasks = new List<WorkItem>();
        var assignments = new List<WorkPlanAssignmentResult>();

        await using (var projectCommand = new SqlCommand(
            @"SELECT 
                  WorkItemId,
                  Title,
                  Description,
                  WorkType,
                  BillingType,
                  Status,
                  CustomerId,
                  SiteId,
                  CreatedAt,
                  ClosedAt,
                  ParentWorkItemId
              FROM dbo.WorkItems
              WHERE WorkItemId = @ProjectId",
            connection))
        {
            projectCommand.CommandType = CommandType.Text;
            projectCommand.Parameters.AddWithValue("@ProjectId", projectId);

            await using var projectReader = await projectCommand.ExecuteReaderAsync();

            if (await projectReader.ReadAsync())
            {
                project = MapWorkItem(projectReader);
            }
        }

        if (project == null)
        {
            return null;
        }

        await using (var tasksCommand = new SqlCommand(
            @"SELECT 
                  WorkItemId,
                  Title,
                  Description,
                  WorkType,
                  BillingType,
                  Status,
                  CustomerId,
                  SiteId,
                  CreatedAt,
                  ClosedAt,
                  ParentWorkItemId
              FROM dbo.WorkItems
              WHERE ParentWorkItemId = @ProjectId
              ORDER BY CreatedAt DESC",
            connection))
        {
            tasksCommand.CommandType = CommandType.Text;
            tasksCommand.Parameters.AddWithValue("@ProjectId", projectId);

            await using var tasksReader = await tasksCommand.ExecuteReaderAsync();

            while (await tasksReader.ReadAsync())
            {
                tasks.Add(MapWorkItem(tasksReader));
            }
        }

        await using (var assignmentsCommand = new SqlCommand(
            @";WITH RelevantWorkItems AS
              (
                  SELECT WorkItemId
                  FROM dbo.WorkItems
                  WHERE WorkItemId = @ProjectId

                  UNION

                  SELECT WorkItemId
                  FROM dbo.WorkItems
                  WHERE ParentWorkItemId = @ProjectId
              )
              SELECT 
                  wea.WorkItemId,
                  wea.EmployeeId,
                  CAST(NULL AS INT) AS ContractorId,
                  CAST('Employee' AS NVARCHAR(50)) AS AssignmentType
              FROM dbo.WorkEmployeeAssignments wea
              INNER JOIN RelevantWorkItems rwi
                  ON wea.WorkItemId = rwi.WorkItemId

              UNION ALL

              SELECT 
                  wca.WorkItemId,
                  CAST(NULL AS INT) AS EmployeeId,
                  wca.ContractorId,
                  CAST('Contractor' AS NVARCHAR(50)) AS AssignmentType
              FROM dbo.WorkContractorAssignments wca
              INNER JOIN RelevantWorkItems rwi
                  ON wca.WorkItemId = rwi.WorkItemId

              ORDER BY WorkItemId",
            connection))
        {
            assignmentsCommand.CommandType = CommandType.Text;
            assignmentsCommand.Parameters.AddWithValue("@ProjectId", projectId);

            await using var assignmentsReader = await assignmentsCommand.ExecuteReaderAsync();

            while (await assignmentsReader.ReadAsync())
            {
                assignments.Add(MapWorkPlanAssignment(assignmentsReader));
            }
        }

        return new WorkPlanResult
        {
            Project = project,
            Tasks = tasks,
            Assignments = assignments
        };
    }

    private static WorkItem MapWorkItem(SqlDataReader reader)
    {
        return new WorkItem
        {
            WorkItemId = GetIntValue(reader, "WorkItemId"),
            Title = GetStringValue(reader, "Title") ?? string.Empty,
            Description = GetStringValue(reader, "Description"),
            WorkType = GetStringValue(reader, "WorkType"),
            BillingType = GetStringValue(reader, "BillingType"),
            Status = GetStringValue(reader, "Status"),
            CustomerId = GetIntValue(reader, "CustomerId"),
            SiteId = GetIntValue(reader, "SiteId"),
            CreatedAt = GetDateTimeValue(reader, "CreatedAt") ?? DateTime.MinValue,
            ClosedAt = GetDateTimeValue(reader, "ClosedAt"),
            ParentWorkItemId = GetNullableIntValue(reader, "ParentWorkItemId")
        };
    }

    private static WorkPlanAssignmentResult MapWorkPlanAssignment(SqlDataReader reader)
    {
        return new WorkPlanAssignmentResult
        {
            WorkItemId = GetIntValue(reader, "WorkItemId"),
            EmployeeId = GetNullableIntValue(reader, "EmployeeId"),
            ContractorId = GetNullableIntValue(reader, "ContractorId"),
            AssignmentType = GetStringValue(reader, "AssignmentType") ?? string.Empty
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

    private static int? GetNullableIntValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return null;
        }

        return Convert.ToInt32(reader[columnName]);
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
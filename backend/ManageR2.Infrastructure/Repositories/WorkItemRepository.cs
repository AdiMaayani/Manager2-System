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
        await using var command = new SqlCommand(
            @"SELECT 
              wi.WorkItemId,
              wi.Title,
              wi.Description,
              wi.WorkType,
              wi.BillingType,
              wi.Status,
              wi.CustomerId,
              c.CustomerName AS CustomerName,
              wi.SiteId,
              wi.CreatedAt,
              wi.ClosedAt,
              wi.ParentWorkItemId
          FROM dbo.WorkItems wi
          LEFT JOIN dbo.Customers c
              ON wi.CustomerId = c.CustomerId
          WHERE wi.WorkType = @WorkType
          ORDER BY wi.CreatedAt DESC",
            connection)
        {
            CommandType = CommandType.Text
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
      wi.WorkItemId,
      wi.Title,
      wi.Description,
      wi.WorkType,
      wi.BillingType,
      wi.Status,
      wi.CustomerId,
      c.CustomerName AS CustomerName,
      wi.SiteId,
      wi.CreatedAt,
      wi.ClosedAt,
      wi.ParentWorkItemId
  FROM dbo.WorkItems wi
  LEFT JOIN dbo.Customers c
      ON wi.CustomerId = c.CustomerId
  WHERE wi.ParentWorkItemId = @ParentWorkItemId
  ORDER BY wi.CreatedAt DESC",
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
        command.Parameters.AddWithValue("@DealCloseDate", (object?)workItem.DealCloseDate ?? DBNull.Value);
        command.Parameters.AddWithValue("@FinanceProjectNumber", (object?)workItem.FinanceProjectNumber ?? DBNull.Value);
        command.Parameters.AddWithValue("@InvoiceNumber", (object?)workItem.InvoiceNumber ?? DBNull.Value);

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
        command.Parameters.AddWithValue("@DealCloseDate", (object?)workItem.DealCloseDate ?? DBNull.Value);
        command.Parameters.AddWithValue("@FinanceProjectNumber", (object?)workItem.FinanceProjectNumber ?? DBNull.Value);
        command.Parameters.AddWithValue("@InvoiceNumber", (object?)workItem.InvoiceNumber ?? DBNull.Value);

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
      wi.WorkItemId,
      wi.Title,
      wi.Description,
      wi.WorkType,
      wi.BillingType,
      wi.Status,
      wi.CustomerId,
      c.CustomerName AS CustomerName,
      wi.SiteId,
      wi.CreatedAt,
      wi.ClosedAt,
      wi.ParentWorkItemId
      FROM dbo.WorkItems wi
      LEFT JOIN dbo.Customers c
      ON wi.CustomerId = c.CustomerId
      WHERE wi.WorkItemId = @ProjectId",
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
      wi.WorkItemId,
      wi.Title,
      wi.Description,
      wi.WorkType,
      wi.BillingType,
      wi.Status,
      wi.CustomerId,
      c.CustomerName AS CustomerName,
      wi.SiteId,
      wi.CreatedAt,
      wi.ClosedAt,
      wi.ParentWorkItemId
  FROM dbo.WorkItems wi
  LEFT JOIN dbo.Customers c
      ON wi.CustomerId = c.CustomerId
  WHERE wi.ParentWorkItemId = @ProjectId
  ORDER BY wi.CreatedAt DESC",
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
                  CAST('Employee' AS NVARCHAR(50)) AS AssignmentType,
                  wea.AssignmentRole,
                  e.FullName AS EmployeeName,
                  CAST(NULL AS NVARCHAR(255)) AS ContractorName
              FROM dbo.WorkEmployeeAssignments wea
              INNER JOIN RelevantWorkItems rwi
                  ON wea.WorkItemId = rwi.WorkItemId
              INNER JOIN dbo.Employees e
                  ON wea.EmployeeId = e.EmployeeId

              UNION ALL

              SELECT 
                  wca.WorkItemId,
                  CAST(NULL AS INT) AS EmployeeId,
                  wca.ContractorId,
                  CAST('Contractor' AS NVARCHAR(50)) AS AssignmentType,
                  wca.AssignmentRole,
                  CAST(NULL AS NVARCHAR(255)) AS EmployeeName,
                  c.FullName AS ContractorName
              FROM dbo.WorkContractorAssignments wca
              INNER JOIN RelevantWorkItems rwi
                  ON wca.WorkItemId = rwi.WorkItemId
              INNER JOIN dbo.Contractors c
                  ON wca.ContractorId = c.ContractorId

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

    public async Task<List<WorkPlanResult>> GetAllWorkPlansAsync()
    {
        var results = new List<WorkPlanResult>();

        await using var connection = _dbServices.CreateConnection();
        await connection.OpenAsync();

        // 1. Get all projects
        var projects = new List<WorkItem>();

        using (var cmd = new SqlCommand(@"
        SELECT *
        FROM WorkItems
        WHERE WorkType = 'Project'
    ", connection))
        {
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                projects.Add(MapWorkItem(reader));
            }
        }

        // 2. For each project, reuse existing logic
        foreach (var project in projects)
        {
            var workPlan = await GetWorkPlanAsync(project.WorkItemId);

            if (workPlan != null)
            {
                results.Add(workPlan);
            }
        }

        return results;
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
            CustomerName = GetStringValue(reader, "CustomerName"),
            SiteId = GetIntValue(reader, "SiteId"),
            CreatedAt = GetDateTimeValue(reader, "CreatedAt") ?? DateTime.MinValue,
            ClosedAt = GetDateTimeValue(reader, "ClosedAt"),
            ParentWorkItemId = GetNullableIntValue(reader, "ParentWorkItemId"),
            DealCloseDate = GetDateTimeValue(reader, "DealCloseDate"),
            FinanceProjectNumber = GetStringValue(reader, "FinanceProjectNumber"),
            InvoiceNumber = GetStringValue(reader, "InvoiceNumber")
        };
    }

    private static WorkPlanAssignmentResult MapWorkPlanAssignment(SqlDataReader reader)
    {
        return new WorkPlanAssignmentResult
        {
            WorkItemId = GetIntValue(reader, "WorkItemId"),
            EmployeeId = GetNullableIntValue(reader, "EmployeeId"),
            ContractorId = GetNullableIntValue(reader, "ContractorId"),
            AssignmentType = GetStringValue(reader, "AssignmentType") ?? string.Empty,
            AssignmentRole = GetStringValue(reader, "AssignmentRole"),
            EmployeeName = GetStringValue(reader, "EmployeeName"),
            ContractorName = GetStringValue(reader, "ContractorName")
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

    public async Task<List<ProjectListItemResult>> GetProjectsListAsync()
    {
        var projects = new List<ProjectListItemResult>();

        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_GetProjectsList", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            projects.Add(new ProjectListItemResult
            {
                WorkItemId = GetIntValue(reader, "WorkItemId"),
                Title = GetStringValue(reader, "Title") ?? string.Empty,
                CustomerName = GetStringValue(reader, "CustomerName") ?? string.Empty,
                ProjectManagerName = GetStringValue(reader, "ProjectManagerName") ?? "-",
                Status = GetStringValue(reader, "Status") ?? string.Empty,
                CreatedAt = GetDateTimeValue(reader, "CreatedAt") ?? DateTime.MinValue,
                SiteName = GetStringValue(reader, "SiteName") ?? "-",
                BillingType = GetStringValue(reader, "BillingType") ?? string.Empty,
                DealCloseDate = GetDateTimeValue(reader, "DealCloseDate"),
                FinanceProjectNumber = GetStringValue(reader, "FinanceProjectNumber"),
                InvoiceNumber = GetStringValue(reader, "InvoiceNumber")
            });
        }

        return projects;
    }
}
using System.Data;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Models;
using Microsoft.Data.SqlClient;

namespace ManageR2.Infrastructure.Repositories;

// WorkItemsController → IWorkItemRepository → here: SP-heavy writes/reads + selective inline SQL; returns WorkItem / plan models.
// Repository implementation that encapsulates DB access for work items, plans, and assignments.
public class WorkItemRepository : IWorkItemRepository
{
    private readonly DBServices _dbServices;

    public WorkItemRepository(DBServices dbServices)
    {
        _dbServices = dbServices;
    }

    public async Task<List<WorkItem>> GetAllAsync()
    {
        // Calls stored procedure that returns all work items.
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
        // Calls stored procedure for one work item details row.
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
        // Filters by WorkType (for example Project, Task, or ServiceCall).
        var workItems = new List<WorkItem>();

        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_GetWorkItemsByType", connection)
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
        // Returns child work items under a parent project/task.
        var workItems = new List<WorkItem>();

        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_GetTasksByParentWorkItemId", connection)
        {
            CommandType = CommandType.StoredProcedure
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
        // Persists work item through one stored procedure and returns new id.
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
        command.Parameters.AddWithValue("@PlannedStart", (object?)workItem.PlannedStart ?? DBNull.Value);
        command.Parameters.AddWithValue("@PlannedEnd", (object?)workItem.PlannedEnd ?? DBNull.Value);
        AddDecimalHoursParameter(command, "@EstimatedHours", workItem.EstimatedHours);
        command.Parameters.AddWithValue("@ActualStart", (object?)workItem.ActualStart ?? DBNull.Value);
        command.Parameters.AddWithValue("@ActualEnd", (object?)workItem.ActualEnd ?? DBNull.Value);
        AddDecimalHoursParameter(command, "@ActualHours", workItem.ActualHours);
        command.Parameters.AddWithValue("@Priority", (object?)workItem.Priority ?? DBNull.Value);
        command.Parameters.AddWithValue("@RequiredRole", (object?)workItem.RequiredRole ?? DBNull.Value);
        command.Parameters.AddWithValue("@IsLocked", workItem.IsLocked);

        await connection.OpenAsync();

        var result = await command.ExecuteScalarAsync();
        var newWorkItemId = result != null ? Convert.ToInt32(result) : 0;

        return newWorkItemId;
    }

    public async Task<int> CreateMilestoneAsync(WorkItem workItem)
    {
        // Milestones use the same persistence flow as other work items.
        return await CreateAsync(workItem);
    }

    public async Task<InternalWorkContext> GetInternalWorkContextAsync()
    {
        // Idempotent get-or-create handled entirely by the stored procedure.
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("sp_WorkItems_GetInternalContext", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();

        if (await reader.ReadAsync())
        {
            return new InternalWorkContext
            {
                CustomerId = Convert.ToInt32(reader["CustomerId"]),
                SiteId = Convert.ToInt32(reader["SiteId"]),
                ContainerProjectId = Convert.ToInt32(reader["ContainerProjectId"])
            };
        }

        throw new InvalidOperationException("Failed to resolve the internal work context.");
    }

    public async Task<bool> UpdateAsync(int id, WorkItem workItem)
    {
        // Updates editable work item fields through stored procedure.
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
        command.Parameters.AddWithValue("@PlannedStart", (object?)workItem.PlannedStart ?? DBNull.Value);
        command.Parameters.AddWithValue("@PlannedEnd", (object?)workItem.PlannedEnd ?? DBNull.Value);
        AddDecimalHoursParameter(command, "@EstimatedHours", workItem.EstimatedHours);
        command.Parameters.AddWithValue("@ActualStart", (object?)workItem.ActualStart ?? DBNull.Value);
        command.Parameters.AddWithValue("@ActualEnd", (object?)workItem.ActualEnd ?? DBNull.Value);
        AddDecimalHoursParameter(command, "@ActualHours", workItem.ActualHours);
        command.Parameters.AddWithValue("@Priority", (object?)workItem.Priority ?? DBNull.Value);
        command.Parameters.AddWithValue("@RequiredRole", (object?)workItem.RequiredRole ?? DBNull.Value);
        command.Parameters.AddWithValue("@IsLocked", workItem.IsLocked);


        await connection.OpenAsync();

        var result = await command.ExecuteScalarAsync();
        var rowsAffected = result != null ? Convert.ToInt32(result) : 0;

        return rowsAffected > 0;
    }

    public async Task<bool> UpdateMilestoneAsync(int milestoneId, WorkItem workItem)
    {
        // Milestone update reuses shared work item update logic.
        return await UpdateAsync(milestoneId, workItem);
    }

    public async Task<bool> CloseAsync(int workItemId)
    {
        // Soft-close flow handled in DB to keep status logic centralized.
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

    public async Task<bool> SoftDeleteMilestoneAsync(int milestoneId)
    {
        // Milestone cancel uses the same close behavior.
        return await CloseAsync(milestoneId);
    }

    public async Task<DeleteWorkPlanTaskResult> DeleteWorkPlanTaskAsync(int workItemId)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_WorkItems_DeleteTask", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        command.Parameters.AddWithValue("@WorkItemId", workItemId);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();

        if (await reader.ReadAsync())
        {
            return new DeleteWorkPlanTaskResult
            {
                ResultCode = MapDeleteWorkPlanTaskResultCode(GetIntValue(reader, "ResultCode")),
                Message = GetStringValue(reader, "Message") ?? "מחיקת המשימה נכשלה. נסה שוב.",
                RowsAffected = GetIntValue(reader, "RowsAffected")
            };
        }

        return new DeleteWorkPlanTaskResult
        {
            ResultCode = DeleteWorkPlanTaskResultCode.Failed,
            Message = "מחיקת המשימה נכשלה. נסה שוב.",
            RowsAffected = 0
        };
    }

    private static DeleteWorkPlanTaskResultCode MapDeleteWorkPlanTaskResultCode(int resultCode)
    {
        return Enum.IsDefined(typeof(DeleteWorkPlanTaskResultCode), resultCode)
            ? (DeleteWorkPlanTaskResultCode)resultCode
            : DeleteWorkPlanTaskResultCode.Failed;
    }

    public async Task<bool> AssignEmployeeToWorkAsync(int workItemId, int employeeId, string assignmentRole)
    {
        // Creates employee assignment link for a specific work item.
        try
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
            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null ? Convert.ToInt32(result) : 0;

            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            throw new InvalidOperationException(ex.Message, ex);
        }
    }

    public async Task<bool> SyncEmployeeAssignmentsByWorkItemIdAsync(
        int workItemId,
        IReadOnlyCollection<(int EmployeeId, string AssignmentRole)> assignments)
    {
        await using var connection = _dbServices.CreateConnection();
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();

        try
        {
            await using (var deleteCommand = new SqlCommand("sp_DeleteEmployeeAssignmentsByWorkItemId", connection))
            {
                deleteCommand.Transaction = (SqlTransaction)transaction;
                deleteCommand.CommandType = CommandType.StoredProcedure;
                deleteCommand.Parameters.AddWithValue("@WorkItemId", workItemId);
                await deleteCommand.ExecuteScalarAsync();
            }

            foreach (var assignment in assignments)
            {
                await using var assignCommand = new SqlCommand("sp_AssignEmployeeToWork", connection)
                {
                    Transaction = (SqlTransaction)transaction,
                    CommandType = CommandType.StoredProcedure
                };

                assignCommand.Parameters.AddWithValue("@WorkItemId", workItemId);
                assignCommand.Parameters.AddWithValue("@EmployeeId", assignment.EmployeeId);
                assignCommand.Parameters.AddWithValue("@AssignmentRole", assignment.AssignmentRole);

                var result = await assignCommand.ExecuteScalarAsync();
                var rowsAffected = result != null ? Convert.ToInt32(result) : 0;
                if (rowsAffected <= 0)
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
            await transaction.RollbackAsync();
            throw new InvalidOperationException(ex.Message, ex);
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<bool> AssignContractorToWorkAsync(int workItemId, int contractorId, string assignmentRole)
    {
        // Creates contractor assignment link for a specific work item.
        try
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
            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null ? Convert.ToInt32(result) : 0;

            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            throw new InvalidOperationException(ex.Message, ex);
        }
    }

    public async Task<WorkPlanResult?> GetWorkPlanAsync(int projectId)
    {
        // Work plan data flow: load project, then tasks, then assignments.
        await using var connection = _dbServices.CreateConnection();
        await connection.OpenAsync();

        WorkItem? project = null;
        var tasks = new List<WorkItem>();
        var assignments = new List<WorkPlanAssignmentResult>();

        // Stored procedure: project header row.
        await using (var projectCommand = new SqlCommand("sp_GetWorkPlanProject", connection))
        {
            projectCommand.CommandType = CommandType.StoredProcedure;
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

        // Stored procedure: child tasks/milestones under project.
        await using (var tasksCommand = new SqlCommand("sp_GetWorkPlanTasks", connection))
        {
            tasksCommand.CommandType = CommandType.StoredProcedure;
            tasksCommand.Parameters.AddWithValue("@ProjectId", projectId);

            await using var tasksReader = await tasksCommand.ExecuteReaderAsync();

            while (await tasksReader.ReadAsync())
            {
                tasks.Add(MapWorkItem(tasksReader));
            }
        }

        // Stored procedure: assignment links to employees/contractors.
        await using (var assignmentsCommand = new SqlCommand("sp_GetWorkPlanAssignments", connection))
        {
            assignmentsCommand.CommandType = CommandType.StoredProcedure;
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
        // Loads all projects, then builds each project work plan.
        var results = new List<WorkPlanResult>();

        await using var connection = _dbServices.CreateConnection();
        await connection.OpenAsync();

        var projects = new List<WorkItem>();

        await using (var cmd = new SqlCommand("dbo.sp_GetAllProjectsForWorkPlans", connection))
        {
            cmd.CommandType = CommandType.StoredProcedure;

            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                projects.Add(MapWorkItem(reader));
            }
        }

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
        // Reader-to-entity mapping for shared work item shape across procedures.
        return new WorkItem
        {
            WorkItemId = GetIntValue(reader, "WorkItemId"),
            Title = GetStringValue(reader, "Title") ?? string.Empty,
            Description = GetStringValue(reader, "Description"),
            WorkType = GetStringValue(reader, "WorkType"),
            BillingType = GetStringValue(reader, "BillingType"),
            Status = GetStringValue(reader, "Status"),
            EstimatedHours = GetDecimalValue(reader, "EstimatedHours"),
            ActualStart = GetDateTimeValue(reader, "ActualStart"),
            ActualEnd = GetDateTimeValue(reader, "ActualEnd"),
            ActualHours = GetDecimalValue(reader, "ActualHours"),
            Priority = GetStringValue(reader, "Priority"),
            PlannedStart = GetDateTimeValue(reader, "PlannedStart"),
            PlannedEnd = GetDateTimeValue(reader, "PlannedEnd"),
            RequiredRole = GetStringValue(reader, "RequiredRole"),
            IsLocked = HasColumn(reader, "IsLocked") && reader["IsLocked"] != DBNull.Value && Convert.ToBoolean(reader["IsLocked"]),
            CustomerId = GetIntValue(reader, "CustomerId"),
            CustomerName = GetStringValue(reader, "CustomerName"),
            SiteId = GetIntValue(reader, "SiteId"),
            SiteName = GetStringValue(reader, "SiteName"),
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
        // Reader-to-model mapping for assignment rows in work plan responses.
        return new WorkPlanAssignmentResult
        {
            WorkItemId = GetIntValue(reader, "WorkItemId"),
            EmployeeId = GetNullableIntValue(reader, "EmployeeId"),
            ContractorId = GetNullableIntValue(reader, "ContractorId"),
            AssignmentType = GetStringValue(reader, "AssignmentType") ?? string.Empty,
            AssignmentRole = GetStringValue(reader, "AssignmentRole"),
            AssignedHours = GetDecimalValue(reader, "AssignedHours"),
            IsManualAssignment = HasColumn(reader, "IsManualAssignment") && reader["IsManualAssignment"] != DBNull.Value && Convert.ToBoolean(reader["IsManualAssignment"]),
            EmployeeName = GetStringValue(reader, "EmployeeName"),
            ContractorName = GetStringValue(reader, "ContractorName")
        };
    }

    private static bool HasColumn(SqlDataReader reader, string columnName)
    {
        // Protects shared mapping code when different procedures return different columns.
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
        // Returns summarized project rows for projects-list endpoint.
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

    public async Task<List<ProjectMilestoneResult>> GetProjectMilestonesAsync(int projectId)
    {
        // Builds milestone view with nested employees and contractors from flat DB rows.
        var milestonesDictionary = new Dictionary<int, ProjectMilestoneResult>();

        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_GetProjectMilestones", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        command.Parameters.AddWithValue("@ProjectId", projectId);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            var workItemId = GetIntValue(reader, "WorkItemId");

            // First row for a milestone creates the milestone container once.
            if (!milestonesDictionary.TryGetValue(workItemId, out var milestone))
            {
                milestone = new ProjectMilestoneResult
                {
                    WorkItemId = workItemId,
                    Title = GetStringValue(reader, "Title") ?? string.Empty,
                    Description = GetStringValue(reader, "Description"),
                    WorkType = GetStringValue(reader, "WorkType") ?? string.Empty,
                    Status = GetStringValue(reader, "Status") ?? string.Empty,
                    BillingType = GetStringValue(reader, "BillingType"),
                    CustomerId = GetIntValue(reader, "CustomerId"),
                    SiteId = GetNullableIntValue(reader, "SiteId"),
                    CreatedAt = GetDateTimeValue(reader, "CreatedAt") ?? DateTime.MinValue,
                    PlannedStart = GetDateTimeValue(reader, "PlannedStart"),
                    PlannedEnd = GetDateTimeValue(reader, "PlannedEnd"),
                    ClosedAt = GetDateTimeValue(reader, "ClosedAt"),
                    Priority = GetStringValue(reader, "Priority"),
                    RequiredRole = GetStringValue(reader, "RequiredRole"),
                    EstimatedHours = GetDecimalValue(reader, "EstimatedHours"),
                    ActualStart = GetDateTimeValue(reader, "ActualStart"),
                    ActualEnd = GetDateTimeValue(reader, "ActualEnd"),
                    ActualHours = GetDecimalValue(reader, "ActualHours"),
                    IsLocked = GetBoolValue(reader, "IsLocked")
                };

                milestonesDictionary.Add(workItemId, milestone);
            }

            // Employee assignment rows are grouped under the milestone.
            var employeeId = GetNullableIntValue(reader, "EmployeeId");
            if (employeeId.HasValue && employeeId.Value > 0)
            {
                var alreadyExists = milestone.Employees.Any(e => e.EmployeeId == employeeId.Value);

                if (!alreadyExists)
                {
                    milestone.Employees.Add(new ProjectMilestoneEmployeeAssignmentResult
                    {
                        EmployeeId = employeeId.Value,
                        EmployeeName = GetStringValue(reader, "EmployeeName") ?? string.Empty,
                        AssignmentRole = GetStringValue(reader, "AssignmentRole"),
                        AssignedHours = GetDecimalValue(reader, "AssignedHours"),
                        IsManualAssignment = GetNullableBoolValue(reader, "IsManualAssignment")
                    });
                }
            }

            // Contractor assignment rows are grouped under the milestone.
            var contractorId = GetNullableIntValue(reader, "ContractorId");
            if (contractorId.HasValue && contractorId.Value > 0)
            {
                var alreadyExists = milestone.Contractors.Any(c => c.ContractorId == contractorId.Value);

                if (!alreadyExists)
                {
                    milestone.Contractors.Add(new ProjectMilestoneContractorAssignmentResult
                    {
                        ContractorId = contractorId.Value,
                        ContractorName = GetStringValue(reader, "ContractorName") ?? string.Empty,
                        AssignmentRole = GetStringValue(reader, "ContractorAssignmentRole")
                    });
                }
            }
        }

        return milestonesDictionary.Values.ToList();
    }
    private static void AddDecimalHoursParameter(SqlCommand command, string parameterName, decimal? value)
    {
        command.Parameters.Add(new SqlParameter(parameterName, SqlDbType.Decimal)
        {
            Precision = 5,
            Scale = 2,
            Value = value.HasValue ? value.Value : DBNull.Value,
        });
    }

    private static decimal? GetDecimalValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return null;
        }

        return Convert.ToDecimal(reader[columnName]);
    }

    private static bool GetBoolValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return false;
        }

        return Convert.ToBoolean(reader[columnName]);
    }

    private static bool? GetNullableBoolValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return null;
        }

        return Convert.ToBoolean(reader[columnName]);
    }

    public async Task<bool> DeleteEmployeeAssignmentsByWorkItemIdAsync(int workItemId)
    {
        // Clears employee links before re-adding updated assignment list.
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("sp_DeleteEmployeeAssignmentsByWorkItemId", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        command.Parameters.AddWithValue("@WorkItemId", workItemId);

        await connection.OpenAsync();

        var result = await command.ExecuteScalarAsync();
        var rowsAffected = result != null ? Convert.ToInt32(result) : 0;

        return rowsAffected >= 0;
    }

    public async Task<bool> DeleteContractorAssignmentsByWorkItemIdAsync(int workItemId)
    {
        // Clears contractor links before re-adding updated assignment list.
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("sp_DeleteContractorAssignmentsByWorkItemId", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        command.Parameters.AddWithValue("@WorkItemId", workItemId);

        await connection.OpenAsync();

        var result = await command.ExecuteScalarAsync();
        var rowsAffected = result != null ? Convert.ToInt32(result) : 0;

        return rowsAffected >= 0;
    }
}

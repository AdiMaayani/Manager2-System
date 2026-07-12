using System.Data.Common;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Features.WorkItems.Repositories;

public sealed partial class PostgresWorkItemRepository
{
    // Mirrors sp_CreateWorkItem: derives TaskCategory/WorkType, validates the structural invariants
    // (raising the SP's messages), derives EstimatedHours from the planned range, inserts and returns the id.
    public async Task<int> CreateAsync(WorkItem workItem)
    {
        var explicitCategory = NormalizeCategory(workItem.TaskCategory);
        var parentId = workItem.ParentWorkItemId;
        var milestoneId = workItem.MilestoneId;

        var category = explicitCategory ?? DeriveCategory(workItem.WorkType, parentId);
        var derivedWorkType = DeriveWorkType(category, workItem.WorkType);

        if (derivedWorkType is null)
        {
            throw new InvalidOperationException("Invalid TaskCategory/WorkType.");
        }

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();

        if (derivedWorkType == "Project" && (parentId is not null || milestoneId is not null))
        {
            throw new InvalidOperationException("Project containers cannot have a parent or milestone.");
        }

        if (category == "Regular" && (parentId is not null || milestoneId is not null))
        {
            throw new InvalidOperationException("Regular tasks cannot have a project or milestone.");
        }

        if (category == "Project" && !await ExistsAsync(connection, transaction,
                """SELECT 1 FROM "WorkItems" WHERE "WorkItemId" = @p AND "WorkType" = 'Project' AND "IsArchived" = false""",
                ("@p", (object?)parentId ?? DBNull.Value)))
        {
            throw new InvalidOperationException("Project task requires an active project parent.");
        }

        if (category == "ServiceCall" && (parentId is not null || milestoneId is not null))
        {
            throw new InvalidOperationException("Service calls cannot have a project parent or milestone.");
        }

        if (workItem.CustomerId is not null && !await ExistsAsync(connection, transaction,
                """SELECT 1 FROM "Customers" WHERE "CustomerId" = @c""", ("@c", workItem.CustomerId.Value)))
        {
            throw new InvalidOperationException("Customer not found.");
        }

        if (workItem.SiteId is not null && workItem.CustomerId is not null && !await ExistsAsync(connection, transaction,
                """SELECT 1 FROM "Sites" WHERE "SiteId" = @s AND "CustomerId" = @c""",
                ("@s", workItem.SiteId.Value), ("@c", workItem.CustomerId.Value)))
        {
            throw new InvalidOperationException("Site does not belong to the selected customer.");
        }

        if (workItem.SiteId is not null && workItem.CustomerId is null && !await ExistsAsync(connection, transaction,
                """SELECT 1 FROM "Sites" WHERE "SiteId" = @s""", ("@s", workItem.SiteId.Value)))
        {
            throw new InvalidOperationException("Site not found.");
        }

        if (milestoneId is not null && !await ExistsAsync(connection, transaction,
                """SELECT 1 FROM "ProjectMilestones" WHERE "ProjectMilestoneId" = @m AND "ProjectId" = @p AND "IsActive" = true""",
                ("@m", milestoneId.Value), ("@p", (object?)parentId ?? DBNull.Value)))
        {
            throw new InvalidOperationException("Milestone does not belong to the selected project.");
        }

        ValidatePlannedRange(workItem.PlannedStart, workItem.PlannedEnd,
            "PlannedStart and PlannedEnd must both be supplied or both be null.",
            "PlannedEnd must be later than PlannedStart.");

        var derivedHours = ComputeDerivedHours(workItem.PlannedStart, workItem.PlannedEnd);

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            INSERT INTO "WorkItems"
                ("Title", "WorkType", "TaskCategory", "Status", "BillingType", "Description", "CustomerId", "SiteId",
                 "CreatedAt", "ParentWorkItemId", "MilestoneId", "DealCloseDate", "FinanceProjectNumber", "InvoiceNumber",
                 "PlannedStart", "PlannedEnd", "EstimatedHours", "ActualStart", "ActualEnd", "ActualHours", "Priority",
                 "RequiredRole", "IsLocked")
            VALUES
                (@Title, @WorkType, @TaskCategory, @Status, @BillingType, @Description, @CustomerId, @SiteId,
                 (now() at time zone 'utc'), @ParentWorkItemId, @MilestoneId, @DealCloseDate, @FinanceProjectNumber,
                 @InvoiceNumber, @PlannedStart, @PlannedEnd, @EstimatedHours, @ActualStart, @ActualEnd, @ActualHours,
                 @Priority, @RequiredRole, @IsLocked)
            RETURNING "WorkItemId"
            """;

        AddParameter(command, "@Title", workItem.Title ?? string.Empty);
        AddParameter(command, "@WorkType", derivedWorkType);
        AddParameter(command, "@TaskCategory", (object?)category ?? DBNull.Value);
        AddParameter(command, "@Status", (object?)workItem.Status ?? DBNull.Value);
        AddParameter(command, "@BillingType", (object?)workItem.BillingType ?? DBNull.Value);
        AddParameter(command, "@Description", (object?)workItem.Description ?? DBNull.Value);
        AddParameter(command, "@CustomerId", (object?)workItem.CustomerId ?? DBNull.Value);
        AddParameter(command, "@SiteId", (object?)workItem.SiteId ?? DBNull.Value);
        AddParameter(command, "@ParentWorkItemId", (object?)parentId ?? DBNull.Value);
        AddParameter(command, "@MilestoneId", (object?)milestoneId ?? DBNull.Value);
        AddParameter(command, "@DealCloseDate", (object?)workItem.DealCloseDate ?? DBNull.Value);
        AddParameter(command, "@FinanceProjectNumber", (object?)workItem.FinanceProjectNumber ?? DBNull.Value);
        AddParameter(command, "@InvoiceNumber", (object?)workItem.InvoiceNumber ?? DBNull.Value);
        AddParameter(command, "@PlannedStart", (object?)workItem.PlannedStart ?? DBNull.Value);
        AddParameter(command, "@PlannedEnd", (object?)workItem.PlannedEnd ?? DBNull.Value);
        AddParameter(command, "@EstimatedHours", (object?)derivedHours ?? DBNull.Value);
        AddParameter(command, "@ActualStart", (object?)workItem.ActualStart ?? DBNull.Value);
        AddParameter(command, "@ActualEnd", (object?)workItem.ActualEnd ?? DBNull.Value);
        AddParameter(command, "@ActualHours", (object?)workItem.ActualHours ?? DBNull.Value);
        AddParameter(command, "@Priority", (object?)workItem.Priority ?? DBNull.Value);
        AddParameter(command, "@RequiredRole", (object?)workItem.RequiredRole ?? DBNull.Value);
        AddParameter(command, "@IsLocked", workItem.IsLocked);

        var result = await command.ExecuteScalarAsync();
        await transaction.CommitAsync();
        return result is null or DBNull ? 0 : Convert.ToInt32(result);
    }

    // Mirrors sp_UpdateWorkItem: fetches the old category for fallback, re-derives, validates, updates
    // (only when not archived) and returns whether a row changed.
    public async Task<bool> UpdateAsync(int id, WorkItem workItem)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();

        string? oldCategory;
        await using (var oldRow = connection.CreateCommand())
        {
            oldRow.Transaction = transaction;
            oldRow.CommandText = """SELECT "TaskCategory" FROM "WorkItems" WHERE "WorkItemId" = @id""";
            AddParameter(oldRow, "@id", id);
            await using var reader = await oldRow.ExecuteReaderAsync();
            if (!await reader.ReadAsync())
            {
                throw new InvalidOperationException("Work item not found.");
            }

            oldCategory = reader.IsDBNull(0) ? null : reader.GetString(0);
        }

        var parentId = workItem.ParentWorkItemId;
        var milestoneId = workItem.MilestoneId;

        var category = NormalizeCategory(workItem.TaskCategory)
                       ?? oldCategory
                       ?? DeriveCategory(workItem.WorkType, parentId);
        var derivedWorkType = DeriveWorkType(category, workItem.WorkType);

        if (derivedWorkType is null)
        {
            throw new InvalidOperationException("Invalid TaskCategory/WorkType.");
        }

        if (derivedWorkType == "Project" && (parentId is not null || milestoneId is not null))
        {
            throw new InvalidOperationException("Project containers cannot have a parent or milestone.");
        }

        if (category == "Regular" && (parentId is not null || milestoneId is not null))
        {
            throw new InvalidOperationException("Regular tasks cannot have a project or milestone.");
        }

        if (category == "ServiceCall" && (parentId is not null || milestoneId is not null))
        {
            throw new InvalidOperationException("Service calls cannot have a project parent or milestone.");
        }

        if (category == "Project" && !await ExistsAsync(connection, transaction,
                """SELECT 1 FROM "WorkItems" WHERE "WorkItemId" = @p AND "WorkType" = 'Project' AND "IsArchived" = false""",
                ("@p", (object?)parentId ?? DBNull.Value)))
        {
            throw new InvalidOperationException("Project task requires an active project parent.");
        }

        if (milestoneId is not null && !await ExistsAsync(connection, transaction,
                """SELECT 1 FROM "ProjectMilestones" WHERE "ProjectMilestoneId" = @m AND "ProjectId" = @p AND "IsActive" = true""",
                ("@m", milestoneId.Value), ("@p", (object?)parentId ?? DBNull.Value)))
        {
            throw new InvalidOperationException("Milestone does not belong to the selected project.");
        }

        if (workItem.CustomerId is not null && !await ExistsAsync(connection, transaction,
                """SELECT 1 FROM "Customers" WHERE "CustomerId" = @c""", ("@c", workItem.CustomerId.Value)))
        {
            throw new InvalidOperationException("Customer not found.");
        }

        if (workItem.SiteId is not null && workItem.CustomerId is not null && !await ExistsAsync(connection, transaction,
                """SELECT 1 FROM "Sites" WHERE "SiteId" = @s AND "CustomerId" = @c""",
                ("@s", workItem.SiteId.Value), ("@c", workItem.CustomerId.Value)))
        {
            throw new InvalidOperationException("Site does not belong to the selected customer.");
        }

        if (workItem.SiteId is not null && workItem.CustomerId is null && !await ExistsAsync(connection, transaction,
                """SELECT 1 FROM "Sites" WHERE "SiteId" = @s""", ("@s", workItem.SiteId.Value)))
        {
            throw new InvalidOperationException("Site not found.");
        }

        ValidatePlannedRange(workItem.PlannedStart, workItem.PlannedEnd,
            "PlannedStart and PlannedEnd must both be supplied or both be null.",
            "PlannedEnd must be later than PlannedStart.");

        var derivedHours = ComputeDerivedHours(workItem.PlannedStart, workItem.PlannedEnd);

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            UPDATE "WorkItems" SET
                "Title" = @Title, "Description" = @Description, "WorkType" = @WorkType, "TaskCategory" = @TaskCategory,
                "BillingType" = @BillingType, "Status" = @Status, "CustomerId" = @CustomerId, "SiteId" = @SiteId,
                "ParentWorkItemId" = @ParentWorkItemId, "MilestoneId" = @MilestoneId, "DealCloseDate" = @DealCloseDate,
                "FinanceProjectNumber" = @FinanceProjectNumber, "InvoiceNumber" = @InvoiceNumber,
                "PlannedStart" = @PlannedStart, "PlannedEnd" = @PlannedEnd, "EstimatedHours" = @EstimatedHours,
                "ActualStart" = @ActualStart, "ActualEnd" = @ActualEnd, "ActualHours" = @ActualHours,
                "Priority" = @Priority, "RequiredRole" = @RequiredRole, "IsLocked" = @IsLocked
            WHERE "WorkItemId" = @WorkItemId AND "IsArchived" = false
            """;

        AddParameter(command, "@WorkItemId", id);
        AddParameter(command, "@Title", (object?)workItem.Title ?? DBNull.Value);
        AddParameter(command, "@Description", (object?)workItem.Description ?? DBNull.Value);
        AddParameter(command, "@WorkType", derivedWorkType);
        AddParameter(command, "@TaskCategory", (object?)category ?? DBNull.Value);
        AddParameter(command, "@BillingType", (object?)workItem.BillingType ?? DBNull.Value);
        AddParameter(command, "@Status", (object?)workItem.Status ?? DBNull.Value);
        AddParameter(command, "@CustomerId", (object?)workItem.CustomerId ?? DBNull.Value);
        AddParameter(command, "@SiteId", (object?)workItem.SiteId ?? DBNull.Value);
        AddParameter(command, "@ParentWorkItemId", (object?)parentId ?? DBNull.Value);
        AddParameter(command, "@MilestoneId", (object?)milestoneId ?? DBNull.Value);
        AddParameter(command, "@DealCloseDate", (object?)workItem.DealCloseDate ?? DBNull.Value);
        AddParameter(command, "@FinanceProjectNumber", (object?)workItem.FinanceProjectNumber ?? DBNull.Value);
        AddParameter(command, "@InvoiceNumber", (object?)workItem.InvoiceNumber ?? DBNull.Value);
        AddParameter(command, "@PlannedStart", (object?)workItem.PlannedStart ?? DBNull.Value);
        AddParameter(command, "@PlannedEnd", (object?)workItem.PlannedEnd ?? DBNull.Value);
        AddParameter(command, "@EstimatedHours", (object?)derivedHours ?? DBNull.Value);
        AddParameter(command, "@ActualStart", (object?)workItem.ActualStart ?? DBNull.Value);
        AddParameter(command, "@ActualEnd", (object?)workItem.ActualEnd ?? DBNull.Value);
        AddParameter(command, "@ActualHours", (object?)workItem.ActualHours ?? DBNull.Value);
        AddParameter(command, "@Priority", (object?)workItem.Priority ?? DBNull.Value);
        AddParameter(command, "@RequiredRole", (object?)workItem.RequiredRole ?? DBNull.Value);
        AddParameter(command, "@IsLocked", workItem.IsLocked);

        var rowsAffected = await command.ExecuteNonQueryAsync();
        await transaction.CommitAsync();
        return rowsAffected > 0;
    }

    // Mirrors sp_CloseWorkItem: local-time ClosedAt, only when not already closed.
    public async Task<bool> CloseAsync(int workItemId)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            UPDATE "WorkItems" SET "Status" = 'Cancelled', "ClosedAt" = localtimestamp
            WHERE "WorkItemId" = @WorkItemId AND "ClosedAt" IS NULL
            """;
        AddParameter(command, "@WorkItemId", workItemId);

        await connection.OpenAsync();
        var rowsAffected = await command.ExecuteNonQueryAsync();
        return rowsAffected > 0;
    }

    public async Task<bool> AssignEmployeeToWorkAsync(int workItemId, int employeeId, string assignmentRole)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await connection.OpenAsync();
            return await AssignEmployeeCoreAsync(connection, null, workItemId, employeeId, assignmentRole);
        }
        catch (DbException ex)
        {
            throw new InvalidOperationException(ex.Message, ex);
        }
    }

    public async Task<bool> AssignContractorToWorkAsync(int workItemId, int contractorId, string assignmentRole)
    {
        try
        {
            await using var connection = _connectionFactory.CreateConnection();
            await connection.OpenAsync();

            if (!await ExistsAsync(connection, null, """SELECT 1 FROM "WorkItems" WHERE "WorkItemId" = @w""", ("@w", workItemId)))
            {
                throw new InvalidOperationException("Work item was not found.");
            }

            if (!await ExistsAsync(connection, null, """SELECT 1 FROM "Contractors" WHERE "ContractorId" = @c""", ("@c", contractorId)))
            {
                throw new InvalidOperationException("Contractor was not found.");
            }

            if (string.IsNullOrWhiteSpace(assignmentRole))
            {
                throw new InvalidOperationException("Assignment role is required.");
            }

            if (await ExistsAsync(connection, null,
                    """SELECT 1 FROM "WorkContractorAssignments" WHERE "WorkItemId" = @w AND "ContractorId" = @c""",
                    ("@w", workItemId), ("@c", contractorId)))
            {
                throw new InvalidOperationException("Contractor is already assigned to this work item.");
            }

            await using var command = connection.CreateCommand();
            command.CommandText =
                """
                INSERT INTO "WorkContractorAssignments" ("WorkItemId", "ContractorId", "AssignmentRole")
                VALUES (@w, @c, @role)
                """;
            AddParameter(command, "@w", workItemId);
            AddParameter(command, "@c", contractorId);
            AddParameter(command, "@role", assignmentRole);
            var rows = await command.ExecuteNonQueryAsync();
            return rows > 0;
        }
        catch (DbException ex)
        {
            throw new InvalidOperationException(ex.Message, ex);
        }
    }

    public async Task<bool> SyncEmployeeAssignmentsByWorkItemIdAsync(
        int workItemId,
        IReadOnlyCollection<(int EmployeeId, string AssignmentRole)> assignments)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();

        try
        {
            await using (var deleteCommand = connection.CreateCommand())
            {
                deleteCommand.Transaction = transaction;
                deleteCommand.CommandText = """DELETE FROM "WorkEmployeeAssignments" WHERE "WorkItemId" = @w""";
                AddParameter(deleteCommand, "@w", workItemId);
                await deleteCommand.ExecuteNonQueryAsync();
            }

            foreach (var assignment in assignments)
            {
                var assigned = await AssignEmployeeCoreAsync(
                    connection, transaction, workItemId, assignment.EmployeeId, assignment.AssignmentRole);
                if (!assigned)
                {
                    await transaction.RollbackAsync();
                    return false;
                }
            }

            await transaction.CommitAsync();
            return true;
        }
        catch (DbException ex)
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

    public async Task<bool> DeleteEmployeeAssignmentsByWorkItemIdAsync(int workItemId)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = """DELETE FROM "WorkEmployeeAssignments" WHERE "WorkItemId" = @w""";
        AddParameter(command, "@w", workItemId);
        await connection.OpenAsync();
        await command.ExecuteNonQueryAsync();
        return true;
    }

    public async Task<bool> DeleteContractorAssignmentsByWorkItemIdAsync(int workItemId)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = """DELETE FROM "WorkContractorAssignments" WHERE "WorkItemId" = @w""";
        AddParameter(command, "@w", workItemId);
        await connection.OpenAsync();
        await command.ExecuteNonQueryAsync();
        return true;
    }

    // Reproduces sp_AssignEmployeeToWork validation + insert (IsManualAssignment = true, AssignedHours NULL).
    private async Task<bool> AssignEmployeeCoreAsync(
        DbConnection connection, DbTransaction? transaction, int workItemId, int employeeId, string assignmentRole)
    {
        if (!await ExistsAsync(connection, transaction, """SELECT 1 FROM "WorkItems" WHERE "WorkItemId" = @w""", ("@w", workItemId)))
        {
            throw new InvalidOperationException("Work item was not found.");
        }

        if (!await ExistsAsync(connection, transaction, """SELECT 1 FROM "Employees" WHERE "EmployeeId" = @e""", ("@e", employeeId)))
        {
            throw new InvalidOperationException("Employee was not found.");
        }

        if (string.IsNullOrWhiteSpace(assignmentRole))
        {
            throw new InvalidOperationException("Assignment role is required.");
        }

        if (await ExistsAsync(connection, transaction,
                """SELECT 1 FROM "WorkEmployeeAssignments" WHERE "WorkItemId" = @w AND "EmployeeId" = @e""",
                ("@w", workItemId), ("@e", employeeId)))
        {
            throw new InvalidOperationException("Employee is already assigned to this work item.");
        }

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            INSERT INTO "WorkEmployeeAssignments" ("WorkItemId", "EmployeeId", "AssignmentRole", "AssignedHours", "IsManualAssignment")
            VALUES (@w, @e, @role, NULL, true)
            """;
        AddParameter(command, "@w", workItemId);
        AddParameter(command, "@e", employeeId);
        AddParameter(command, "@role", assignmentRole);
        var rows = await command.ExecuteNonQueryAsync();
        return rows > 0;
    }

    private static string? NormalizeCategory(string? category)
    {
        var trimmed = category?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    private static string? DeriveCategory(string? workType, int? parentId) => workType switch
    {
        "ServiceCall" => "ServiceCall",
        "Task" when parentId is null => "Regular",
        "Task" => "Project",
        _ => null
    };

    private static string? DeriveWorkType(string? category, string? workType) => category switch
    {
        "Regular" => "Task",
        "Project" => "Task",
        "ServiceCall" => "ServiceCall",
        _ => workType == "Project" ? "Project" : null
    };

    private static void ValidatePlannedRange(DateTime? start, DateTime? end, string pairMessage, string orderMessage)
    {
        if ((start is null) != (end is null))
        {
            throw new InvalidOperationException(pairMessage);
        }

        if (end is not null && end <= start)
        {
            throw new InvalidOperationException(orderMessage);
        }
    }

    // Mirrors CAST(DATEDIFF(MINUTE, start, end) / 60.0 AS DECIMAL(5,2)) for the (UTC-normalized) planned range.
    private static decimal? ComputeDerivedHours(DateTime? start, DateTime? end)
    {
        if (start is null || end is null)
        {
            return null;
        }

        var minutes = (long)Math.Floor((TruncateToMinute(end.Value) - TruncateToMinute(start.Value)).TotalMinutes);
        return Math.Round(minutes / 60.0m, 2, MidpointRounding.AwayFromZero);
    }

    private static DateTime TruncateToMinute(DateTime value) =>
        new(value.Year, value.Month, value.Day, value.Hour, value.Minute, 0, value.Kind);
}

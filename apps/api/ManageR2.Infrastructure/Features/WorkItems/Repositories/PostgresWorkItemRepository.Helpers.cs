using System.Data.Common;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Features.WorkItems.Repositories;

public sealed partial class PostgresWorkItemRepository
{
    // Mirrors sp_WorkItems_DeleteTask: transactional, guard-checked hard delete of a work-plan task with the
    // same result codes/messages and dependent-row cascade. Only Regular/Project tasks are deletable.
    public async Task<DeleteWorkPlanTaskResult> DeleteWorkPlanTaskAsync(int workItemId)
    {
        const string genericFailure = "מחיקת המשימה נכשלה. נסה שוב.";

        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();

        try
        {
            string? workType;
            bool isLocked;
            string? taskCategory;
            bool isArchived;

            await using (var lookup = connection.CreateCommand())
            {
                lookup.Transaction = transaction;
                lookup.CommandText =
                    """
                    SELECT "WorkType", "IsLocked", "TaskCategory", "IsArchived"
                    FROM "WorkItems" WHERE "WorkItemId" = @id FOR UPDATE
                    """;
                AddParameter(lookup, "@id", workItemId);
                await using var reader = await lookup.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                {
                    await transaction.RollbackAsync();
                    return Delete(DeleteWorkPlanTaskResultCode.NotFound, "המשימה לא נמצאה.", 0);
                }

                workType = reader.IsDBNull(0) ? null : reader.GetString(0);
                isLocked = !reader.IsDBNull(1) && reader.GetBoolean(1);
                taskCategory = reader.IsDBNull(2) ? null : reader.GetString(2);
                isArchived = !reader.IsDBNull(3) && reader.GetBoolean(3);
            }

            if (workType == "Project")
            {
                await transaction.RollbackAsync();
                return Delete(DeleteWorkPlanTaskResultCode.ProjectRoot, "לא ניתן למחוק פרויקט דרך פעולה זו.", 0);
            }

            if (workType != "Task")
            {
                await transaction.RollbackAsync();
                return Delete(DeleteWorkPlanTaskResultCode.NotTask, "ניתן למחוק דרך פעולה זו רק משימות תוכנית עבודה.", 0);
            }

            if (isArchived || taskCategory is not ("Regular" or "Project"))
            {
                await transaction.RollbackAsync();
                return Delete((DeleteWorkPlanTaskResultCode)8, "לא ניתן למחוק רשומת מורשת או משימה ללא קטגוריה תקינה.", 0);
            }

            if (isLocked)
            {
                await transaction.RollbackAsync();
                return Delete(DeleteWorkPlanTaskResultCode.Locked, "משימה נעולה — לא ניתן למחוק.", 0);
            }

            if (await ExistsAsync(connection, transaction,
                    """SELECT 1 FROM "WorkItems" WHERE "ParentWorkItemId" = @id""", ("@id", workItemId)))
            {
                await transaction.RollbackAsync();
                return Delete(DeleteWorkPlanTaskResultCode.HasChildTasks, "לא ניתן למחוק משימה הכוללת משימות משנה.", 0);
            }

            if (await ExistsAsync(connection, transaction,
                    """
                    SELECT 1 FROM "WorkReports" WHERE "WorkItemId" = @id
                    UNION ALL SELECT 1 FROM "Rec_EmployeeLocationEvents" WHERE "WorkItemId" = @id
                    UNION ALL SELECT 1 FROM "Rec_EmployeePlannedStops" WHERE "WorkItemId" = @id
                    UNION ALL SELECT 1 FROM "Rec_RecommendationRuns" WHERE "ProjectId" = @id
                    UNION ALL SELECT 1 FROM "ProjectEquipmentItems" WHERE "ProjectId" = @id
                    UNION ALL SELECT 1 FROM "ProjectBoqItems" WHERE "ProjectId" = @id
                    UNION ALL SELECT 1 FROM "ProjectDrawings" WHERE "ProjectId" = @id
                    UNION ALL SELECT 1 FROM "Quotes" WHERE "ProjectId" = @id
                    """, ("@id", workItemId)))
            {
                await transaction.RollbackAsync();
                return Delete(DeleteWorkPlanTaskResultCode.HasProtectedHistory,
                    "לא ניתן למחוק את המשימה משום שקיימים עבורה דיווחים או נתונים תפעוליים.", 0);
            }

            if (await ExistsAsync(connection, transaction,
                    """
                    SELECT 1
                    FROM "Rec_RecommendationRuns" runs
                    INNER JOIN "Rec_TaskAssignmentRecommendations" recs ON recs."RecommendationRunId" = runs."RecommendationRunId"
                    WHERE runs."TaskId" = @id AND recs."TaskId" <> @id
                    """, ("@id", workItemId)))
            {
                await transaction.RollbackAsync();
                return Delete(DeleteWorkPlanTaskResultCode.Failed, "מחיקת המשימה נכשלה משום שנתוני ההמלצות אינם עקביים.", 0);
            }

            await ExecuteAsync(connection, transaction, """DELETE FROM "WorkEmployeeAssignments" WHERE "WorkItemId" = @id""", workItemId);
            await ExecuteAsync(connection, transaction, """DELETE FROM "WorkContractorAssignments" WHERE "WorkItemId" = @id""", workItemId);
            await ExecuteAsync(connection, transaction, """DELETE FROM "Rec_WorkItemRequiredSkills" WHERE "WorkItemId" = @id""", workItemId);
            await ExecuteAsync(connection, transaction, """DELETE FROM "Rec_WorkItemAlgorithmProfile" WHERE "WorkItemId" = @id""", workItemId);
            await ExecuteAsync(connection, transaction, """DELETE FROM "Rec_TaskAssignmentRecommendations" WHERE "TaskId" = @id""", workItemId);
            await ExecuteAsync(connection, transaction, """DELETE FROM "Rec_RecommendationRuns" WHERE "TaskId" = @id""", workItemId);

            int rowsAffected;
            await using (var delete = connection.CreateCommand())
            {
                delete.Transaction = transaction;
                delete.CommandText = """DELETE FROM "WorkItems" WHERE "WorkItemId" = @id AND "WorkType" = 'Task'""";
                AddParameter(delete, "@id", workItemId);
                rowsAffected = await delete.ExecuteNonQueryAsync();
            }

            if (rowsAffected == 0)
            {
                await transaction.RollbackAsync();
                return Delete(DeleteWorkPlanTaskResultCode.Failed, genericFailure, 0);
            }

            await transaction.CommitAsync();
            return Delete(DeleteWorkPlanTaskResultCode.Deleted, "המשימה נמחקה בהצלחה.", rowsAffected);
        }
        catch (DbException)
        {
            await transaction.RollbackAsync();
            return Delete(DeleteWorkPlanTaskResultCode.Failed, genericFailure, 0);
        }
    }

    private static DeleteWorkPlanTaskResult Delete(DeleteWorkPlanTaskResultCode code, string message, int rows) =>
        new() { ResultCode = code, Message = message, RowsAffected = rows };

    private static async Task ExecuteAsync(DbConnection connection, DbTransaction transaction, string sql, int workItemId)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        AddParameter(command, "@id", workItemId);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<bool> ExistsAsync(
        DbConnection connection, DbTransaction? transaction, string sql, params (string Name, object Value)[] parameters)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        foreach (var (name, value) in parameters)
        {
            AddParameter(command, name, value);
        }

        var result = await command.ExecuteScalarAsync();
        return result is not null && result != DBNull.Value;
    }

    private static void AddParameter(DbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }

    private static WorkItem MapWorkItem(DbDataReader reader)
    {
        return new WorkItem
        {
            WorkItemId = GetInt(reader, "WorkItemId"),
            Title = GetString(reader, "Title") ?? string.Empty,
            Description = GetString(reader, "Description"),
            WorkType = GetString(reader, "WorkType"),
            TaskCategory = GetString(reader, "TaskCategory"),
            BillingType = GetString(reader, "BillingType"),
            Status = GetString(reader, "Status"),
            EstimatedHours = GetNullableDecimal(reader, "EstimatedHours"),
            ActualStart = GetDateTime(reader, "ActualStart"),
            ActualEnd = GetDateTime(reader, "ActualEnd"),
            ActualHours = GetNullableDecimal(reader, "ActualHours"),
            Priority = GetString(reader, "Priority"),
            PlannedStart = GetDateTime(reader, "PlannedStart"),
            PlannedEnd = GetDateTime(reader, "PlannedEnd"),
            RequiredRole = GetString(reader, "RequiredRole"),
            IsLocked = GetBool(reader, "IsLocked"),
            CustomerId = GetNullableInt(reader, "CustomerId"),
            CustomerName = GetString(reader, "CustomerName"),
            SiteId = GetNullableInt(reader, "SiteId"),
            SiteName = GetString(reader, "SiteName"),
            CreatedAt = GetDateTime(reader, "CreatedAt") ?? DateTime.MinValue,
            ClosedAt = GetDateTime(reader, "ClosedAt"),
            ParentWorkItemId = GetNullableInt(reader, "ParentWorkItemId"),
            MilestoneId = GetNullableInt(reader, "MilestoneId"),
            MilestoneTitle = GetString(reader, "MilestoneTitle"),
            ProjectTitle = GetString(reader, "ProjectTitle"),
            IsArchived = GetBool(reader, "IsArchived"),
            ArchivedAt = GetDateTime(reader, "ArchivedAt"),
            DealCloseDate = GetDateTime(reader, "DealCloseDate"),
            FinanceProjectNumber = GetString(reader, "FinanceProjectNumber"),
            InvoiceNumber = GetString(reader, "InvoiceNumber")
        };
    }

    private static WorkPlanAssignmentResult MapWorkPlanAssignment(DbDataReader reader)
    {
        return new WorkPlanAssignmentResult
        {
            WorkItemId = GetInt(reader, "WorkItemId"),
            EmployeeId = GetNullableInt(reader, "EmployeeId"),
            ContractorId = GetNullableInt(reader, "ContractorId"),
            AssignmentType = GetString(reader, "AssignmentType") ?? string.Empty,
            AssignmentRole = GetString(reader, "AssignmentRole"),
            AssignedHours = GetNullableDecimal(reader, "AssignedHours"),
            IsManualAssignment = HasColumn(reader, "IsManualAssignment") && GetBool(reader, "IsManualAssignment"),
            EmployeeName = GetString(reader, "EmployeeName"),
            ContractorName = GetString(reader, "ContractorName")
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

    private static int? GetNullableInt(DbDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName))
        {
            return null;
        }

        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : Convert.ToInt32(reader.GetValue(ordinal));
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

    private static bool? GetNullableBool(DbDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName))
        {
            return null;
        }

        var ordinal = reader.GetOrdinal(columnName);
        return reader.IsDBNull(ordinal) ? null : Convert.ToBoolean(reader.GetValue(ordinal));
    }
}

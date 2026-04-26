using System.Data;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Models;
using Microsoft.Data.SqlClient;

namespace ManageR2.Infrastructure.Repositories;

public class SmartAssignmentRepository : ISmartAssignmentRepository
{
    private readonly DBServices _dbServices;

    public SmartAssignmentRepository(DBServices dbServices)
    {
        _dbServices = dbServices;
    }

    public async Task<SmartAssignmentInputModel> GetAssignmentInputAsync(int? projectId, List<int>? workItemIds, DateTime? planningDate)
    {
        var input = new SmartAssignmentInputModel();
        var workItemIdsCsv = workItemIds != null && workItemIds.Count > 0
            ? string.Join(",", workItemIds)
            : null;

        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("dbo.sp_Rec_GetAssignmentInput", connection)
        {
            CommandType = CommandType.StoredProcedure
        };

        command.Parameters.AddWithValue("@ProjectId", (object?)projectId ?? DBNull.Value);
        command.Parameters.AddWithValue("@PlanningDate", (object?)planningDate ?? DBNull.Value);
        command.Parameters.AddWithValue("@WorkItemIdsCsv", (object?)workItemIdsCsv ?? DBNull.Value);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            input.Tasks.Add(new SmartAssignmentTaskModel
            {
                WorkItemId = GetIntValue(reader, "WorkItemId"),
                TaskTitle = GetStringValue(reader, "TaskTitle")
                    ?? GetStringValue(reader, "Title")
                    ?? string.Empty,
                RequiredRole = GetStringValue(reader, "RequiredRole"),
                Priority = GetStringValue(reader, "Priority"),
                EstimatedHours = GetDecimalValue(reader, "EstimatedHours"),
                PlannedStart = GetDateTimeValue(reader, "PlannedStart"),
                PlannedEnd = GetDateTimeValue(reader, "PlannedEnd"),
                IsLocked = GetBoolValue(reader, "IsLocked")
            });
        }

        if (await reader.NextResultAsync())
        {
            while (await reader.ReadAsync())
            {
                input.Employees.Add(new SmartAssignmentEmployeeModel
                {
                    EmployeeId = GetIntValue(reader, "EmployeeId"),
                    EmployeeName = GetStringValue(reader, "EmployeeName")
                        ?? GetStringValue(reader, "FullName")
                        ?? string.Empty,
                    PrimaryRole = GetStringValue(reader, "PrimaryRole"),
                    IsAssignable = GetBoolValue(reader, "IsAssignable"),
                    IsActive = GetBoolValue(reader, "IsActive"),
                    CapacityHours = GetDecimalValue(reader, "CapacityHours")
                        ?? GetDecimalValue(reader, "DailyCapacityHours")
                });
            }
        }

        if (await reader.NextResultAsync())
        {
            while (await reader.ReadAsync())
            {
                input.Assignments.Add(new SmartAssignmentAssignmentModel
                {
                    WorkItemId = GetIntValue(reader, "WorkItemId"),
                    EmployeeId = GetNullableIntValue(reader, "EmployeeId"),
                    EmployeeName = GetStringValue(reader, "EmployeeName")
                        ?? GetStringValue(reader, "FullName"),
                    AssignedHours = GetDecimalValue(reader, "AssignedHours") ?? 0m
                });
            }
        }

        return input;
    }

    public Task<int> CreateRecommendationRunAsync(SmartAssignmentRunResultModel run)
    {
        throw new NotImplementedException("CreateRecommendationRunAsync is not implemented in milestone 1. Save-run persistence is planned for a later milestone.");
    }

    public Task SaveRecommendationsAsync(int recommendationRunId, List<SmartAssignmentRecommendationModel> recommendations)
    {
        throw new NotImplementedException("SaveRecommendationsAsync is not implemented in milestone 1. Save-run persistence is planned for a later milestone.");
    }

    public Task<SmartAssignmentRunResultModel?> GetRecommendationRunAsync(int recommendationRunId)
    {
        throw new NotImplementedException("GetRecommendationRunAsync is not implemented in milestone 1. Recommendation-run retrieval is planned for a later milestone.");
    }

    private static bool HasColumn(SqlDataReader reader, string columnName)
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

    private static decimal? GetDecimalValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return null;
        }

        return Convert.ToDecimal(reader[columnName]);
    }

    private static DateTime? GetDateTimeValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return null;
        }

        return Convert.ToDateTime(reader[columnName]);
    }

    private static bool GetBoolValue(SqlDataReader reader, string columnName)
    {
        if (!HasColumn(reader, columnName) || reader[columnName] == DBNull.Value)
        {
            return false;
        }

        return Convert.ToBoolean(reader[columnName]);
    }
}

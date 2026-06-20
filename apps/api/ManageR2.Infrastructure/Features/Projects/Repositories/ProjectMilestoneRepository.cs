using System.Data;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.DAL;
using Microsoft.Data.SqlClient;

namespace ManageR2.Infrastructure.Repositories;

public class ProjectMilestoneRepository : IProjectMilestoneRepository
{
    private readonly DBServices _dbServices;

    public ProjectMilestoneRepository(DBServices dbServices)
    {
        _dbServices = dbServices;
    }

    public async Task<List<ProjectMilestone>> GetByProjectIdAsync(int projectId)
    {
        var milestones = new List<ProjectMilestone>();

        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("sp_ProjectMilestones_GetByProject", connection)
        {
            CommandType = CommandType.StoredProcedure
        };
        command.Parameters.AddWithValue("@ProjectId", projectId);
        command.Parameters.AddWithValue("@IncludeInactive", false);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            milestones.Add(MapMilestone(reader));
        }

        return milestones;
    }

    public async Task<ProjectMilestone?> GetByIdAsync(int projectMilestoneId)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("sp_ProjectMilestones_GetById", connection)
        {
            CommandType = CommandType.StoredProcedure
        };
        command.Parameters.AddWithValue("@ProjectMilestoneId", projectMilestoneId);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        return await reader.ReadAsync() ? MapMilestone(reader) : null;
    }

    public async Task<int> CreateAsync(ProjectMilestone milestone)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("sp_ProjectMilestones_Create", connection)
        {
            CommandType = CommandType.StoredProcedure
        };
        command.Parameters.AddWithValue("@ProjectId", milestone.ProjectId);
        command.Parameters.AddWithValue("@Title", milestone.Title);
        command.Parameters.AddWithValue("@Description", (object?)milestone.Description ?? DBNull.Value);
        command.Parameters.AddWithValue("@SortOrder", milestone.SortOrder);
        command.Parameters.AddWithValue("@Status", milestone.Status);
        command.Parameters.AddWithValue("@ManagerEmployeeId", (object?)milestone.ManagerEmployeeId ?? DBNull.Value);
        command.Parameters.AddWithValue("@PlannedStart", (object?)milestone.PlannedStart ?? DBNull.Value);
        command.Parameters.AddWithValue("@PlannedEnd", (object?)milestone.PlannedEnd ?? DBNull.Value);

        await connection.OpenAsync();
        var result = await command.ExecuteScalarAsync();
        return result != null ? Convert.ToInt32(result) : 0;
    }

    public async Task<bool> UpdateAsync(ProjectMilestone milestone)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("sp_ProjectMilestones_Update", connection)
        {
            CommandType = CommandType.StoredProcedure
        };
        command.Parameters.AddWithValue("@ProjectMilestoneId", milestone.ProjectMilestoneId);
        command.Parameters.AddWithValue("@ProjectId", milestone.ProjectId);
        command.Parameters.AddWithValue("@Title", milestone.Title);
        command.Parameters.AddWithValue("@Description", (object?)milestone.Description ?? DBNull.Value);
        command.Parameters.AddWithValue("@SortOrder", milestone.SortOrder);
        command.Parameters.AddWithValue("@Status", milestone.Status);
        command.Parameters.AddWithValue("@ManagerEmployeeId", (object?)milestone.ManagerEmployeeId ?? DBNull.Value);
        command.Parameters.AddWithValue("@PlannedStart", (object?)milestone.PlannedStart ?? DBNull.Value);
        command.Parameters.AddWithValue("@PlannedEnd", (object?)milestone.PlannedEnd ?? DBNull.Value);
        command.Parameters.AddWithValue("@ActualStart", (object?)milestone.ActualStart ?? DBNull.Value);
        command.Parameters.AddWithValue("@ActualEnd", (object?)milestone.ActualEnd ?? DBNull.Value);
        command.Parameters.AddWithValue("@ProgressPercent", milestone.ProgressPercent);

        await connection.OpenAsync();
        var result = await command.ExecuteScalarAsync();
        return result != null && Convert.ToInt32(result) > 0;
    }

    public async Task<bool> ReorderAsync(int projectId, IReadOnlyList<(int ProjectMilestoneId, int SortOrder)> items)
    {
        await using var connection = _dbServices.CreateConnection();
        await connection.OpenAsync();

        foreach (var item in items)
        {
            await using var command = new SqlCommand("sp_ProjectMilestones_Reorder", connection)
            {
                CommandType = CommandType.StoredProcedure
            };
            command.Parameters.AddWithValue("@ProjectMilestoneId", item.ProjectMilestoneId);
            command.Parameters.AddWithValue("@ProjectId", projectId);
            command.Parameters.AddWithValue("@SortOrder", item.SortOrder);
            var result = await command.ExecuteScalarAsync();
            if (result == null || Convert.ToInt32(result) <= 0)
            {
                return false;
            }
        }

        return true;
    }

    public async Task<bool> DeactivateAsync(int projectId, int projectMilestoneId)
    {
        await using var connection = _dbServices.CreateConnection();
        await using var command = new SqlCommand("sp_ProjectMilestones_Deactivate", connection)
        {
            CommandType = CommandType.StoredProcedure
        };
        command.Parameters.AddWithValue("@ProjectMilestoneId", projectMilestoneId);
        command.Parameters.AddWithValue("@ProjectId", projectId);

        await connection.OpenAsync();
        var result = await command.ExecuteScalarAsync();
        return result != null && Convert.ToInt32(result) > 0;
    }

    private static ProjectMilestone MapMilestone(SqlDataReader reader)
    {
        return new ProjectMilestone
        {
            ProjectMilestoneId = Convert.ToInt32(reader["ProjectMilestoneId"]),
            ProjectId = Convert.ToInt32(reader["ProjectId"]),
            Title = reader["Title"]?.ToString() ?? string.Empty,
            Description = reader["Description"] == DBNull.Value ? null : reader["Description"]?.ToString(),
            SortOrder = Convert.ToInt32(reader["SortOrder"]),
            Status = reader["Status"]?.ToString() ?? string.Empty,
            PlannedStart = reader["PlannedStart"] == DBNull.Value ? null : Convert.ToDateTime(reader["PlannedStart"]),
            PlannedEnd = reader["PlannedEnd"] == DBNull.Value ? null : Convert.ToDateTime(reader["PlannedEnd"]),
            ActualStart = reader["ActualStart"] == DBNull.Value ? null : Convert.ToDateTime(reader["ActualStart"]),
            ActualEnd = reader["ActualEnd"] == DBNull.Value ? null : Convert.ToDateTime(reader["ActualEnd"]),
            ProgressPercent = Convert.ToInt32(reader["ProgressPercent"]),
            ManagerEmployeeId = reader["ManagerEmployeeId"] == DBNull.Value
                ? null
                : Convert.ToInt32(reader["ManagerEmployeeId"]),
            IsActive = Convert.ToBoolean(reader["IsActive"]),
            CreatedAt = Convert.ToDateTime(reader["CreatedAt"]),
            UpdatedAt = reader["UpdatedAt"] == DBNull.Value ? null : Convert.ToDateTime(reader["UpdatedAt"]),
            LegacyWorkItemId = reader["LegacyWorkItemId"] == DBNull.Value ? null : Convert.ToInt32(reader["LegacyWorkItemId"])
        };
    }
}

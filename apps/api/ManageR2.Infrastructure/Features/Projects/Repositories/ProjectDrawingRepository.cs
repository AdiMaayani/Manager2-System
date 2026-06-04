using System.Data;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Models;
using Microsoft.Data.SqlClient;

namespace ManageR2.Infrastructure.Repositories;

public class ProjectDrawingRepository : IProjectDrawingRepository
{
    private readonly DBServices _dbServices;

    public ProjectDrawingRepository(DBServices dbServices)
    {
        _dbServices = dbServices;
    }

    public async Task<IReadOnlyList<ProjectDrawingModel>> GetByProjectIdAsync(int projectId)
    {
        var drawings = new List<ProjectDrawingModel>();

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_ProjectDrawings_GetByProject", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@ProjectId", projectId);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                drawings.Add(MapProjectDrawing(reader));
            }

            return drawings;
        }
        catch (SqlException ex)
        {
            throw new UserValidationException("Failed to retrieve project drawings.", ex);
        }
    }

    public async Task<int> CreateAsync(ProjectDrawingModel drawing)
    {
        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_ProjectDrawings_Create", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@ProjectId", drawing.ProjectId);
            command.Parameters.AddWithValue("@Name", drawing.Name);
            command.Parameters.AddWithValue("@Type", drawing.Type);
            command.Parameters.AddWithValue("@DrawingDate", drawing.DrawingDate.ToDateTime(TimeOnly.MinValue));
            command.Parameters.AddWithValue("@Note", (object?)drawing.Note ?? DBNull.Value);
            command.Parameters.AddWithValue("@SortOrder", drawing.SortOrder > 0 ? drawing.SortOrder : DBNull.Value);

            await connection.OpenAsync();
            var result = await command.ExecuteScalarAsync();

            return result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;
        }
        catch (SqlException ex)
        {
            throw new UserValidationException("Failed to create project drawing.", ex);
        }
    }

    public async Task<bool> UpdateAsync(ProjectDrawingModel drawing)
    {
        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_ProjectDrawings_Update", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@ProjectDrawingId", drawing.ProjectDrawingId);
            command.Parameters.AddWithValue("@ProjectId", drawing.ProjectId);
            command.Parameters.AddWithValue("@Name", drawing.Name);
            command.Parameters.AddWithValue("@Type", drawing.Type);
            command.Parameters.AddWithValue("@DrawingDate", drawing.DrawingDate.ToDateTime(TimeOnly.MinValue));
            command.Parameters.AddWithValue("@Note", (object?)drawing.Note ?? DBNull.Value);
            command.Parameters.AddWithValue("@SortOrder", drawing.SortOrder);

            await connection.OpenAsync();
            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;

            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            throw new UserValidationException("Failed to update project drawing.", ex);
        }
    }

    public async Task<bool> DeleteAsync(int projectId, int projectDrawingId)
    {
        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.sp_ProjectDrawings_Delete", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.AddWithValue("@ProjectId", projectId);
            command.Parameters.AddWithValue("@ProjectDrawingId", projectDrawingId);

            await connection.OpenAsync();
            var result = await command.ExecuteScalarAsync();
            var rowsAffected = result != null && result != DBNull.Value ? Convert.ToInt32(result) : 0;

            return rowsAffected > 0;
        }
        catch (SqlException ex)
        {
            throw new UserValidationException("Failed to delete project drawing.", ex);
        }
    }

    private static ProjectDrawingModel MapProjectDrawing(SqlDataReader reader)
    {
        return new ProjectDrawingModel
        {
            ProjectDrawingId = GetIntValue(reader, "ProjectDrawingId"),
            ProjectId = GetIntValue(reader, "ProjectId"),
            Name = GetStringValue(reader, "Name") ?? string.Empty,
            Type = GetStringValue(reader, "Type") ?? string.Empty,
            DrawingDate = GetDateOnlyValue(reader, "DrawingDate") ?? DateOnly.MinValue,
            Note = GetStringValue(reader, "Note"),
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

    private static DateOnly? GetDateOnlyValue(SqlDataReader reader, string columnName)
    {
        if (reader[columnName] == DBNull.Value)
        {
            return null;
        }

        return DateOnly.FromDateTime(Convert.ToDateTime(reader[columnName]));
    }

    private static DateTime? GetDateTimeValue(SqlDataReader reader, string columnName)
    {
        return reader[columnName] == DBNull.Value ? null : Convert.ToDateTime(reader[columnName]);
    }
}

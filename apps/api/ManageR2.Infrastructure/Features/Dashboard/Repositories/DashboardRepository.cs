using System.Data;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Interfaces;
using ManageR2.Infrastructure.Models;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Repositories;

// Dashboard read model: ADO.NET stored-procedure calls only (dbo.sp_Dashboard_*), no inline SQL,
// no writes. Each method opens a short-lived connection and maps the SP result set to a row model.
public class DashboardRepository : IDashboardRepository
{
    private readonly DBServices _dbServices;
    private readonly ILogger<DashboardRepository> _logger;

    public DashboardRepository(DBServices dbServices, ILogger<DashboardRepository> logger)
    {
        _dbServices = dbServices;
        _logger = logger;
    }

    public async Task<IReadOnlyList<DashboardPersonalTaskRow>> GetPersonalTasksAsync(int employeeId)
    {
        if (employeeId <= 0)
        {
            return new List<DashboardPersonalTaskRow>();
        }

        return await ExecuteListAsync(
            "dbo.sp_Dashboard_GetPersonalTasks",
            command => command.Parameters.AddWithValue("@EmployeeId", employeeId),
            reader => new DashboardPersonalTaskRow
            {
                WorkItemId = GetInt(reader, "WorkItemId"),
                Title = GetString(reader, "Title"),
                Status = GetNullableString(reader, "Status"),
                Priority = GetNullableString(reader, "Priority"),
                PlannedStart = GetNullableDateTime(reader, "PlannedStart"),
                PlannedEnd = GetNullableDateTime(reader, "PlannedEnd"),
                ProjectId = GetNullableInt(reader, "ProjectId"),
                ProjectTitle = GetNullableString(reader, "ProjectTitle"),
                ProjectNumber = GetNullableString(reader, "ProjectNumber"),
                CustomerName = GetNullableString(reader, "CustomerName"),
                SiteName = GetNullableString(reader, "SiteName"),
                AssignmentRole = GetNullableString(reader, "AssignmentRole"),
            },
            "personal tasks");
    }

    public async Task<IReadOnlyList<DashboardServiceCallRow>> GetServiceCallExceptionsAsync(int? employeeId, bool includeOrgWide)
    {
        return await ExecuteListAsync(
            "dbo.sp_Dashboard_GetServiceCallExceptions",
            command =>
            {
                command.Parameters.AddWithValue("@EmployeeId", (object?)employeeId ?? DBNull.Value);
                command.Parameters.AddWithValue("@IncludeOrgWide", includeOrgWide);
            },
            reader => new DashboardServiceCallRow
            {
                WorkItemId = GetInt(reader, "WorkItemId"),
                Title = GetString(reader, "Title"),
                Status = GetNullableString(reader, "Status"),
                Priority = GetNullableString(reader, "Priority"),
                PlannedStart = GetNullableDateTime(reader, "PlannedStart"),
                PlannedEnd = GetNullableDateTime(reader, "PlannedEnd"),
                CreatedAt = GetDateTime(reader, "CreatedAt"),
                CustomerId = GetInt(reader, "CustomerId"),
                CustomerName = GetNullableString(reader, "CustomerName"),
                SiteId = GetNullableInt(reader, "SiteId"),
                SiteName = GetNullableString(reader, "SiteName"),
                IsUnassigned = GetBool(reader, "IsUnassigned"),
                IsAssignedToMe = GetBool(reader, "IsAssignedToMe"),
                IsUrgent = GetBool(reader, "IsUrgent"),
            },
            "service call exceptions");
    }

    public async Task<IReadOnlyList<DashboardProjectAttentionRow>> GetProjectsNeedingAttentionAsync(int? managerEmployeeId, bool onlyManaged)
    {
        return await ExecuteListAsync(
            "dbo.sp_Dashboard_GetProjectsNeedingAttention",
            command =>
            {
                command.Parameters.AddWithValue("@ManagerEmployeeId", (object?)managerEmployeeId ?? DBNull.Value);
                command.Parameters.AddWithValue("@OnlyManaged", onlyManaged);
            },
            reader => new DashboardProjectAttentionRow
            {
                WorkItemId = GetInt(reader, "WorkItemId"),
                Title = GetString(reader, "Title"),
                FinanceProjectNumber = GetNullableString(reader, "FinanceProjectNumber"),
                Status = GetNullableString(reader, "Status"),
                CustomerName = GetNullableString(reader, "CustomerName"),
                ProjectManagerName = GetNullableString(reader, "ProjectManagerName"),
                HasNoProjectManager = GetBool(reader, "HasNoProjectManager"),
                OverdueTaskCount = GetInt(reader, "OverdueTaskCount"),
                NearestOverdueDate = GetNullableDateTime(reader, "NearestOverdueDate"),
            },
            "projects needing attention");
    }

    public async Task<IReadOnlyList<DashboardQuoteFollowUpRow>> GetQuotesNeedingFollowUpAsync(int staleDays)
    {
        return await ExecuteListAsync(
            "dbo.sp_Dashboard_GetQuotesNeedingFollowUp",
            command => command.Parameters.AddWithValue("@StaleDays", staleDays),
            reader => new DashboardQuoteFollowUpRow
            {
                QuoteId = GetInt(reader, "QuoteId"),
                QuoteNumber = GetString(reader, "QuoteNumber"),
                CustomerId = GetInt(reader, "CustomerId"),
                CustomerName = GetNullableString(reader, "CustomerName"),
                ProjectId = GetNullableInt(reader, "ProjectId"),
                ProjectTitle = GetNullableString(reader, "ProjectTitle"),
                Status = GetNullableString(reader, "Status"),
                QuoteDate = GetDateTime(reader, "QuoteDate"),
                ValidUntil = GetNullableDateTime(reader, "ValidUntil"),
                UpdatedAt = GetNullableDateTime(reader, "UpdatedAt"),
                Total = GetDecimal(reader, "Total"),
                DaysSinceActivity = GetInt(reader, "DaysSinceActivity"),
                IsExpired = GetBool(reader, "IsExpired"),
            },
            "quotes needing follow-up");
    }

    public async Task<IReadOnlyList<DashboardCustomerContactGapRow>> GetCustomersMissingContactInfoAsync()
    {
        return await ExecuteListAsync(
            "dbo.sp_Dashboard_GetCustomersMissingContactInfo",
            _ => { },
            reader => new DashboardCustomerContactGapRow
            {
                CustomerId = GetInt(reader, "CustomerId"),
                CustomerName = GetString(reader, "CustomerName"),
                CustomerType = GetNullableString(reader, "CustomerType"),
                City = GetNullableString(reader, "City"),
                Status = GetNullableString(reader, "Status"),
            },
            "customers missing contact info");
    }

    public async Task<IReadOnlyList<DashboardDraftReportRow>> GetMyDraftReportsAsync(int employeeId)
    {
        if (employeeId <= 0)
        {
            return new List<DashboardDraftReportRow>();
        }

        return await ExecuteListAsync(
            "dbo.sp_Dashboard_GetMyDraftReports",
            command => command.Parameters.AddWithValue("@EmployeeId", employeeId),
            reader => new DashboardDraftReportRow
            {
                WorkReportId = GetInt(reader, "WorkReportId"),
                WorkItemId = GetNullableInt(reader, "WorkItemId"),
                ReportType = GetNullableString(reader, "ReportType"),
                ReportDate = GetNullableDateTime(reader, "ReportDate"),
                ProjectName = GetNullableString(reader, "ProjectName"),
                CustomerName = GetNullableString(reader, "CustomerName"),
                Status = GetNullableString(reader, "Status"),
            },
            "my draft reports");
    }

    private async Task<IReadOnlyList<T>> ExecuteListAsync<T>(
        string procedureName,
        Action<SqlCommand> configureParameters,
        Func<SqlDataReader, T> map,
        string operationLabel)
    {
        var results = new List<T>();

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand(procedureName, connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            configureParameters(command);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                results.Add(map(reader));
            }

            return results;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Dashboard query failed with SQL error while reading {Operation}.", operationLabel);
            throw new UserValidationException("Failed to load dashboard data from the database.", ex);
        }
    }

    private static int GetInt(SqlDataReader reader, string column) =>
        Convert.ToInt32(reader[column]);

    private static int? GetNullableInt(SqlDataReader reader, string column) =>
        reader[column] != DBNull.Value ? Convert.ToInt32(reader[column]) : null;

    private static decimal GetDecimal(SqlDataReader reader, string column) =>
        reader[column] != DBNull.Value ? Convert.ToDecimal(reader[column]) : 0m;

    private static bool GetBool(SqlDataReader reader, string column) =>
        reader[column] != DBNull.Value && Convert.ToBoolean(reader[column]);

    private static string GetString(SqlDataReader reader, string column) =>
        reader[column] != DBNull.Value ? reader[column].ToString() ?? string.Empty : string.Empty;

    private static string? GetNullableString(SqlDataReader reader, string column) =>
        reader[column] != DBNull.Value ? reader[column].ToString() : null;

    private static DateTime GetDateTime(SqlDataReader reader, string column) =>
        Convert.ToDateTime(reader[column]);

    private static DateTime? GetNullableDateTime(SqlDataReader reader, string column) =>
        reader[column] != DBNull.Value ? Convert.ToDateTime(reader[column]) : null;
}

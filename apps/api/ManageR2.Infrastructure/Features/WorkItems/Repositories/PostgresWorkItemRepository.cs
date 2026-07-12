using System.Data.Common;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Features.WorkItems.Models;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Repositories;
using Npgsql;

namespace ManageR2.Infrastructure.Features.WorkItems.Repositories;

// PostgreSQL implementation of IWorkItemRepository (migration target, Wave 3). Reproduces the SQL Server
// work-item / work-plan / milestone / assignment stored procedures as parameterized SQL against the
// translated schema. Projections mirror each SP column list so shadow-read parity holds through the
// shared MapWorkItem mapping. Business validation (category derivation, THROW guards) is reproduced so
// invalid writes are rejected exactly as the SPs reject them.
public sealed partial class PostgresWorkItemRepository : IWorkItemRepository
{
    private readonly PostgresConnectionFactory _connectionFactory;

    public PostgresWorkItemRepository(PostgresConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    // Mirrors sp_GetWorkItems (INNER JOIN Customers, LEFT JOIN Sites, ORDER BY CreatedAt DESC).
    public async Task<List<WorkItem>> GetAllAsync()
    {
        var workItems = new List<WorkItem>();
        await using var connection = _connectionFactory.CreateConnection();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT wi."WorkItemId", wi."Title", wi."WorkType", wi."Status", wi."BillingType", wi."Description",
                   wi."CustomerId", c."CustomerName", wi."SiteId", s."SiteName", wi."CreatedAt", wi."ClosedAt",
                   wi."DealCloseDate", wi."FinanceProjectNumber", wi."InvoiceNumber"
            FROM "WorkItems" wi
            INNER JOIN "Customers" c ON wi."CustomerId" = c."CustomerId"
            LEFT JOIN "Sites" s ON wi."SiteId" = s."SiteId"
            ORDER BY wi."CreatedAt" DESC
            """;

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            workItems.Add(MapWorkItem(reader));
        }

        return workItems;
    }

    // Mirrors sp_GetWorkItemDetails (LEFT JOINs to parent project + milestone).
    public async Task<WorkItem?> GetByIdAsync(int workItemId)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT wi."WorkItemId", wi."Title", wi."WorkType", wi."TaskCategory", wi."Status", wi."BillingType",
                   wi."Description", wi."CustomerId", c."CustomerName", wi."SiteId", s."SiteName",
                   wi."CreatedAt", wi."ClosedAt", wi."ParentWorkItemId", p."Title" AS "ProjectTitle",
                   wi."MilestoneId", m."Title" AS "MilestoneTitle", wi."DealCloseDate", wi."FinanceProjectNumber",
                   wi."InvoiceNumber", wi."PlannedStart", wi."PlannedEnd", wi."EstimatedHours", wi."ActualStart",
                   wi."ActualEnd", wi."ActualHours", wi."Priority", wi."RequiredRole", wi."IsLocked",
                   wi."IsArchived", wi."ArchivedAt"
            FROM "WorkItems" wi
            LEFT JOIN "Customers" c ON c."CustomerId" = wi."CustomerId"
            LEFT JOIN "Sites" s ON s."SiteId" = wi."SiteId"
            LEFT JOIN "WorkItems" p ON p."WorkItemId" = wi."ParentWorkItemId"
            LEFT JOIN "ProjectMilestones" m ON m."ProjectMilestoneId" = wi."MilestoneId"
            WHERE wi."WorkItemId" = @WorkItemId
            """;
        AddParameter(command, "@WorkItemId", workItemId);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        return await reader.ReadAsync() ? MapWorkItem(reader) : null;
    }

    // Mirrors sp_GetWorkItemsByType (WorkType filter, IsArchived = 0).
    public async Task<List<WorkItem>> GetByTypeAsync(string workType)
    {
        var workItems = new List<WorkItem>();
        await using var connection = _connectionFactory.CreateConnection();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT wi."WorkItemId", wi."Title", wi."Description", wi."WorkType", wi."TaskCategory",
                   wi."BillingType", wi."Status", wi."EstimatedHours", wi."ActualStart", wi."ActualEnd",
                   wi."ActualHours", wi."Priority", wi."PlannedStart", wi."PlannedEnd", wi."RequiredRole",
                   wi."IsLocked", wi."CustomerId", c."CustomerName", wi."SiteId", s."SiteName", wi."CreatedAt",
                   wi."ClosedAt", wi."ParentWorkItemId", wi."DealCloseDate", wi."FinanceProjectNumber",
                   wi."InvoiceNumber", wi."MilestoneId", wi."IsArchived", wi."ArchivedAt"
            FROM "WorkItems" wi
            LEFT JOIN "Customers" c ON wi."CustomerId" = c."CustomerId"
            LEFT JOIN "Sites" s ON wi."SiteId" = s."SiteId"
            WHERE wi."WorkType" = @WorkType AND wi."IsArchived" = false
            ORDER BY wi."CreatedAt" DESC
            """;
        AddParameter(command, "@WorkType", workType);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            workItems.Add(MapWorkItem(reader));
        }

        return workItems;
    }

    // Mirrors sp_GetTasksByParentWorkItemId.
    public async Task<List<WorkItem>> GetTasksByParentIdAsync(int parentWorkItemId)
    {
        var workItems = new List<WorkItem>();
        await using var connection = _connectionFactory.CreateConnection();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT wi."WorkItemId", wi."Title", wi."Description", wi."WorkType", wi."BillingType", wi."Status",
                   wi."CustomerId", c."CustomerName", wi."SiteId", wi."CreatedAt", wi."ClosedAt",
                   wi."ParentWorkItemId", wi."DealCloseDate", wi."FinanceProjectNumber", wi."InvoiceNumber"
            FROM "WorkItems" wi
            LEFT JOIN "Customers" c ON wi."CustomerId" = c."CustomerId"
            WHERE wi."ParentWorkItemId" = @ParentWorkItemId
            ORDER BY wi."CreatedAt" DESC
            """;
        AddParameter(command, "@ParentWorkItemId", parentWorkItemId);

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            workItems.Add(MapWorkItem(reader));
        }

        return workItems;
    }

    // Mirrors sp_GetProjectsList (PM = latest employee assignment with a manager/team-leader role).
    public async Task<List<ProjectListItemResult>> GetProjectsListAsync()
    {
        var projects = new List<ProjectListItemResult>();
        await using var connection = _connectionFactory.CreateConnection();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT wi."WorkItemId", wi."Title", c."CustomerName", wi."Status", wi."BillingType", wi."CreatedAt",
                   wi."DealCloseDate", wi."FinanceProjectNumber", wi."InvoiceNumber",
                   COALESCE(s."SiteName", '-') AS "SiteName",
                   COALESCE(pm."FullName", '-') AS "ProjectManagerName"
            FROM "WorkItems" wi
            LEFT JOIN "Customers" c ON wi."CustomerId" = c."CustomerId"
            LEFT JOIN "Sites" s ON wi."SiteId" = s."SiteId"
            LEFT JOIN (
                SELECT wea."WorkItemId", e."FullName",
                       ROW_NUMBER() OVER (
                           PARTITION BY wea."WorkItemId"
                           ORDER BY wea."AssignedAt" DESC, wea."WorkEmployeeAssignmentId" DESC
                       ) AS "RowNum"
                FROM "WorkEmployeeAssignments" wea
                INNER JOIN "Employees" e ON wea."EmployeeId" = e."EmployeeId"
                WHERE btrim(lower(wea."AssignmentRole")) IN ('project manager', 'מנהל פרויקט', 'team leader')
            ) pm ON wi."WorkItemId" = pm."WorkItemId" AND pm."RowNum" = 1
            WHERE wi."WorkType" = 'Project'
              AND wi."IsArchived" = false
              AND COALESCE(wi."FinanceProjectNumber", '') <> 'INTERNAL'
            ORDER BY wi."CreatedAt" DESC
            """;

        await connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            projects.Add(new ProjectListItemResult
            {
                WorkItemId = GetInt(reader, "WorkItemId"),
                Title = GetString(reader, "Title") ?? string.Empty,
                CustomerName = GetString(reader, "CustomerName") ?? string.Empty,
                ProjectManagerName = GetString(reader, "ProjectManagerName") ?? "-",
                Status = GetString(reader, "Status") ?? string.Empty,
                CreatedAt = GetDateTime(reader, "CreatedAt") ?? DateTime.MinValue,
                SiteName = GetString(reader, "SiteName") ?? "-",
                BillingType = GetString(reader, "BillingType") ?? string.Empty,
                DealCloseDate = GetDateTime(reader, "DealCloseDate"),
                FinanceProjectNumber = GetString(reader, "FinanceProjectNumber"),
                InvoiceNumber = GetString(reader, "InvoiceNumber")
            });
        }

        return projects;
    }
}

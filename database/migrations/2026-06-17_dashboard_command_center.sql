/*
    ManageR2 Dashboard Command Center migration (feature/dashboard-command-center).

    Run this script manually in SSMS (or sqlcmd) against the intended target database:

        sqlcmd -S localhost -d ManageR2_Dev -i database/migrations/2026-06-17_dashboard_command_center.sql

    Purpose:
        Focused, READ-ONLY stored procedures that back the single GET /api/dashboard
        endpoint. Each procedure answers one dashboard question with a small, capped,
        set-based result so the API never fans out across many module endpoints or
        triggers per-row (N+1) lookups.

        Procedures created (all dbo.sp_Dashboard_*):
          1. sp_Dashboard_GetPersonalTasks          - open work-plan tasks assigned to one employee
          2. sp_Dashboard_GetServiceCallExceptions  - open service calls (personal or org-wide)
          3. sp_Dashboard_GetProjectsNeedingAttention - active projects missing a PM or with overdue tasks
          4. sp_Dashboard_GetQuotesNeedingFollowUp  - Sent/Tracking quotes with no recent activity
          5. sp_Dashboard_GetCustomersMissingContactInfo - active customers with no reachable contact
          6. sp_Dashboard_GetMyDraftReports         - the caller's own unsubmitted (draft) work reports

        Low-stock inventory reuses the existing dbo.sp_Inventory_GetList (@LowStockOnly = 1).
        Recent activity reuses the existing dbo.sp_AuditLog_GetList (read path, sanitized in the API).

    Conventions baked into every procedure:
        - "Overdue" / "today" use the START OF TODAY: a date-only comparison
          (PlannedEnd < CAST(GETDATE() AS DATE) is overdue; a task due later today is NOT overdue).
        - "Open / pending" work excludes the terminal statuses 'Closed', 'Cancelled' and 'Done'.
        - Projects exclude the reserved internal container (FinanceProjectNumber = 'INTERNAL').

    Safety:
        - Additive only. Creates NO tables/columns and modifies NO existing object or data.
          Only adds six new read-only stored procedures via CREATE OR ALTER (idempotent).
        - Re-running the script is safe and has no side effects.

    Security notes:
        - These procedures expose only operational fields (titles, statuses, dates, counts,
          customer/site/project names). They never read AuditLog, secret vault tables, IP
          addresses, user agents, or any encrypted/secret value.
*/

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* ============================================================
   1. Personal tasks (every role)
   Open work-plan tasks (WorkType='Task') assigned to @EmployeeId.
   The API classifies each row into "today", "overdue" or "upcoming"
   using PlannedStart/PlannedEnd, so a single small set is returned here.
   ============================================================ */
CREATE OR ALTER PROCEDURE dbo.sp_Dashboard_GetPersonalTasks
    @EmployeeId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @EmployeeId IS NULL OR @EmployeeId <= 0
        RETURN;

    SELECT TOP (200)
        wi.WorkItemId,
        wi.Title,
        wi.Status,
        wi.Priority,
        wi.PlannedStart,
        wi.PlannedEnd,
        wi.ParentWorkItemId          AS ProjectId,
        p.Title                      AS ProjectTitle,
        p.FinanceProjectNumber       AS ProjectNumber,
        COALESCE(c.CustomerName, pc.CustomerName) AS CustomerName,
        COALESCE(s.SiteName, ps.SiteName)         AS SiteName,
        wea.AssignmentRole
    FROM dbo.WorkItems AS wi
    INNER JOIN dbo.WorkEmployeeAssignments AS wea
        ON wea.WorkItemId = wi.WorkItemId
       AND wea.EmployeeId = @EmployeeId
    LEFT JOIN dbo.WorkItems AS p  ON p.WorkItemId  = wi.ParentWorkItemId
    LEFT JOIN dbo.Customers AS c  ON c.CustomerId  = wi.CustomerId
    LEFT JOIN dbo.Customers AS pc ON pc.CustomerId = p.CustomerId
    LEFT JOIN dbo.Sites     AS s  ON s.SiteId      = wi.SiteId
    LEFT JOIN dbo.Sites     AS ps ON ps.SiteId     = p.SiteId
    WHERE wi.WorkType = N'Task'
      AND wi.Status NOT IN (N'Closed', N'Cancelled', N'Done')
    ORDER BY
        CASE WHEN wi.PlannedEnd IS NULL THEN 1 ELSE 0 END,
        wi.PlannedEnd ASC,
        wi.PlannedStart ASC;
END
GO

/* ============================================================
   2. Service call exceptions
   Open service calls (WorkType='ServiceCall', Status IN Open/InProgress).
   @IncludeOrgWide = 1 -> all open service calls (management / office / PM).
   @IncludeOrgWide = 0 -> only calls assigned to @EmployeeId (technician).
   Urgent = Priority='Urgent'; unassigned = no employee assignment row.
   ============================================================ */
CREATE OR ALTER PROCEDURE dbo.sp_Dashboard_GetServiceCallExceptions
    @EmployeeId     INT = NULL,
    @IncludeOrgWide BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (50)
        wi.WorkItemId,
        wi.Title,
        wi.Status,
        wi.Priority,
        wi.PlannedStart,
        wi.PlannedEnd,
        wi.CreatedAt,
        wi.CustomerId,
        c.CustomerName,
        wi.SiteId,
        s.SiteName,
        CAST(CASE WHEN NOT EXISTS (
                SELECT 1 FROM dbo.WorkEmployeeAssignments a
                WHERE a.WorkItemId = wi.WorkItemId
            ) THEN 1 ELSE 0 END AS BIT) AS IsUnassigned,
        CAST(CASE WHEN @EmployeeId IS NOT NULL AND EXISTS (
                SELECT 1 FROM dbo.WorkEmployeeAssignments a
                WHERE a.WorkItemId = wi.WorkItemId AND a.EmployeeId = @EmployeeId
            ) THEN 1 ELSE 0 END AS BIT) AS IsAssignedToMe,
        CAST(CASE WHEN wi.Priority = N'Urgent' THEN 1 ELSE 0 END AS BIT) AS IsUrgent
    FROM dbo.WorkItems AS wi
    LEFT JOIN dbo.Customers AS c ON c.CustomerId = wi.CustomerId
    LEFT JOIN dbo.Sites     AS s ON s.SiteId     = wi.SiteId
    WHERE wi.WorkType = N'ServiceCall'
      AND wi.Status IN (N'Open', N'InProgress')
      AND (
            @IncludeOrgWide = 1
            OR (
                @EmployeeId IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM dbo.WorkEmployeeAssignments a
                    WHERE a.WorkItemId = wi.WorkItemId AND a.EmployeeId = @EmployeeId
                )
            )
      )
    ORDER BY
        CASE WHEN wi.Priority = N'Urgent' THEN 0 ELSE 1 END,
        CASE WHEN NOT EXISTS (
                SELECT 1 FROM dbo.WorkEmployeeAssignments a WHERE a.WorkItemId = wi.WorkItemId
            ) THEN 0 ELSE 1 END,
        wi.CreatedAt ASC;
END
GO

/* ============================================================
   3. Projects needing attention
   Active projects (WorkType='Project', not Closed/Cancelled, not INTERNAL)
   that either have no project manager OR have at least one overdue task.
   PM role recognized exactly as in sp_GetProjectsList.
   @OnlyManaged = 1 limits to projects the given employee manages (ProjectManager role).
   ============================================================ */
CREATE OR ALTER PROCEDURE dbo.sp_Dashboard_GetProjectsNeedingAttention
    @ManagerEmployeeId INT = NULL,
    @OnlyManaged       BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

    ;WITH ActiveProjects AS (
        SELECT p.WorkItemId, p.Title, p.FinanceProjectNumber, p.Status, p.CustomerId
        FROM dbo.WorkItems AS p
        WHERE p.WorkType = N'Project'
          AND p.Status NOT IN (N'Closed', N'Cancelled')
          AND (p.FinanceProjectNumber IS NULL OR p.FinanceProjectNumber <> N'INTERNAL')
    ),
    ProjectManagers AS (
        SELECT wea.WorkItemId, MIN(e.FullName) AS ProjectManagerName
        FROM dbo.WorkEmployeeAssignments AS wea
        INNER JOIN dbo.Employees AS e ON e.EmployeeId = wea.EmployeeId
        WHERE LTRIM(RTRIM(LOWER(wea.AssignmentRole))) IN (N'project manager', N'מנהל פרויקט', N'team leader')
        GROUP BY wea.WorkItemId
    ),
    OverdueTasks AS (
        SELECT t.ParentWorkItemId AS ProjectId,
               COUNT(*)           AS OverdueTaskCount,
               MIN(t.PlannedEnd)  AS NearestOverdueDate
        FROM dbo.WorkItems AS t
        WHERE t.WorkType = N'Task'
          AND t.Status NOT IN (N'Closed', N'Cancelled', N'Done')
          AND t.PlannedEnd IS NOT NULL
          AND t.PlannedEnd < @Today
        GROUP BY t.ParentWorkItemId
    )
    SELECT TOP (50)
        ap.WorkItemId,
        ap.Title,
        ap.FinanceProjectNumber,
        ap.Status,
        c.CustomerName,
        pm.ProjectManagerName,
        CAST(CASE WHEN pm.WorkItemId IS NULL THEN 1 ELSE 0 END AS BIT) AS HasNoProjectManager,
        ISNULL(od.OverdueTaskCount, 0) AS OverdueTaskCount,
        od.NearestOverdueDate
    FROM ActiveProjects AS ap
    LEFT JOIN dbo.Customers   AS c  ON c.CustomerId  = ap.CustomerId
    LEFT JOIN ProjectManagers AS pm ON pm.WorkItemId = ap.WorkItemId
    LEFT JOIN OverdueTasks    AS od ON od.ProjectId  = ap.WorkItemId
    WHERE (pm.WorkItemId IS NULL OR ISNULL(od.OverdueTaskCount, 0) > 0)
      AND (
            @OnlyManaged = 0
            OR (
                @ManagerEmployeeId IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM dbo.WorkEmployeeAssignments AS mwea
                    WHERE mwea.WorkItemId = ap.WorkItemId
                      AND mwea.EmployeeId = @ManagerEmployeeId
                      AND LTRIM(RTRIM(LOWER(mwea.AssignmentRole))) IN (N'project manager', N'מנהל פרויקט', N'team leader')
                )
            )
      )
    ORDER BY
        CASE WHEN pm.WorkItemId IS NULL THEN 0 ELSE 1 END,
        ISNULL(od.OverdueTaskCount, 0) DESC,
        ap.Title ASC;
END
GO

/* ============================================================
   4. Quotes needing follow-up
   Active quotes awaiting a customer response (Status IN Sent/Tracking) whose
   last activity (UpdatedAt, else QuoteDate) is at least @StaleDays old.
   No payment/cashflow logic - this is purely a follow-up reminder.
   ============================================================ */
CREATE OR ALTER PROCEDURE dbo.sp_Dashboard_GetQuotesNeedingFollowUp
    @StaleDays INT = 7
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Days INT = CASE WHEN @StaleDays IS NULL OR @StaleDays < 0 THEN 7 ELSE @StaleDays END;
    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

    SELECT TOP (50)
        q.QuoteId,
        q.QuoteNumber,
        q.CustomerId,
        c.CustomerName,
        q.ProjectId,
        p.Title AS ProjectTitle,
        q.Status,
        q.QuoteDate,
        q.ValidUntil,
        q.UpdatedAt,
        q.Total,
        DATEDIFF(DAY, COALESCE(CAST(q.UpdatedAt AS DATE), q.QuoteDate), @Today) AS DaysSinceActivity,
        CAST(CASE WHEN q.ValidUntil IS NOT NULL AND q.ValidUntil < @Today THEN 1 ELSE 0 END AS BIT) AS IsExpired
    FROM dbo.Quotes AS q
    LEFT JOIN dbo.Customers AS c ON c.CustomerId = q.CustomerId
    LEFT JOIN dbo.WorkItems AS p ON p.WorkItemId = q.ProjectId
    WHERE q.IsActive = 1
      AND q.Status IN (N'Sent', N'Tracking')
      AND DATEDIFF(DAY, COALESCE(CAST(q.UpdatedAt AS DATE), q.QuoteDate), @Today) >= @Days
    ORDER BY DaysSinceActivity DESC, q.QuoteDate ASC;
END
GO

/* ============================================================
   5. Customers missing reachable contact information
   Active customers that have NO usable phone/email of their own AND no active
   contact that carries a phone or email. Empty/whitespace values count as missing.
   ============================================================ */
CREATE OR ALTER PROCEDURE dbo.sp_Dashboard_GetCustomersMissingContactInfo
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (50)
        cu.CustomerId,
        cu.CustomerName,
        cu.CustomerType,
        cu.City,
        cu.Status
    FROM dbo.Customers AS cu
    WHERE cu.IsActive = 1
      AND NULLIF(LTRIM(RTRIM(cu.PrimaryPhone)), N'') IS NULL
      AND NULLIF(LTRIM(RTRIM(cu.PrimaryEmail)), N'') IS NULL
      AND NULLIF(LTRIM(RTRIM(cu.Phone)), N'') IS NULL
      AND NULLIF(LTRIM(RTRIM(cu.Email)), N'') IS NULL
      AND NOT EXISTS (
            SELECT 1
            FROM dbo.Contacts AS ct
            WHERE ct.CustomerId = cu.CustomerId
              AND ct.IsActive = 1
              AND (
                    NULLIF(LTRIM(RTRIM(ct.Phone)), N'') IS NOT NULL
                    OR NULLIF(LTRIM(RTRIM(ct.SecondaryPhone)), N'') IS NOT NULL
                    OR NULLIF(LTRIM(RTRIM(ct.Email)), N'') IS NOT NULL
              )
      )
    ORDER BY cu.CustomerName ASC;
END
GO

/* ============================================================
   6. My draft (unsubmitted) work reports
   Work reports authored by @EmployeeId that are still in draft status (N'טיוטה').
   This is the reliable "incomplete report" signal: a report the user started
   but has not yet submitted. (There is no "report required" flag in the schema,
   so missing-report-for-completed-task is intentionally NOT inferred here.)
   ============================================================ */
CREATE OR ALTER PROCEDURE dbo.sp_Dashboard_GetMyDraftReports
    @EmployeeId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @EmployeeId IS NULL OR @EmployeeId <= 0
        RETURN;

    SELECT TOP (50)
        wr.WorkReportId,
        wr.WorkItemId,
        wr.ReportType,
        wr.ReportDate,
        wr.ProjectName,
        wr.CustomerName,
        wr.Status
    FROM dbo.WorkReports AS wr
    WHERE wr.ReporterEmployeeId = @EmployeeId
      AND wr.Status = N'טיוטה'
    ORDER BY wr.ReportDate DESC, wr.WorkReportId DESC;
END
GO

/* ============================================================
   Manual SSMS verification queries (run after the migration)
   ============================================================

-- 1. All six dashboard procedures exist.
SELECT name, type_desc, create_date, modify_date
FROM sys.objects
WHERE name IN (
    N'sp_Dashboard_GetPersonalTasks',
    N'sp_Dashboard_GetServiceCallExceptions',
    N'sp_Dashboard_GetProjectsNeedingAttention',
    N'sp_Dashboard_GetQuotesNeedingFollowUp',
    N'sp_Dashboard_GetCustomersMissingContactInfo',
    N'sp_Dashboard_GetMyDraftReports'
)
ORDER BY name;

-- 2. Smoke-test each procedure with representative arguments (read-only; no data changes).
EXEC dbo.sp_Dashboard_GetPersonalTasks @EmployeeId = 1;
EXEC dbo.sp_Dashboard_GetServiceCallExceptions @EmployeeId = 1, @IncludeOrgWide = 1;
EXEC dbo.sp_Dashboard_GetServiceCallExceptions @EmployeeId = 1, @IncludeOrgWide = 0;
EXEC dbo.sp_Dashboard_GetProjectsNeedingAttention @OnlyManaged = 0;
EXEC dbo.sp_Dashboard_GetProjectsNeedingAttention @ManagerEmployeeId = 1, @OnlyManaged = 1;
EXEC dbo.sp_Dashboard_GetQuotesNeedingFollowUp @StaleDays = 7;
EXEC dbo.sp_Dashboard_GetCustomersMissingContactInfo;
EXEC dbo.sp_Dashboard_GetMyDraftReports @EmployeeId = 1;

-- 3. Sanity-check the overdue definition matches sp_GetProjectLifecycle (start-of-today, open tasks only).
SELECT COUNT(*) AS OverdueOpenTasks
FROM dbo.WorkItems
WHERE WorkType = N'Task'
  AND Status NOT IN (N'Closed', N'Cancelled', N'Done')
  AND PlannedEnd IS NOT NULL
  AND PlannedEnd < CAST(GETDATE() AS DATE);

*/

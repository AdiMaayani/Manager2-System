SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
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

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
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

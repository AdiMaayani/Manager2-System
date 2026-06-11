SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[sp_GetProjectsList]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        wi.WorkItemId,
        wi.Title,
        c.CustomerName,
        wi.Status,
        wi.BillingType,
        wi.CreatedAt,
        wi.DealCloseDate,
        wi.FinanceProjectNumber,
        wi.InvoiceNumber,
        ISNULL(s.SiteName, N'-') AS SiteName,
        ISNULL(pm.FullName, N'-') AS ProjectManagerName
    FROM dbo.WorkItems wi
    INNER JOIN dbo.Customers c
        ON wi.CustomerId = c.CustomerId
    LEFT JOIN dbo.Sites s
        ON wi.SiteId = s.SiteId
    LEFT JOIN
    (
        SELECT
            wea.WorkItemId,
            e.FullName,
            ROW_NUMBER() OVER
            (
                PARTITION BY wea.WorkItemId
                ORDER BY wea.AssignedAt DESC, wea.WorkEmployeeAssignmentId DESC
            ) AS RowNum
        FROM dbo.WorkEmployeeAssignments wea
        INNER JOIN dbo.Employees e
            ON wea.EmployeeId = e.EmployeeId
        WHERE LTRIM(RTRIM(LOWER(wea.AssignmentRole))) IN ('project manager', N'מנהל פרויקט', 'team leader')
    ) pm
        ON wi.WorkItemId = pm.WorkItemId
       AND pm.RowNum = 1
    WHERE wi.WorkType = 'Project'
    ORDER BY wi.CreatedAt DESC;
END;
GO

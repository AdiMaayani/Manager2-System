SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


CREATE OR ALTER PROCEDURE [dbo].[sp_GetWorkItems]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        wi.WorkItemId,
        wi.Title,
        wi.WorkType,
        wi.Status,
        wi.BillingType,
        wi.Description,
        wi.CustomerId,
        c.CustomerName,
        wi.SiteId,
        s.SiteName,
        wi.CreatedAt,
        wi.ClosedAt,
        wi.DealCloseDate,
        wi.FinanceProjectNumber,
        wi.InvoiceNumber,
        wi.RequiredRole,
        CASE WHEN EXISTS
        (
            SELECT 1 FROM dbo.WorkItemRequiredRoles AS requiredRole
            WHERE requiredRole.WorkItemId = wi.WorkItemId
        ) THEN (
            SELECT requiredRole.RoleName AS [Role]
            FROM dbo.WorkItemRequiredRoles AS requiredRole
            WHERE requiredRole.WorkItemId = wi.WorkItemId
            ORDER BY requiredRole.RoleName
            FOR XML PATH(''), ROOT('Roles'), TYPE
        ) ELSE CAST(NULL AS XML) END AS RequiredRolesXml
    FROM dbo.WorkItems wi
    INNER JOIN dbo.Customers c
        ON wi.CustomerId = c.CustomerId
    LEFT JOIN dbo.Sites s
        ON wi.SiteId = s.SiteId
    ORDER BY wi.CreatedAt DESC;
END;
GO

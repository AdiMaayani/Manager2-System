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
        wi.InvoiceNumber
    FROM dbo.WorkItems wi
    INNER JOIN dbo.Customers c
        ON wi.CustomerId = c.CustomerId
    LEFT JOIN dbo.Sites s
        ON wi.SiteId = s.SiteId
    ORDER BY wi.CreatedAt DESC;
END;
GO

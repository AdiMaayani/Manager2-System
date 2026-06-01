SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[sp_GetWorkItemDetails]
    @WorkItemId INT
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
        s.AddressLine,
        s.City,
        wi.CreatedAt,
        wi.ClosedAt,
        wi.DealCloseDate,
        wi.FinanceProjectNumber,
        wi.InvoiceNumber,
        wi.PlannedStart,
        wi.PlannedEnd,
        wi.EstimatedHours,
        wi.ActualStart,
        wi.ActualEnd,
        wi.ActualHours,
        wi.Priority,
        wi.RequiredRole,
        wi.IsLocked
    FROM dbo.WorkItems wi
    INNER JOIN dbo.Customers c
        ON wi.CustomerId = c.CustomerId
    LEFT JOIN dbo.Sites s
        ON wi.SiteId = s.SiteId
    WHERE wi.WorkItemId = @WorkItemId;
END;
GO

USE [igroup30_prod];
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetWorkItemDetails
    @WorkItemId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        wi.WorkItemId,
        wi.Title,
        wi.Description,
        wi.WorkType,
        wi.BillingType,
        wi.Status,
        wi.EstimatedHours,
        wi.ActualStart,
        wi.ActualEnd,
        wi.ActualHours,
        wi.Priority,
        wi.PlannedStart,
        wi.PlannedEnd,
        wi.RequiredRole,
        wi.IsLocked,
        wi.CustomerId,
        c.CustomerName,
        wi.SiteId,
        wi.CreatedAt,
        wi.ClosedAt,
        wi.ParentWorkItemId,
        wi.DealCloseDate,
        wi.FinanceProjectNumber,
        wi.InvoiceNumber
    FROM dbo.WorkItems wi
    LEFT JOIN dbo.Customers c
        ON wi.CustomerId = c.CustomerId
    WHERE wi.WorkItemId = @WorkItemId;
END
GO

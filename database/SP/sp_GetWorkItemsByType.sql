SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_GetWorkItemsByType]
    @WorkType NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        wi.WorkItemId,
        wi.Title,
        wi.Description,
        wi.WorkType,
        wi.TaskCategory,
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
        c.CustomerName AS CustomerName,
        wi.SiteId,
        s.SiteName,
        wi.CreatedAt,
        wi.ClosedAt,
        wi.ParentWorkItemId,
        wi.DealCloseDate,
        wi.FinanceProjectNumber,
        wi.InvoiceNumber
        ,wi.MilestoneId
        ,wi.IsArchived
        ,wi.ArchivedAt
    FROM dbo.WorkItems wi
    LEFT JOIN dbo.Customers c
        ON wi.CustomerId = c.CustomerId
    LEFT JOIN dbo.Sites s
        ON wi.SiteId = s.SiteId
    WHERE wi.WorkType = @WorkType
      AND wi.IsArchived = 0
    ORDER BY wi.CreatedAt DESC;
END
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_GetAllProjectsForWorkPlans]
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
        wi.CustomerId,
        c.CustomerName AS CustomerName,
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
    WHERE wi.WorkType = 'Project'
      AND wi.IsArchived = 0
      AND ISNULL(wi.FinanceProjectNumber, N'') <> N'INTERNAL'
    ORDER BY wi.CreatedAt DESC, wi.WorkItemId DESC;
END
GO

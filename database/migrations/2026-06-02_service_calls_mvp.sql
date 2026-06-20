/*
    ManageR2 Service Calls MVP migration.

    Run this script manually in SSMS against the intended target database.
    It does not create a ServiceCalls table. Service calls are WorkItems rows
    with WorkType = 'ServiceCall'.

    Changes:
    - Extends sp_GetWorkItemsByType so Service Calls list/detail screens can
      display site name, scheduling, priority, and assignment-relevant fields.
*/

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
    FROM dbo.WorkItems wi
    LEFT JOIN dbo.Customers c
        ON wi.CustomerId = c.CustomerId
    LEFT JOIN dbo.Sites s
        ON wi.SiteId = s.SiteId
    WHERE wi.WorkType = @WorkType
    ORDER BY wi.CreatedAt DESC;
END
GO

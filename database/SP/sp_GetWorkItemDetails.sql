SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_GetWorkItemDetails @WorkItemId INT AS
BEGIN
 SET NOCOUNT ON;
 SELECT wi.WorkItemId,wi.Title,wi.WorkType,wi.TaskCategory,wi.Status,wi.BillingType,wi.Description,
  wi.CustomerId,c.CustomerName,wi.SiteId,s.SiteName,s.AddressLine,s.City,wi.CreatedAt,wi.ClosedAt,
  wi.ParentWorkItemId,p.Title AS ProjectTitle,wi.MilestoneId,m.Title AS MilestoneTitle,
  wi.DealCloseDate,wi.FinanceProjectNumber,wi.InvoiceNumber,wi.PlannedStart,wi.PlannedEnd,
  wi.EstimatedHours,wi.ActualStart,wi.ActualEnd,wi.ActualHours,wi.Priority,wi.RequiredRole,
  wi.IsLocked,wi.IsArchived,wi.ArchivedAt
 FROM dbo.WorkItems wi LEFT JOIN dbo.Customers c ON c.CustomerId=wi.CustomerId
 LEFT JOIN dbo.Sites s ON s.SiteId=wi.SiteId LEFT JOIN dbo.WorkItems p ON p.WorkItemId=wi.ParentWorkItemId
 LEFT JOIN dbo.ProjectMilestones m ON m.ProjectMilestoneId=wi.MilestoneId
 WHERE wi.WorkItemId=@WorkItemId;
END
GO

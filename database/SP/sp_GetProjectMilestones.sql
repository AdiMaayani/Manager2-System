SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_GetProjectMilestones @ProjectId INT AS
BEGIN SET NOCOUNT ON;
 SELECT pm.ProjectMilestoneId AS WorkItemId,pm.ProjectMilestoneId,pm.Title,pm.Description,N'Milestone' WorkType,
  pm.Status,CAST(NULL AS NVARCHAR(50)) BillingType,p.CustomerId,p.SiteId,pm.CreatedAt,
  pm.ProjectId AS ParentWorkItemId,pm.PlannedStart,pm.PlannedEnd,pm.ActualEnd ClosedAt,
  CAST(NULL AS NVARCHAR(20)) Priority,CAST(NULL AS NVARCHAR(100)) RequiredRole,
  CAST(NULL AS DECIMAL(5,2)) EstimatedHours,pm.ActualStart,pm.ActualEnd,
  CAST(NULL AS DECIMAL(10,2)) ActualHours,CAST(0 AS BIT) IsLocked,
  CAST(NULL AS INT) EmployeeId,CAST(NULL AS NVARCHAR(100)) EmployeeName,
  CAST(NULL AS NVARCHAR(100)) AssignmentRole,CAST(NULL AS DECIMAL(5,2)) AssignedHours,
  CAST(NULL AS BIT) IsManualAssignment,CAST(NULL AS INT) ContractorId,
  CAST(NULL AS NVARCHAR(200)) ContractorName,CAST(NULL AS NVARCHAR(200)) ContractorAssignmentRole,
  pm.ProgressPercent,pm.SortOrder,pm.IsActive,pm.LegacyWorkItemId
 FROM dbo.ProjectMilestones pm JOIN dbo.WorkItems p ON p.WorkItemId=pm.ProjectId
 WHERE pm.ProjectId=@ProjectId AND pm.IsActive=1 ORDER BY pm.SortOrder,pm.ProjectMilestoneId;
END
GO

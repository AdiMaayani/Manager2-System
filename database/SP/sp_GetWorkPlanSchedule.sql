SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_GetWorkPlanSchedule
 @Scope NVARCHAR(20)=N'company',@ProjectId INT=NULL,@EmployeeId INT=NULL,@Status NVARCHAR(50)=NULL,
 @TaskCategory NVARCHAR(20)=NULL,@FromUtc DATETIME2(7)=NULL,@ToUtc DATETIME2(7)=NULL,
 @IncludeUnscheduled BIT=1,@CurrentUserEmployeeId INT=NULL
AS BEGIN SET NOCOUNT ON;
 IF @Scope NOT IN(N'company',N'personal',N'employee',N'project') THROW 51230,'Invalid schedule scope.',1;
 IF @Scope=N'project' AND @ProjectId IS NULL THROW 51233,'Project scope requires ProjectId.',1;
 IF @Scope=N'employee' AND @EmployeeId IS NULL THROW 51234,'Employee scope requires EmployeeId.',1;
 IF @Scope=N'personal' AND @CurrentUserEmployeeId IS NULL THROW 51235,'Personal scope requires CurrentUserEmployeeId.',1;
 IF @TaskCategory IS NOT NULL AND @TaskCategory NOT IN(N'Regular',N'Project',N'ServiceCall') THROW 51236,'Invalid TaskCategory filter.',1;
 IF (@FromUtc IS NULL AND @ToUtc IS NOT NULL) OR (@FromUtc IS NOT NULL AND @ToUtc IS NULL) THROW 51232,'fromUtc and toUtc must both be supplied or both be null.',1;
 IF @FromUtc IS NOT NULL AND @ToUtc<=@FromUtc THROW 51231,'Invalid UTC range.',1;
 ;WITH Eligible AS(
  SELECT wi.WorkItemId,wi.Title,wi.Description,wi.TaskCategory,wi.WorkType,wi.Status,wi.Priority,
   wi.PlannedStart,wi.PlannedEnd,wi.EstimatedHours,wi.IsLocked,wi.CustomerId,c.CustomerName,
   wi.SiteId,s.SiteName,wi.ParentWorkItemId ProjectId,p.Title ProjectTitle,wi.MilestoneId,m.Title MilestoneTitle
  FROM dbo.WorkItems wi LEFT JOIN dbo.Customers c ON c.CustomerId=wi.CustomerId
  LEFT JOIN dbo.Sites s ON s.SiteId=wi.SiteId LEFT JOIN dbo.WorkItems p ON p.WorkItemId=wi.ParentWorkItemId
  LEFT JOIN dbo.ProjectMilestones m ON m.ProjectMilestoneId=wi.MilestoneId
  WHERE wi.IsArchived=0 AND wi.TaskCategory IN(N'Regular',N'Project',N'ServiceCall')
   AND (@Status IS NULL OR wi.Status=@Status) AND (@TaskCategory IS NULL OR wi.TaskCategory=@TaskCategory)
   AND (@Scope<>N'project' OR (wi.TaskCategory=N'Project' AND wi.ParentWorkItemId=@ProjectId))
   AND (@Scope NOT IN(N'personal',N'employee') OR EXISTS(SELECT 1 FROM dbo.WorkEmployeeAssignments a WHERE a.WorkItemId=wi.WorkItemId AND a.EmployeeId=CASE WHEN @Scope=N'personal' THEN @CurrentUserEmployeeId ELSE @EmployeeId END))
 )
 SELECT *,DATEDIFF(MINUTE,PlannedStart,PlannedEnd) DerivedDurationMinutes,
  CAST(CASE WHEN WorkType=N'ServiceCall' THEN 1 ELSE 0 END AS BIT) IsServiceCall
 FROM Eligible WHERE PlannedStart IS NOT NULL AND PlannedEnd>PlannedStart
  AND (@FromUtc IS NULL OR PlannedStart<@ToUtc) AND (@ToUtc IS NULL OR PlannedEnd>@FromUtc)
 ORDER BY PlannedStart,WorkItemId;
 ;WITH Eligible AS(
  SELECT wi.WorkItemId,wi.Title,wi.Description,wi.TaskCategory,wi.WorkType,wi.Status,wi.Priority,
   wi.PlannedStart,wi.PlannedEnd,wi.EstimatedHours,wi.IsLocked,wi.CustomerId,c.CustomerName,
   wi.SiteId,s.SiteName,wi.ParentWorkItemId ProjectId,p.Title ProjectTitle,wi.MilestoneId,m.Title MilestoneTitle
  FROM dbo.WorkItems wi LEFT JOIN dbo.Customers c ON c.CustomerId=wi.CustomerId LEFT JOIN dbo.Sites s ON s.SiteId=wi.SiteId
  LEFT JOIN dbo.WorkItems p ON p.WorkItemId=wi.ParentWorkItemId LEFT JOIN dbo.ProjectMilestones m ON m.ProjectMilestoneId=wi.MilestoneId
  WHERE @IncludeUnscheduled=1 AND wi.IsArchived=0 AND wi.TaskCategory IN(N'Regular',N'Project',N'ServiceCall')
   AND (@Status IS NULL OR wi.Status=@Status) AND (@TaskCategory IS NULL OR wi.TaskCategory=@TaskCategory)
   AND (@Scope<>N'project' OR (wi.TaskCategory=N'Project' AND wi.ParentWorkItemId=@ProjectId))
   AND (@Scope NOT IN(N'personal',N'employee') OR EXISTS(SELECT 1 FROM dbo.WorkEmployeeAssignments a WHERE a.WorkItemId=wi.WorkItemId AND a.EmployeeId=CASE WHEN @Scope=N'personal' THEN @CurrentUserEmployeeId ELSE @EmployeeId END))
 ) SELECT *,CAST(NULL AS INT) DerivedDurationMinutes,CAST(CASE WHEN WorkType=N'ServiceCall' THEN 1 ELSE 0 END AS BIT) IsServiceCall
 FROM Eligible WHERE PlannedStart IS NULL OR PlannedEnd IS NULL OR PlannedEnd<=PlannedStart ORDER BY WorkItemId;
 SELECT a.WorkItemId,a.EmployeeId,e.FullName EmployeeName,a.AssignmentRole,a.AssignedHours,a.IsManualAssignment,N'Task' AssignmentSource
 FROM dbo.WorkEmployeeAssignments a JOIN dbo.Employees e ON e.EmployeeId=a.EmployeeId JOIN dbo.WorkItems wi ON wi.WorkItemId=a.WorkItemId
 WHERE wi.IsArchived=0 AND wi.TaskCategory IN(N'Regular',N'Project',N'ServiceCall')
  AND (@Status IS NULL OR wi.Status=@Status) AND (@TaskCategory IS NULL OR wi.TaskCategory=@TaskCategory)
  AND (@Scope<>N'project' OR (wi.TaskCategory=N'Project' AND wi.ParentWorkItemId=@ProjectId))
  AND (@Scope NOT IN(N'personal',N'employee') OR EXISTS(SELECT 1 FROM dbo.WorkEmployeeAssignments sx WHERE sx.WorkItemId=wi.WorkItemId AND sx.EmployeeId=CASE WHEN @Scope=N'personal' THEN @CurrentUserEmployeeId ELSE @EmployeeId END))
  AND ((wi.PlannedStart IS NOT NULL AND wi.PlannedEnd>wi.PlannedStart AND (@FromUtc IS NULL OR wi.PlannedStart<@ToUtc) AND (@ToUtc IS NULL OR wi.PlannedEnd>@FromUtc))
       OR (@IncludeUnscheduled=1 AND (wi.PlannedStart IS NULL OR wi.PlannedEnd IS NULL OR wi.PlannedEnd<=wi.PlannedStart)));
 SELECT EmployeeId,FullName,PrimaryRole,IsActive,IsAssignable FROM dbo.Employees WHERE IsActive=1 ORDER BY FullName;
END
GO

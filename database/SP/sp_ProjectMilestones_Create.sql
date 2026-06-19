SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_ProjectMilestones_Create
 @ProjectId INT,@Title NVARCHAR(200),@Description NVARCHAR(1000)=NULL,@SortOrder INT=0,
 @Status NVARCHAR(50)=N'Planned',@ManagerEmployeeId INT=NULL,
 @PlannedStart DATETIME2(7)=NULL,@PlannedEnd DATETIME2(7)=NULL
AS BEGIN SET NOCOUNT ON;
 IF NOT EXISTS(SELECT 1 FROM dbo.WorkItems WHERE WorkItemId=@ProjectId AND WorkType=N'Project' AND IsArchived=0) THROW 51200,'Active project not found.',1;
 IF @ManagerEmployeeId IS NULL THROW 51202,'ManagerEmployeeId is required for new milestones.',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.Employees WHERE EmployeeId=@ManagerEmployeeId AND IsActive=1) THROW 51203,'Active manager employee not found.',1;
 IF (@PlannedStart IS NULL AND @PlannedEnd IS NOT NULL) OR (@PlannedStart IS NOT NULL AND @PlannedEnd IS NULL) OR @PlannedEnd<=@PlannedStart THROW 51201,'Planned dates must be null together or form an increasing range.',1;
 INSERT dbo.ProjectMilestones(ProjectId,Title,Description,SortOrder,Status,ManagerEmployeeId,PlannedStart,PlannedEnd)
 VALUES(@ProjectId,@Title,@Description,@SortOrder,@Status,@ManagerEmployeeId,@PlannedStart,@PlannedEnd);
 SELECT CAST(SCOPE_IDENTITY() AS INT) ProjectMilestoneId;
END
GO

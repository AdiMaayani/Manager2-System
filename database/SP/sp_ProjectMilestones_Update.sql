SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_ProjectMilestones_Update
 @ProjectMilestoneId INT,@ProjectId INT,@Title NVARCHAR(200),@Description NVARCHAR(1000)=NULL,
 @SortOrder INT,@Status NVARCHAR(50),@PlannedStart DATETIME2(7)=NULL,@PlannedEnd DATETIME2(7)=NULL,
 @ActualStart DATETIME2(7)=NULL,@ActualEnd DATETIME2(7)=NULL,@ProgressPercent DECIMAL(5,2)=0
AS BEGIN SET NOCOUNT ON;
 IF NOT EXISTS(SELECT 1 FROM dbo.WorkItems WHERE WorkItemId=@ProjectId AND WorkType=N'Project' AND IsArchived=0) THROW 51210,'Active project not found.',1;
 IF (@PlannedStart IS NULL AND @PlannedEnd IS NOT NULL) OR (@PlannedStart IS NOT NULL AND @PlannedEnd IS NULL) OR @PlannedEnd<=@PlannedStart THROW 51211,'Planned dates must be null together or form an increasing range.',1;
 IF (@ActualStart IS NULL AND @ActualEnd IS NOT NULL) OR (@ActualStart IS NOT NULL AND @ActualEnd IS NULL) OR @ActualEnd<=@ActualStart THROW 51212,'Actual dates must be null together or form an increasing range.',1;
 IF EXISTS(SELECT 1 FROM dbo.WorkItems WHERE MilestoneId=@ProjectMilestoneId AND IsArchived=0 AND ParentWorkItemId<>@ProjectId) THROW 51213,'Cannot move a milestone across projects while tasks reference it.',1;
 UPDATE dbo.ProjectMilestones SET ProjectId=@ProjectId,Title=@Title,Description=@Description,
  SortOrder=@SortOrder,Status=@Status,PlannedStart=@PlannedStart,PlannedEnd=@PlannedEnd,
  ActualStart=@ActualStart,ActualEnd=@ActualEnd,ProgressPercent=@ProgressPercent,UpdatedAt=SYSUTCDATETIME()
 WHERE ProjectMilestoneId=@ProjectMilestoneId AND IsActive=1;
 SELECT @@ROWCOUNT RowsAffected;
END
GO

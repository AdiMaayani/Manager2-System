SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_ProjectMilestones_GetByProject @ProjectId INT,@IncludeInactive BIT=0
AS BEGIN SET NOCOUNT ON;
 SELECT ProjectMilestoneId,ProjectId,Title,Description,SortOrder,Status,ManagerEmployeeId,PlannedStart,PlannedEnd,
  ActualStart,ActualEnd,ProgressPercent,IsActive,CreatedAt,UpdatedAt,LegacyWorkItemId
 FROM dbo.ProjectMilestones WHERE ProjectId=@ProjectId AND (@IncludeInactive=1 OR IsActive=1)
 ORDER BY SortOrder,ProjectMilestoneId;
END
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_ProjectMilestones_GetById @ProjectMilestoneId INT
AS BEGIN SET NOCOUNT ON;
 SELECT ProjectMilestoneId,ProjectId,Title,Description,SortOrder,Status,ManagerEmployeeId,PlannedStart,PlannedEnd,
  ActualStart,ActualEnd,ProgressPercent,IsActive,CreatedAt,UpdatedAt,LegacyWorkItemId
 FROM dbo.ProjectMilestones WHERE ProjectMilestoneId=@ProjectMilestoneId;
END
GO

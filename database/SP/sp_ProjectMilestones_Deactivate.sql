SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_ProjectMilestones_Deactivate @ProjectMilestoneId INT,@ProjectId INT
AS BEGIN SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM dbo.WorkItems WHERE MilestoneId=@ProjectMilestoneId AND IsArchived=0) THROW 51220,'Milestone is referenced by active tasks.',1;
 UPDATE dbo.ProjectMilestones SET IsActive=0,UpdatedAt=SYSUTCDATETIME()
 WHERE ProjectMilestoneId=@ProjectMilestoneId AND ProjectId=@ProjectId AND IsActive=1;
 SELECT @@ROWCOUNT RowsAffected;
END
GO

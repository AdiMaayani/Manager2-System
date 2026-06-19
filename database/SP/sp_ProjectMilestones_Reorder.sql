SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_ProjectMilestones_Reorder @ProjectMilestoneId INT,@ProjectId INT,@SortOrder INT
AS BEGIN SET NOCOUNT ON;
 UPDATE dbo.ProjectMilestones SET SortOrder=@SortOrder,UpdatedAt=SYSUTCDATETIME()
 WHERE ProjectMilestoneId=@ProjectMilestoneId AND ProjectId=@ProjectId AND IsActive=1;
 SELECT @@ROWCOUNT RowsAffected;
END
GO

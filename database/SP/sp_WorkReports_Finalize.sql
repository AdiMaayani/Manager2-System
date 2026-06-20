SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_WorkReports_Finalize @WorkReportId INT,@FinalizedByUserId INT=NULL
AS BEGIN SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  DECLARE @Life NVARCHAR(20);
  SELECT @Life=LifecycleStatus FROM dbo.WorkReports WITH(UPDLOCK,HOLDLOCK) WHERE WorkReportId=@WorkReportId;
  IF @Life IS NULL THROW 51340,'Work report not found.',1;
  IF @Life=N'Reversed' THROW 51341,'A reversed report cannot be finalized.',1;
  IF @Life=N'Draft' BEGIN
   EXEC dbo.sp_InventoryStockMovements_ApplyForReport @WorkReportId,N'ReportUsage',@FinalizedByUserId;
   UPDATE dbo.WorkReports SET LifecycleStatus=N'Finalized',FinalizedAt=SYSUTCDATETIME(),FinalizedByUserId=@FinalizedByUserId,
    UpdatedAt=SYSUTCDATETIME(),UpdatedByUserId=@FinalizedByUserId WHERE WorkReportId=@WorkReportId;
  END;
  COMMIT;
  SELECT WorkReportId,Status,LifecycleStatus,FinalizedAt,FinalizedByUserId FROM dbo.WorkReports WHERE WorkReportId=@WorkReportId;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
END
GO

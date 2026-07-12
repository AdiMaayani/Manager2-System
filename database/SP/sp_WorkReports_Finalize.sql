SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_WorkReports_Finalize
 @WorkReportId INT,@FinalizedByUserId INT=NULL,
 @OutputStatus NVARCHAR(50)=NULL OUTPUT,@OutputLifecycleStatus NVARCHAR(20)=NULL OUTPUT,
 @OutputFinalizedAt DATETIME2(7)=NULL OUTPUT,@OutputFinalizedByUserId INT=NULL OUTPUT,
 @OutputReversedAt DATETIME2(7)=NULL OUTPUT,@OutputReversedByUserId INT=NULL OUTPUT,
 @OutputReversalReason NVARCHAR(500)=NULL OUTPUT
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
  SELECT @OutputStatus=Status,@OutputLifecycleStatus=LifecycleStatus,
   @OutputFinalizedAt=FinalizedAt,@OutputFinalizedByUserId=FinalizedByUserId,
   @OutputReversedAt=ReversedAt,@OutputReversedByUserId=ReversedByUserId,
   @OutputReversalReason=ReversalReason
  FROM dbo.WorkReports WHERE WorkReportId=@WorkReportId;
  IF @OutputLifecycleStatus IS NULL THROW 51342,'Finalized report lifecycle output could not be loaded.',1;
  COMMIT;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
END
GO

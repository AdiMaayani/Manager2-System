SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_WorkReports_Reverse @WorkReportId INT,@ReversalReason NVARCHAR(500)=NULL,@ReversedByUserId INT=NULL
AS BEGIN SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  DECLARE @Life NVARCHAR(20);
  SELECT @Life=LifecycleStatus FROM dbo.WorkReports WITH(UPDLOCK,HOLDLOCK) WHERE WorkReportId=@WorkReportId;
  IF @Life IS NULL THROW 51351,'Work report not found.',1;
  IF @Life=N'Draft' THROW 51352,'A Draft report cannot be reversed.',1;
  IF @Life=N'Finalized' BEGIN
   IF NULLIF(LTRIM(RTRIM(@ReversalReason)),N'') IS NULL THROW 51350,'Reversal reason is required.',1;
   EXEC dbo.sp_InventoryStockMovements_ApplyForReport @WorkReportId,N'ReportReversal',@ReversedByUserId;
   UPDATE dbo.WorkReports SET LifecycleStatus=N'Reversed',ReversedAt=SYSUTCDATETIME(),ReversedByUserId=@ReversedByUserId,
    ReversalReason=@ReversalReason,UpdatedAt=SYSUTCDATETIME(),UpdatedByUserId=@ReversedByUserId WHERE WorkReportId=@WorkReportId;
  END;
  COMMIT;
  SELECT WorkReportId,Status,LifecycleStatus,ReversedAt,ReversedByUserId,ReversalReason FROM dbo.WorkReports WHERE WorkReportId=@WorkReportId;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
END
GO

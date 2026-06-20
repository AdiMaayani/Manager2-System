/*
  MANUAL MULTI-SESSION TEST, NON-PRODUCTION ONLY.

  Prepare isolated fixtures and record the ids/expected quantities below. Run A and B concurrently,
  then run V after both finish. SAME_REPORT and SAME_REVERSE use one report. SHARED_ITEM uses two
  Draft reports whose individual requirements fit but combined requirement exceeds stock.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @Approved BIT=0;
DECLARE @Scenario NVARCHAR(30)=N'SAME_REPORT'; -- SAME_REPORT, SAME_REVERSE, SHARED_ITEM
DECLARE @Session NCHAR(1)=N'A';                -- A, B, or V (verify)
DECLARE @SameReportId INT=NULL;
DECLARE @ReportAId INT=NULL;
DECLARE @ReportBId INT=NULL;
DECLARE @UserId INT=NULL;
DECLARE @InventoryItemId INT=NULL;
DECLARE @InitialQuantity DECIMAL(18,3)=NULL;
DECLARE @SameReportRequired DECIMAL(18,3)=NULL;
IF @Approved=0 THROW 51640,'Approval flag is not set.',1;
IF DB_NAME() IN(N'master',N'model',N'msdb',N'tempdb') THROW 51641,'Refusing system database.',1;
IF @Session NOT IN(N'A',N'B',N'V') THROW 51642,'Session must be A, B, or V.',1;
IF @Scenario NOT IN(N'SAME_REPORT',N'SAME_REVERSE',N'SHARED_ITEM') THROW 51643,'Unknown concurrency scenario.',1;

IF @Session IN(N'A',N'B')
BEGIN
 WAITFOR DELAY '00:00:05';
 IF @Scenario=N'SAME_REPORT'
  EXEC dbo.sp_WorkReports_Finalize @SameReportId,@UserId;
 ELSE IF @Scenario=N'SAME_REVERSE'
  EXEC dbo.sp_WorkReports_Reverse @SameReportId,N'Concurrent reversal test',@UserId;
 ELSE
 BEGIN
  DECLARE @TargetReportId INT=CASE WHEN @Session=N'A' THEN @ReportAId ELSE @ReportBId END;
  EXEC dbo.sp_WorkReports_Finalize @TargetReportId,@UserId;
 END;
END;

IF @Session=N'V' AND @Scenario=N'SAME_REPORT'
BEGIN
 IF (SELECT LifecycleStatus FROM dbo.WorkReports WHERE WorkReportId=@SameReportId)<>N'Finalized' THROW 51644,'Same-report finalize did not finish Finalized.',1;
 IF (SELECT COUNT(*) FROM dbo.InventoryStockMovements m JOIN dbo.WorkReportInventoryItems l ON l.WorkReportInventoryItemId=m.WorkReportInventoryItemId WHERE l.WorkReportId=@SameReportId AND m.MovementType=N'ReportUsage')
    <>(SELECT COUNT(*) FROM dbo.WorkReportInventoryItems WHERE WorkReportId=@SameReportId) THROW 51645,'Same-report finalize created a duplicate/missing movement set.',1;
 IF (SELECT QuantityOnHand FROM dbo.InventoryItems WHERE InventoryItemId=@InventoryItemId)<>@InitialQuantity-@SameReportRequired THROW 51646,'Same-report finalize decremented stock more than once.',1;
END;

IF @Session=N'V' AND @Scenario=N'SAME_REVERSE'
BEGIN
 IF (SELECT LifecycleStatus FROM dbo.WorkReports WHERE WorkReportId=@SameReportId)<>N'Reversed' THROW 51647,'Same-report reverse did not finish Reversed.',1;
 IF (SELECT COUNT(*) FROM dbo.InventoryStockMovements m JOIN dbo.WorkReportInventoryItems l ON l.WorkReportInventoryItemId=m.WorkReportInventoryItemId WHERE l.WorkReportId=@SameReportId AND m.MovementType=N'ReportReversal')
    <>(SELECT COUNT(*) FROM dbo.WorkReportInventoryItems WHERE WorkReportId=@SameReportId) THROW 51648,'Same-report reverse created a duplicate/missing reversal set.',1;
 IF (SELECT QuantityOnHand FROM dbo.InventoryItems WHERE InventoryItemId=@InventoryItemId)<>@InitialQuantity THROW 51649,'Concurrent reverse restored stock more than once.',1;
END;

IF @Session=N'V' AND @Scenario=N'SHARED_ITEM'
BEGIN
 IF (SELECT COUNT(*) FROM dbo.WorkReports WHERE WorkReportId IN(@ReportAId,@ReportBId) AND LifecycleStatus=N'Finalized')<>1 THROW 51650,'Shared-item contention must finalize exactly one report.',1;
 IF EXISTS(SELECT 1 FROM dbo.InventoryItems WHERE InventoryItemId=@InventoryItemId AND QuantityOnHand<0) THROW 51651,'Shared-item contention produced negative stock.',1;
 IF EXISTS(
  SELECT 1 FROM dbo.WorkReports r WHERE r.WorkReportId IN(@ReportAId,@ReportBId) AND r.LifecycleStatus=N'Draft'
   AND EXISTS(SELECT 1 FROM dbo.WorkReportInventoryItems l JOIN dbo.InventoryStockMovements m ON m.WorkReportInventoryItemId=l.WorkReportInventoryItemId AND m.MovementType=N'ReportUsage' WHERE l.WorkReportId=r.WorkReportId)
 ) THROW 51652,'Failed shared-item report has partial movements.',1;
 IF EXISTS(
  SELECT 1 FROM dbo.WorkReports r WHERE r.WorkReportId IN(@ReportAId,@ReportBId) AND r.LifecycleStatus=N'Finalized'
   AND (SELECT COUNT(*) FROM dbo.WorkReportInventoryItems l WHERE l.WorkReportId=r.WorkReportId)
      <>(SELECT COUNT(*) FROM dbo.WorkReportInventoryItems l JOIN dbo.InventoryStockMovements m ON m.WorkReportInventoryItemId=l.WorkReportInventoryItemId AND m.MovementType=N'ReportUsage' WHERE l.WorkReportId=r.WorkReportId)
 ) THROW 51653,'Successful shared-item report has a partial movement set.',1;
END;

IF @Session=N'V' SELECT N'PASS' Result,@Scenario Scenario;
GO

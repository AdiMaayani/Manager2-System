/* NON-PRODUCTION ONLY. Every section is gated through SESSION_CONTEXT and cleans up its fixtures. */
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @ApprovedNonProduction BIT=0;
IF @ApprovedNonProduction=0 THROW 51600,'Set @ApprovedNonProduction=1 only in an isolated test database.',1;
IF DB_NAME() IN(N'master',N'model',N'msdb',N'tempdb') THROW 51601,'Refusing system database.',1;
EXEC sys.sp_set_session_context @key=N'ManageR2DatabaseSmokeApproved',@value=1,@read_only=1;
GO

/* Success path: matrix, duration, milestone ownership/exclusion, SKU, lifecycle and workflow independence. */
SET NOCOUNT ON; SET XACT_ABORT ON;
IF TRY_CONVERT(INT,SESSION_CONTEXT(N'ManageR2DatabaseSmokeApproved'))<>1 THROW 51600,'Smoke approval missing.',1;
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @CustomerId INT=(SELECT TOP(1) CustomerId FROM dbo.Customers ORDER BY CustomerId);
 DECLARE @UserId INT=(SELECT TOP(1) UserId FROM dbo.Users ORDER BY UserId);
 IF @CustomerId IS NULL THROW 51602,'Smoke test needs one customer.',1;
 INSERT dbo.WorkItems(Title,WorkType,TaskCategory,Status,CustomerId,CreatedAt,IsLocked,IsArchived)
 VALUES(N'__DB_SMOKE_PROJECT_A__',N'Project',NULL,N'Execution',@CustomerId,SYSUTCDATETIME(),0,0),
       (N'__DB_SMOKE_PROJECT_B__',N'Project',NULL,N'Execution',@CustomerId,SYSUTCDATETIME(),0,0);
 DECLARE @ProjectAId INT=(SELECT WorkItemId FROM dbo.WorkItems WHERE Title=N'__DB_SMOKE_PROJECT_A__');
 DECLARE @ProjectBId INT=(SELECT WorkItemId FROM dbo.WorkItems WHERE Title=N'__DB_SMOKE_PROJECT_B__');
 EXEC dbo.sp_ProjectMilestones_Create @ProjectAId,N'__DB_SMOKE_MILESTONE__';
 DECLARE @MilestoneId INT=(SELECT ProjectMilestoneId FROM dbo.ProjectMilestones WHERE ProjectId=@ProjectAId AND Title=N'__DB_SMOKE_MILESTONE__');
 EXEC dbo.sp_CreateWorkItem @Title=N'__DB_SMOKE_REGULAR__',@WorkType=N'Task',@Status=N'Open',@BillingType=NULL,@CustomerId=NULL,@TaskCategory=N'Regular',@PlannedStart='2026-01-01T08:00:00',@PlannedEnd='2026-01-01T10:30:00';
 EXEC dbo.sp_CreateWorkItem @Title=N'__DB_SMOKE_PROJECT_TASK__',@WorkType=N'Task',@Status=N'Open',@BillingType=NULL,@CustomerId=@CustomerId,@TaskCategory=N'Project',@ParentWorkItemId=@ProjectAId,@MilestoneId=@MilestoneId,@PlannedStart='2026-01-01T08:00:00',@PlannedEnd='2026-01-01T09:00:00';
 EXEC dbo.sp_CreateWorkItem @Title=N'__DB_SMOKE_SERVICE__',@WorkType=N'ServiceCall',@Status=N'Open',@BillingType=NULL,@CustomerId=@CustomerId,@TaskCategory=N'ServiceCall';
 IF EXISTS(SELECT 1 FROM dbo.WorkItems WHERE Title=N'__DB_SMOKE_REGULAR__' AND (WorkType<>N'Task' OR TaskCategory<>N'Regular' OR ParentWorkItemId IS NOT NULL OR EstimatedHours<>2.50)) THROW 51603,'Regular category/duration invariant failed.',1;
 IF EXISTS(SELECT 1 FROM dbo.WorkItems WHERE Title=N'__DB_SMOKE_SERVICE__' AND (WorkType<>N'ServiceCall' OR TaskCategory<>N'ServiceCall' OR ParentWorkItemId IS NOT NULL)) THROW 51604,'ServiceCall matrix invariant failed.',1;
 IF EXISTS(SELECT 1 FROM dbo.WorkItems WHERE Title=N'__DB_SMOKE_MILESTONE__') THROW 51605,'Dedicated milestone leaked into schedulable WorkItems.',1;
 BEGIN TRY
  EXEC dbo.sp_CreateWorkItem @Title=N'__DB_SMOKE_BAD_MILESTONE__',@WorkType=N'Task',@Status=N'Open',@BillingType=NULL,@TaskCategory=N'Project',@ParentWorkItemId=@ProjectBId,@MilestoneId=@MilestoneId;
  THROW 51606,'Cross-project milestone was accepted.',1;
 END TRY BEGIN CATCH IF ERROR_NUMBER()<>51104 THROW; END CATCH;

 DECLARE @Sku NVARCHAR(50)=N'DB-SMOKE-'+LEFT(CONVERT(NVARCHAR(36),NEWID()),36);
 INSERT dbo.InventoryItems(SkuCode,ItemName,QuantityOnHand,Unit,IsActive,CreatedAt) VALUES(@Sku,N'__DB_SMOKE_ITEM__',10,N'unit',1,SYSUTCDATETIME());
 DECLARE @InventoryItemId INT=SCOPE_IDENTITY();
 DECLARE @SkuResult TABLE(InventoryItemId INT,SkuCode NVARCHAR(50),ItemName NVARCHAR(200),Category NVARCHAR(100),QuantityOnHand DECIMAL(18,3),Unit NVARCHAR(20),MinimumQuantity DECIMAL(18,3),LocationName NVARCHAR(200),Notes NVARCHAR(500),IsActive BIT);
 INSERT @SkuResult EXEC dbo.sp_Inventory_GetBySku @Sku;
 IF NOT EXISTS(SELECT 1 FROM @SkuResult WHERE InventoryItemId=@InventoryItemId AND SkuCode=@Sku) THROW 51607,'Exact SKU lookup failed.',1;

 INSERT dbo.WorkReports(ReportType,Status,LifecycleStatus,CreatedAt) VALUES(N'Task',N'הוגש',N'Draft',SYSUTCDATETIME());
 DECLARE @ReportId INT=SCOPE_IDENTITY();
 EXEC dbo.sp_WorkReportInventory_Add @ReportId,@InventoryItemId,2,N'Used',@UserId;
 EXEC dbo.sp_WorkReportInventory_Add @ReportId,@InventoryItemId,3,N'Installed',@UserId;
 EXEC dbo.sp_WorkReports_Finalize @ReportId,@UserId;
 EXEC dbo.sp_WorkReports_Finalize @ReportId,@UserId;
 IF (SELECT QuantityOnHand FROM dbo.InventoryItems WHERE InventoryItemId=@InventoryItemId)<>5 THROW 51608,'Finalize aggregation/idempotency failed.',1;
 IF (SELECT COUNT(*) FROM dbo.InventoryStockMovements m JOIN dbo.WorkReportInventoryItems l ON l.WorkReportInventoryItemId=m.WorkReportInventoryItemId WHERE l.WorkReportId=@ReportId AND m.MovementType=N'ReportUsage')<>2 THROW 51609,'Finalize movement count failed.',1;
 IF (SELECT Status FROM dbo.WorkReports WHERE WorkReportId=@ReportId)<>N'הוגש' THROW 51610,'Finalize changed workflow Status.',1;
 EXEC dbo.sp_WorkReports_Update @WorkReportId=@ReportId,@Status=N'הועבר להנה״ח';
 IF (SELECT QuantityOnHand FROM dbo.InventoryItems WHERE InventoryItemId=@InventoryItemId)<>5 THROW 51611,'Workflow transition changed stock.',1;
 EXEC dbo.sp_WorkReports_Reverse @ReportId,N'Smoke reversal',@UserId;
 EXEC dbo.sp_WorkReports_Reverse @ReportId,N'Smoke reversal repeat',@UserId;
 IF (SELECT QuantityOnHand FROM dbo.InventoryItems WHERE InventoryItemId=@InventoryItemId)<>10 THROW 51612,'Reverse idempotency failed.',1;
 SELECT N'PASS' Result,N'Matrix, duration, milestone exclusion/ownership, exact SKU, lifecycle, aggregation and workflow independence.' Coverage;
 ROLLBACK;
END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
GO

/* Finalized report inventory and attachments must be immutable. */
SET NOCOUNT ON; SET XACT_ABORT ON;
IF TRY_CONVERT(INT,SESSION_CONTEXT(N'ManageR2DatabaseSmokeApproved'))<>1 THROW 51600,'Smoke approval missing.',1;
DECLARE @UserId INT=(SELECT TOP(1) UserId FROM dbo.Users ORDER BY UserId);
DECLARE @Sku NVARCHAR(50)=N'DB-IMMUT-'+LEFT(CONVERT(NVARCHAR(36),NEWID()),36);
INSERT dbo.InventoryItems(SkuCode,ItemName,QuantityOnHand,Unit,IsActive,CreatedAt) VALUES(@Sku,N'__DB_IMMUT_ITEM__',10,N'unit',1,SYSUTCDATETIME());
DECLARE @ItemId INT=SCOPE_IDENTITY();
INSERT dbo.WorkReports(ReportType,Status,LifecycleStatus,CreatedAt) VALUES(N'Task',N'טיוטה',N'Draft',SYSUTCDATETIME());
DECLARE @ReportId INT=SCOPE_IDENTITY();
EXEC dbo.sp_WorkReportInventory_Add @ReportId,@ItemId,1,N'Used',@UserId;
DECLARE @StoredFileName NVARCHAR(255)=CONVERT(NVARCHAR(36),NEWID())+N'.jpg';
EXEC dbo.sp_WorkReportAttachments_Add @ReportId,N'Image',N'test.jpg',@StoredFileName,N'App_Data/reports/test.jpg',N'image/jpeg',1,@UserId;
DECLARE @AttachmentId INT=(SELECT WorkReportAttachmentId FROM dbo.WorkReportAttachments WHERE WorkReportId=@ReportId);
EXEC dbo.sp_WorkReports_Finalize @ReportId,@UserId;
BEGIN TRY EXEC dbo.sp_WorkReportInventory_Add @ReportId,@ItemId,2,N'Used',@UserId; THROW 51620,'Finalized inventory edit was accepted.',1; END TRY BEGIN CATCH IF ERROR_NUMBER()<>51300 THROW; END CATCH;
BEGIN TRY EXEC dbo.sp_WorkReportAttachments_Delete @ReportId,@AttachmentId; THROW 51621,'Finalized attachment edit was accepted.',1; END TRY BEGIN CATCH IF ERROR_NUMBER()<>51321 THROW; END CATCH;
EXEC dbo.sp_WorkReports_Reverse @ReportId,N'Cleanup reversal',@UserId;
DELETE m FROM dbo.InventoryStockMovements m JOIN dbo.WorkReportInventoryItems l ON l.WorkReportInventoryItemId=m.WorkReportInventoryItemId WHERE l.WorkReportId=@ReportId;
DELETE FROM dbo.WorkReportAttachments WHERE WorkReportId=@ReportId;
DELETE FROM dbo.WorkReportInventoryItems WHERE WorkReportId=@ReportId;
DELETE FROM dbo.WorkReports WHERE WorkReportId=@ReportId;
DELETE FROM dbo.InventoryItems WHERE InventoryItemId=@ItemId;
SELECT N'PASS' Result,N'Finalized inventory and attachment immutability.' Coverage;
GO

/* Insufficient stock must roll back every item, movement and lifecycle update. */
SET NOCOUNT ON; SET XACT_ABORT ON;
IF TRY_CONVERT(INT,SESSION_CONTEXT(N'ManageR2DatabaseSmokeApproved'))<>1 THROW 51600,'Smoke approval missing.',1;
DECLARE @UserId INT=(SELECT TOP(1) UserId FROM dbo.Users ORDER BY UserId);
DECLARE @ItemAName NVARCHAR(200)=N'__DB_PART_A__'+CONVERT(NVARCHAR(36),NEWID());
DECLARE @ItemBName NVARCHAR(200)=N'__DB_PART_B__'+CONVERT(NVARCHAR(36),NEWID());
DECLARE @NewItems TABLE(InventoryItemId INT,ItemName NVARCHAR(200));
INSERT dbo.InventoryItems(SkuCode,ItemName,QuantityOnHand,Unit,IsActive,CreatedAt)
OUTPUT INSERTED.InventoryItemId,INSERTED.ItemName INTO @NewItems
VALUES(N'DB-PART-A-'+LEFT(CONVERT(NVARCHAR(36),NEWID()),36),@ItemAName,10,N'unit',1,SYSUTCDATETIME()),
      (N'DB-PART-B-'+LEFT(CONVERT(NVARCHAR(36),NEWID()),36),@ItemBName,1,N'unit',1,SYSUTCDATETIME());
DECLARE @ItemA INT=(SELECT InventoryItemId FROM @NewItems WHERE ItemName=@ItemAName);
DECLARE @ItemB INT=(SELECT InventoryItemId FROM @NewItems WHERE ItemName=@ItemBName);
INSERT dbo.WorkReports(ReportType,Status,LifecycleStatus,CreatedAt) VALUES(N'Task',N'טיוטה',N'Draft',SYSUTCDATETIME());
DECLARE @ReportId INT=SCOPE_IDENTITY();
EXEC dbo.sp_WorkReportInventory_Add @ReportId,@ItemA,5,N'Used',@UserId;
EXEC dbo.sp_WorkReportInventory_Add @ReportId,@ItemB,2,N'Used',@UserId;
BEGIN TRY EXEC dbo.sp_WorkReports_Finalize @ReportId,@UserId; THROW 51630,'Insufficient-stock finalize unexpectedly succeeded.',1; END TRY BEGIN CATCH IF ERROR_NUMBER()<>51332 THROW; END CATCH;
IF EXISTS(SELECT 1 FROM dbo.InventoryItems WHERE (InventoryItemId=@ItemA AND QuantityOnHand<>10) OR (InventoryItemId=@ItemB AND QuantityOnHand<>1)) THROW 51631,'Partial stock update survived failed finalize.',1;
IF EXISTS(SELECT 1 FROM dbo.InventoryStockMovements m JOIN dbo.WorkReportInventoryItems l ON l.WorkReportInventoryItemId=m.WorkReportInventoryItemId WHERE l.WorkReportId=@ReportId) THROW 51632,'Movement survived failed finalize.',1;
IF (SELECT LifecycleStatus FROM dbo.WorkReports WHERE WorkReportId=@ReportId)<>N'Draft' THROW 51633,'Failed finalize changed lifecycle.',1;
DELETE FROM dbo.WorkReportInventoryItems WHERE WorkReportId=@ReportId;
DELETE FROM dbo.WorkReports WHERE WorkReportId=@ReportId;
DELETE FROM dbo.InventoryItems WHERE InventoryItemId IN(@ItemA,@ItemB);
SELECT N'PASS' Result,N'Negative-stock and partial-finalization prevention.' Coverage;
GO

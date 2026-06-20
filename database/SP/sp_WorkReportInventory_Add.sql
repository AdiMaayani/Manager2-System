SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_WorkReportInventory_Add
 @WorkReportId INT,@InventoryItemId INT,@Quantity DECIMAL(18,3),@UsageType NVARCHAR(20),@CreatedByUserId INT=NULL
AS BEGIN SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
 DECLARE @Life NVARCHAR(20); SELECT @Life=LifecycleStatus FROM dbo.WorkReports WITH(UPDLOCK,HOLDLOCK) WHERE WorkReportId=@WorkReportId;
 IF @Life<>N'Draft' OR @Life IS NULL THROW 51300,'Inventory lines are editable only on Draft reports.',1;
 IF @Quantity<=0 OR @UsageType NOT IN(N'Sold',N'Installed',N'Used') THROW 51301,'Invalid inventory quantity or usage type.',1;
 DECLARE @Sku NVARCHAR(50),@Name NVARCHAR(200);
 SELECT @Sku=SkuCode,@Name=ItemName FROM dbo.InventoryItems WHERE InventoryItemId=@InventoryItemId AND IsActive=1;
 IF @Sku IS NULL THROW 51302,'Active inventory item not found.',1;
 MERGE dbo.WorkReportInventoryItems WITH(HOLDLOCK) AS t
 USING(SELECT @WorkReportId WorkReportId,@InventoryItemId InventoryItemId,@UsageType UsageType) s
 ON t.WorkReportId=s.WorkReportId AND t.InventoryItemId=s.InventoryItemId AND t.UsageType=s.UsageType
 WHEN MATCHED THEN UPDATE SET Quantity=@Quantity,SkuSnapshot=@Sku,ItemNameSnapshot=@Name
 WHEN NOT MATCHED THEN INSERT(WorkReportId,InventoryItemId,Quantity,UsageType,SkuSnapshot,ItemNameSnapshot,CreatedByUserId)
 VALUES(@WorkReportId,@InventoryItemId,@Quantity,@UsageType,@Sku,@Name,@CreatedByUserId);
 COMMIT;
 SELECT WorkReportInventoryItemId,WorkReportId,InventoryItemId,Quantity,UsageType,SkuSnapshot,ItemNameSnapshot,CreatedAt,CreatedByUserId
 FROM dbo.WorkReportInventoryItems WHERE WorkReportId=@WorkReportId AND InventoryItemId=@InventoryItemId AND UsageType=@UsageType;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
END
GO

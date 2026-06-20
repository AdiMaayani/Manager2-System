SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_InventoryStockMovements_ApplyForReport
 @WorkReportId INT,@MovementType NVARCHAR(30),@UserId INT=NULL
AS BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF @@TRANCOUNT=0 THROW 51330,'Stock movement application requires an owning transaction.',1;
 IF @MovementType NOT IN(N'ReportUsage',N'ReportReversal') THROW 51331,'Invalid movement type.',1;
 IF @MovementType=N'ReportUsage' AND EXISTS(
  SELECT 1 FROM dbo.WorkReportInventoryItems l JOIN dbo.InventoryStockMovements m
   ON m.WorkReportInventoryItemId=l.WorkReportInventoryItemId AND m.MovementType=N'ReportUsage'
  WHERE l.WorkReportId=@WorkReportId)
  THROW 51334,'Draft report already has usage movements; manual repair is required.',1;
 IF @MovementType=N'ReportReversal' AND EXISTS(
  SELECT 1 FROM dbo.WorkReportInventoryItems l WHERE l.WorkReportId=@WorkReportId
   AND NOT EXISTS(SELECT 1 FROM dbo.InventoryStockMovements m WHERE m.WorkReportInventoryItemId=l.WorkReportInventoryItemId AND m.MovementType=N'ReportUsage'))
  THROW 51335,'Cannot reverse inventory lines without matching usage movements.',1;
 IF @MovementType=N'ReportReversal' AND EXISTS(
  SELECT 1 FROM dbo.WorkReportInventoryItems l
  JOIN dbo.InventoryStockMovements m ON m.WorkReportInventoryItemId=l.WorkReportInventoryItemId AND m.MovementType=N'ReportUsage'
  WHERE l.WorkReportId=@WorkReportId AND m.QuantityDelta<>-l.Quantity)
  THROW 51336,'Cannot reverse: usage movement quantity does not match its immutable report line.',1;
 DECLARE @Required TABLE(InventoryItemId INT PRIMARY KEY,Quantity DECIMAL(18,3) NOT NULL);
 INSERT @Required SELECT InventoryItemId,SUM(Quantity) FROM dbo.WorkReportInventoryItems WHERE WorkReportId=@WorkReportId GROUP BY InventoryItemId;
 DECLARE @ItemId INT,@Qty DECIMAL(18,3);
 DECLARE item_cursor CURSOR LOCAL STATIC READ_ONLY FOR SELECT InventoryItemId,Quantity FROM @Required ORDER BY InventoryItemId;
 OPEN item_cursor; FETCH NEXT FROM item_cursor INTO @ItemId,@Qty;
 WHILE @@FETCH_STATUS=0 BEGIN
  IF @MovementType=N'ReportUsage'
  BEGIN
   UPDATE dbo.InventoryItems WITH(ROWLOCK) SET QuantityOnHand=QuantityOnHand-@Qty,UpdatedAt=SYSUTCDATETIME()
   WHERE InventoryItemId=@ItemId AND IsActive=1 AND QuantityOnHand>=@Qty;
   IF @@ROWCOUNT<>1 THROW 51332,'Insufficient or inactive inventory item; no stock was applied.',1;
  END ELSE BEGIN
   UPDATE dbo.InventoryItems WITH(ROWLOCK) SET QuantityOnHand=QuantityOnHand+@Qty,UpdatedAt=SYSUTCDATETIME() WHERE InventoryItemId=@ItemId;
   IF @@ROWCOUNT<>1 THROW 51333,'Inventory item missing during reversal.',1;
  END;
  FETCH NEXT FROM item_cursor INTO @ItemId,@Qty;
 END;
 CLOSE item_cursor; DEALLOCATE item_cursor;
 INSERT dbo.InventoryStockMovements(InventoryItemId,WorkReportInventoryItemId,QuantityDelta,MovementType,SourceType,SourceId,UsageType,CreatedByUserId)
 SELECT l.InventoryItemId,l.WorkReportInventoryItemId,
  CASE WHEN @MovementType=N'ReportUsage' THEN -l.Quantity ELSE l.Quantity END,
  @MovementType,N'WorkReport',@WorkReportId,l.UsageType,@UserId
 FROM dbo.WorkReportInventoryItems l WHERE l.WorkReportId=@WorkReportId
  AND NOT EXISTS(SELECT 1 FROM dbo.InventoryStockMovements m WHERE m.WorkReportInventoryItemId=l.WorkReportInventoryItemId AND m.MovementType=@MovementType);
END
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_WorkReportInventory_GetByReport @WorkReportId INT AS
BEGIN SET NOCOUNT ON;
 SELECT WorkReportInventoryItemId,WorkReportId,InventoryItemId,Quantity,UsageType,SkuSnapshot,ItemNameSnapshot,CreatedAt,CreatedByUserId
 FROM dbo.WorkReportInventoryItems WHERE WorkReportId=@WorkReportId ORDER BY WorkReportInventoryItemId;
END
GO

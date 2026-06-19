SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_Inventory_GetBySku @SkuCode NVARCHAR(50) AS
BEGIN SET NOCOUNT ON;
 DECLARE @Sku NVARCHAR(50)=NULLIF(LTRIM(RTRIM(@SkuCode)),N'');
 SELECT InventoryItemId,SkuCode,ItemName,Category,QuantityOnHand,Unit,MinimumQuantity,LocationName,Notes,IsActive
 FROM dbo.InventoryItems WHERE IsActive=1 AND SkuCode=@Sku;
END
GO

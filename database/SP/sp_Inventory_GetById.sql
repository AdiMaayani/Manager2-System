SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_Inventory_GetById
    @InventoryItemId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        InventoryItemId,
        SkuCode,
        ItemName,
        Category,
        QuantityOnHand,
        Unit,
        MinimumQuantity,
        LocationName,
        Notes,
        IsActive,
        CreatedAt,
        UpdatedAt,
        DeletedAt,
        ImagePath,
        ImageContentType,
        ImageFileSizeBytes
    FROM dbo.InventoryItems
    WHERE InventoryItemId = @InventoryItemId;
END
GO

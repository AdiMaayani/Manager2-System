SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_Inventory_Deactivate
    @InventoryItemId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.InventoryItems
    SET
        IsActive = 0,
        UpdatedAt = SYSUTCDATETIME(),
        DeletedAt = SYSUTCDATETIME()
    WHERE InventoryItemId = @InventoryItemId
      AND IsActive = 1;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

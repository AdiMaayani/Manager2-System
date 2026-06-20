SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_Inventory_ClearImage
    @InventoryItemId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @PreviousImage TABLE (PreviousImagePath NVARCHAR(260) NULL);

    -- Only rows that actually have an image are updated, so RowsAffected = 0 means "nothing to clear"
    -- (item missing, or already had no image). PreviousImagePath is the file to delete from disk.
    UPDATE dbo.InventoryItems
    SET
        ImagePath = NULL,
        ImageContentType = NULL,
        ImageFileSizeBytes = NULL,
        UpdatedAt = SYSUTCDATETIME()
    OUTPUT deleted.ImagePath INTO @PreviousImage (PreviousImagePath)
    WHERE InventoryItemId = @InventoryItemId
      AND ImagePath IS NOT NULL;

    SELECT
        (SELECT COUNT(*) FROM @PreviousImage) AS RowsAffected,
        (SELECT TOP (1) PreviousImagePath FROM @PreviousImage) AS PreviousImagePath;
END
GO

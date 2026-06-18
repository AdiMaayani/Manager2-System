SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_Inventory_SetImage
    @InventoryItemId INT,
    @ImagePath NVARCHAR(260),
    @ImageContentType NVARCHAR(100) = NULL,
    @ImageFileSizeBytes BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NormalizedImagePath NVARCHAR(260) = NULLIF(LTRIM(RTRIM(@ImagePath)), N'');

    IF @NormalizedImagePath IS NULL
    BEGIN
        THROW 51210, 'ImagePath is required.', 1;
    END;

    IF @ImageFileSizeBytes IS NOT NULL AND @ImageFileSizeBytes < 0
    BEGIN
        THROW 51211, 'ImageFileSizeBytes cannot be negative.', 1;
    END;

    DECLARE @PreviousImage TABLE (PreviousImagePath NVARCHAR(260) NULL);

    UPDATE dbo.InventoryItems
    SET
        ImagePath = @NormalizedImagePath,
        ImageContentType = NULLIF(LTRIM(RTRIM(@ImageContentType)), N''),
        ImageFileSizeBytes = @ImageFileSizeBytes,
        UpdatedAt = SYSUTCDATETIME()
    OUTPUT deleted.ImagePath INTO @PreviousImage (PreviousImagePath)
    WHERE InventoryItemId = @InventoryItemId;

    -- RowsAffected lets the caller distinguish "item not found" (0) from a successful update whose
    -- previous image path was NULL. PreviousImagePath is the file to delete from disk, when present.
    SELECT
        (SELECT COUNT(*) FROM @PreviousImage) AS RowsAffected,
        (SELECT TOP (1) PreviousImagePath FROM @PreviousImage) AS PreviousImagePath;
END
GO

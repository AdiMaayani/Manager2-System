SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Atomically creates an InventoryItem together with its product-image metadata in a single
-- transaction. Either one complete row (item + image columns) is committed, or nothing is.
-- There is no "create then deactivate" rollback path, so a failed attempt never leaves a stray
-- (active or inactive) row behind. The caller saves the image file to disk first and deletes it
-- if this procedure fails.
CREATE OR ALTER PROCEDURE dbo.sp_Inventory_CreateWithImage
    @SkuCode NVARCHAR(50),
    @ItemName NVARCHAR(200),
    @Category NVARCHAR(100) = NULL,
    @QuantityOnHand DECIMAL(18,3),
    @Unit NVARCHAR(20),
    @MinimumQuantity DECIMAL(18,3) = NULL,
    @LocationName NVARCHAR(200) = NULL,
    @Notes NVARCHAR(500) = NULL,
    @IsActive BIT = 1,
    @ImagePath NVARCHAR(260),
    @ImageContentType NVARCHAR(100) = NULL,
    @ImageFileSizeBytes BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @NormalizedSkuCode NVARCHAR(50) = NULLIF(LTRIM(RTRIM(@SkuCode)), N'');
    DECLARE @NormalizedItemName NVARCHAR(200) = NULLIF(LTRIM(RTRIM(@ItemName)), N'');
    DECLARE @NormalizedUnit NVARCHAR(20) = NULLIF(LTRIM(RTRIM(@Unit)), N'');
    DECLARE @NormalizedCategory NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@Category)), N'');
    DECLARE @NormalizedImagePath NVARCHAR(260) = NULLIF(LTRIM(RTRIM(@ImagePath)), N'');

    -- Required-value validation (runs before any transaction is opened).
    IF @NormalizedSkuCode IS NULL
    BEGIN
        THROW 51201, 'SkuCode is required.', 1;
    END;

    IF @NormalizedItemName IS NULL
    BEGIN
        THROW 51202, 'ItemName is required.', 1;
    END;

    IF @NormalizedUnit IS NULL
    BEGIN
        THROW 51203, 'Unit is required.', 1;
    END;

    IF @QuantityOnHand < 0
    BEGIN
        THROW 51204, 'QuantityOnHand cannot be negative.', 1;
    END;

    IF @MinimumQuantity IS NOT NULL AND @MinimumQuantity < 0
    BEGIN
        THROW 51205, 'MinimumQuantity cannot be negative.', 1;
    END;

    -- A product image is mandatory for atomic create-with-image.
    IF @NormalizedImagePath IS NULL
    BEGIN
        THROW 51212, 'ImagePath is required.', 1;
    END;

    IF @ImageFileSizeBytes IS NOT NULL AND @ImageFileSizeBytes < 0
    BEGIN
        THROW 51211, 'ImageFileSizeBytes cannot be negative.', 1;
    END;

    -- Canonical category guard (mirrors dbo.InventoryCategories and the frontend CANONICAL_CATEGORIES).
    IF @NormalizedCategory IS NULL OR @NormalizedCategory NOT IN (
        N'חשמל חכם',
        N'מולטימדיה',
        N'שו"ב',
        N'רשת מחשבים',
        N'מצלמות אבטחה',
        N'מערכות אזעקה',
        N'טלפוניה ואינטרקום',
        N'כבילה ותשתיות'
    )
    BEGIN
        THROW 51220, 'Category must be one of the supported inventory categories.', 1;
    END;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Mirror the filtered unique index (UX_InventoryItems_SkuCode_Active) with a friendly error.
        IF @IsActive = 1 AND EXISTS (
            SELECT 1
            FROM dbo.InventoryItems
            WHERE SkuCode = @NormalizedSkuCode
              AND IsActive = 1
        )
        BEGIN
            THROW 51206, 'An active inventory item with this SKU already exists.', 1;
        END;

        INSERT INTO dbo.InventoryItems
        (
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
            ImagePath,
            ImageContentType,
            ImageFileSizeBytes
        )
        VALUES
        (
            @NormalizedSkuCode,
            @NormalizedItemName,
            @NormalizedCategory,
            @QuantityOnHand,
            @NormalizedUnit,
            @MinimumQuantity,
            NULLIF(LTRIM(RTRIM(@LocationName)), N''),
            NULLIF(LTRIM(RTRIM(@Notes)), N''),
            @IsActive,
            SYSUTCDATETIME(),
            @NormalizedImagePath,
            NULLIF(LTRIM(RTRIM(@ImageContentType)), N''),
            @ImageFileSizeBytes
        );

        DECLARE @NewInventoryItemId INT = CAST(SCOPE_IDENTITY() AS INT);

        COMMIT TRANSACTION;

        -- The committed row already contains the image metadata before it becomes visible.
        SELECT @NewInventoryItemId AS InventoryItemId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END
GO

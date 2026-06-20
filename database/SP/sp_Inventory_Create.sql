SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_Inventory_Create
    @SkuCode NVARCHAR(50),
    @ItemName NVARCHAR(200),
    @Category NVARCHAR(100) = NULL,
    @QuantityOnHand DECIMAL(18,3),
    @Unit NVARCHAR(20),
    @MinimumQuantity DECIMAL(18,3) = NULL,
    @LocationName NVARCHAR(200) = NULL,
    @Notes NVARCHAR(500) = NULL,
    @IsActive BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NormalizedSkuCode NVARCHAR(50) = NULLIF(LTRIM(RTRIM(@SkuCode)), N'');
    DECLARE @NormalizedItemName NVARCHAR(200) = NULLIF(LTRIM(RTRIM(@ItemName)), N'');
    DECLARE @NormalizedUnit NVARCHAR(20) = NULLIF(LTRIM(RTRIM(@Unit)), N'');

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
        CreatedAt
    )
    VALUES
    (
        @NormalizedSkuCode,
        @NormalizedItemName,
        NULLIF(LTRIM(RTRIM(@Category)), N''),
        @QuantityOnHand,
        @NormalizedUnit,
        @MinimumQuantity,
        NULLIF(LTRIM(RTRIM(@LocationName)), N''),
        NULLIF(LTRIM(RTRIM(@Notes)), N''),
        @IsActive,
        SYSUTCDATETIME()
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS InventoryItemId;
END
GO

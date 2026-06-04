SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_Inventory_GetList
    @Search NVARCHAR(200) = NULL,
    @Category NVARCHAR(100) = NULL,
    @Status NVARCHAR(20) = N'active',
    @LowStockOnly BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NormalizedSearch NVARCHAR(200) = NULLIF(LTRIM(RTRIM(@Search)), N'');
    DECLARE @NormalizedCategory NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@Category)), N'');
    DECLARE @NormalizedStatus NVARCHAR(20) = LOWER(ISNULL(NULLIF(LTRIM(RTRIM(@Status)), N''), N'active'));

    IF @NormalizedStatus NOT IN (N'active', N'inactive', N'all')
    BEGIN
        THROW 51200, 'Status must be active, inactive, or all.', 1;
    END;

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
        DeletedAt
    FROM dbo.InventoryItems
    WHERE (
            @NormalizedStatus = N'all'
            OR (@NormalizedStatus = N'active' AND IsActive = 1)
            OR (@NormalizedStatus = N'inactive' AND IsActive = 0)
          )
      AND (
            @NormalizedCategory IS NULL
            OR Category = @NormalizedCategory
          )
      AND (
            @LowStockOnly = 0
            OR (MinimumQuantity IS NOT NULL AND QuantityOnHand <= MinimumQuantity)
          )
      AND (
            @NormalizedSearch IS NULL
            OR SkuCode LIKE N'%' + @NormalizedSearch + N'%'
            OR ItemName LIKE N'%' + @NormalizedSearch + N'%'
            OR ISNULL(Category, N'') LIKE N'%' + @NormalizedSearch + N'%'
            OR ISNULL(LocationName, N'') LIKE N'%' + @NormalizedSearch + N'%'
            OR ISNULL(Notes, N'') LIKE N'%' + @NormalizedSearch + N'%'
          )
    ORDER BY IsActive DESC, ItemName ASC, InventoryItemId ASC;
END
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectBoq_Update
    @ProjectBoqItemId INT,
    @ProjectId INT,
    @SystemName NVARCHAR(100) = NULL,
    @InventoryItemId INT = NULL,
    @ItemDescription NVARCHAR(300),
    @Quantity DECIMAL(18,3),
    @Unit NVARCHAR(20),
    @UnitPrice DECIMAL(18,2) = NULL,
    @SortOrder INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.WorkItems
        WHERE WorkItemId = @ProjectId
          AND WorkType = 'Project'
    )
    BEGIN
        THROW 51100, 'Project was not found.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@ItemDescription)), N'') IS NULL
    BEGIN
        THROW 51101, 'ItemDescription is required.', 1;
    END;

    IF @Quantity <= 0
    BEGIN
        THROW 51102, 'Quantity must be greater than zero.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@Unit)), N'') IS NULL
    BEGIN
        THROW 51103, 'Unit is required.', 1;
    END;

    IF @InventoryItemId IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM dbo.InventoryItems
           WHERE InventoryItemId = @InventoryItemId
             AND IsActive = 1
       )
    BEGIN
        THROW 51105, 'Inventory item was not found.', 1;
    END;

    IF @UnitPrice IS NOT NULL AND @UnitPrice < 0
    BEGIN
        THROW 51106, 'UnitPrice must be non-negative.', 1;
    END;

    UPDATE dbo.ProjectBoqItems
    SET
        SystemName = NULLIF(LTRIM(RTRIM(@SystemName)), N''),
        InventoryItemId = @InventoryItemId,
        ItemDescription = LTRIM(RTRIM(@ItemDescription)),
        Quantity = @Quantity,
        Unit = LTRIM(RTRIM(@Unit)),
        UnitPrice = @UnitPrice,
        SortOrder = @SortOrder,
        UpdatedAt = SYSUTCDATETIME()
    WHERE ProjectBoqItemId = @ProjectBoqItemId
      AND ProjectId = @ProjectId
      AND IsActive = 1;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

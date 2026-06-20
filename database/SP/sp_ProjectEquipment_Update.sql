SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectEquipment_Update
    @ProjectEquipmentItemId INT,
    @ProjectId INT,
    @InventoryItemId INT = NULL,
    @EquipmentName NVARCHAR(200),
    @Status NVARCHAR(50),
    @Location NVARCHAR(200) = NULL,
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
        THROW 51000, 'Project was not found.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@EquipmentName)), N'') IS NULL
    BEGIN
        THROW 51001, 'EquipmentName is required.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@Status)), N'') IS NULL
    BEGIN
        THROW 51002, 'Status is required.', 1;
    END;

    IF @InventoryItemId IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM dbo.InventoryItems
           WHERE InventoryItemId = @InventoryItemId
             AND IsActive = 1
       )
    BEGIN
        THROW 51003, 'Inventory item was not found.', 1;
    END;

    UPDATE dbo.ProjectEquipmentItems
    SET
        InventoryItemId = @InventoryItemId,
        EquipmentName = LTRIM(RTRIM(@EquipmentName)),
        Status = LTRIM(RTRIM(@Status)),
        Location = NULLIF(LTRIM(RTRIM(@Location)), N''),
        SortOrder = @SortOrder,
        UpdatedAt = SYSUTCDATETIME()
    WHERE ProjectEquipmentItemId = @ProjectEquipmentItemId
      AND ProjectId = @ProjectId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

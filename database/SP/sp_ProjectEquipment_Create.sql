SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectEquipment_Create
    @ProjectId INT,
    @InventoryItemId INT = NULL,
    @EquipmentName NVARCHAR(200),
    @Status NVARCHAR(50),
    @Location NVARCHAR(200) = NULL,
    @SortOrder INT = NULL
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

    IF @SortOrder IS NULL
    BEGIN
        SELECT @SortOrder = ISNULL(MAX(SortOrder), 0) + 1
        FROM dbo.ProjectEquipmentItems
        WHERE ProjectId = @ProjectId;
    END;

    INSERT INTO dbo.ProjectEquipmentItems
    (
        ProjectId,
        InventoryItemId,
        EquipmentName,
        Status,
        Location,
        SortOrder,
        CreatedAt
    )
    VALUES
    (
        @ProjectId,
        @InventoryItemId,
        LTRIM(RTRIM(@EquipmentName)),
        LTRIM(RTRIM(@Status)),
        NULLIF(LTRIM(RTRIM(@Location)), N''),
        @SortOrder,
        SYSUTCDATETIME()
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS ProjectEquipmentItemId;
END
GO

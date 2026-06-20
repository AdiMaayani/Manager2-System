SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectEquipment_GetByProject
    @ProjectId INT
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

    SELECT
        e.ProjectEquipmentItemId,
        e.ProjectId,
        e.InventoryItemId,
        i.SkuCode AS InventorySkuCode,
        i.ItemName AS InventoryItemName,
        i.Category AS InventoryCategory,
        e.EquipmentName,
        e.Status,
        e.Location,
        e.SortOrder,
        e.CreatedAt,
        e.UpdatedAt
    FROM dbo.ProjectEquipmentItems e
    LEFT JOIN dbo.InventoryItems i
        ON e.InventoryItemId = i.InventoryItemId
    WHERE e.ProjectId = @ProjectId
    ORDER BY e.SortOrder ASC, e.ProjectEquipmentItemId ASC;
END
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectBoq_GetByProject
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
        THROW 51100, 'Project was not found.', 1;
    END;

    SELECT
        b.ProjectBoqItemId,
        b.ProjectId,
        b.SystemName,
        b.InventoryItemId,
        i.SkuCode AS InventorySkuCode,
        i.ItemName AS InventoryItemName,
        i.Category AS InventoryCategory,
        b.ItemDescription,
        b.Quantity,
        b.Unit,
        b.UnitPrice,
        b.SortOrder,
        b.CreatedAt,
        b.UpdatedAt
    FROM dbo.ProjectBoqItems b
    LEFT JOIN dbo.InventoryItems i
        ON b.InventoryItemId = i.InventoryItemId
    WHERE b.ProjectId = @ProjectId
      AND b.IsActive = 1
    ORDER BY b.SortOrder ASC, b.ProjectBoqItemId ASC;
END
GO

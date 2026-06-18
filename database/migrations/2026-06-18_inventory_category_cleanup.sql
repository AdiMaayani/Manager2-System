/*
    ManageR2 inventory category cleanup — INTENTIONAL business-data cleanup.

    Run this script manually in SSMS against the intended target database.
    Safe to rerun (idempotent): all matching is on trimmed category text and exact InventoryItemId
    joins, so a second run finds nothing to do.

    Business rules enforced here:
    - DELETE completely (no soft-delete, no reassignment) every InventoryItem whose trimmed category
      is exactly:
        * בטיחות אש
        * בקרת כניסה
    - NORMALIZE legacy category aliases onto the canonical set:
        * כריזה ומולטימדיה -> מולטימדיה
        * מצלמות ואבטחה     -> מצלמות אבטחה

    FOREIGN KEYS (audited from database/migrations/2026-06-11_project_inventory_drawings_files.sql):
    Two foreign keys reference dbo.InventoryItems(InventoryItemId), both with the default NO ACTION
    delete behavior, so the referenced parent rows cannot be deleted while children exist:
        * FK_ProjectBoqItems_InventoryItems        dbo.ProjectBoqItems.InventoryItemId
        * FK_ProjectEquipmentItems_InventoryItems  dbo.ProjectEquipmentItems.InventoryItemId
    Because the obsolete items must be deleted completely, this migration deletes the dependent rows
    that reference exactly those obsolete InventoryItemIds FIRST, then deletes the items. It does NOT
    drop/disable foreign keys and does NOT add ON DELETE CASCADE. Only rows that reference an obsolete
    InventoryItemId are removed; parent projects and unrelated BOQ/equipment rows are never touched.

    PHYSICAL IMAGE FILES:
    Image binaries live on disk under apps/api/ManageR2.Api/wwwroot/uploads/inventory and are NOT
    removed by SQL (no xp_cmdshell / CLR / filesystem access is used). One result set below lists the
    non-null ImagePath values of the items being deleted; those files must be deleted MANUALLY from the
    managed Inventory upload directory after this migration succeeds.

    The migration runs in a single transaction with SET XACT_ABORT ON and TRY/CATCH: it commits only
    when every step succeeds, and rolls back the entire operation on any failure.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    /* 1) Identify the obsolete InventoryItemIds ONCE and hold them (with details) in a table variable. */
    DECLARE @ObsoleteItems TABLE (
        InventoryItemId INT PRIMARY KEY,
        SkuCode         NVARCHAR(50),
        ItemName        NVARCHAR(200),
        Category        NVARCHAR(100),
        ImagePath       NVARCHAR(260)
    );

    INSERT INTO @ObsoleteItems (InventoryItemId, SkuCode, ItemName, Category, ImagePath)
    SELECT InventoryItemId, SkuCode, ItemName, Category, ImagePath
    FROM dbo.InventoryItems
    WHERE LTRIM(RTRIM(Category)) IN (N'בטיחות אש', N'בקרת כניסה');

    /* 2) Capture/report the affected InventoryItem details BEFORE deletion. */
    SELECT InventoryItemId, SkuCode, ItemName, Category, ImagePath
    FROM @ObsoleteItems
    ORDER BY InventoryItemId;

    /* 3) Report the image files that will require MANUAL deletion after the migration succeeds. */
    SELECT
        InventoryItemId,
        ImagePath,
        CAST(N'Manual deletion required from wwwroot/uploads/inventory after this migration succeeds.'
             AS NVARCHAR(200)) AS CleanupNote
    FROM @ObsoleteItems
    WHERE ImagePath IS NOT NULL
    ORDER BY InventoryItemId;

    /* 4) Report dependent-row counts BEFORE deleting anything. */
    DECLARE @BoqToDelete INT =
        (SELECT COUNT(*) FROM dbo.ProjectBoqItems
         WHERE InventoryItemId IN (SELECT InventoryItemId FROM @ObsoleteItems));
    DECLARE @EquipToDelete INT =
        (SELECT COUNT(*) FROM dbo.ProjectEquipmentItems
         WHERE InventoryItemId IN (SELECT InventoryItemId FROM @ObsoleteItems));

    SELECT
        (SELECT COUNT(*) FROM @ObsoleteItems) AS InventoryItems_ToDelete,
        @BoqToDelete                          AS ProjectBoqItems_ToDelete,
        @EquipToDelete                        AS ProjectEquipmentItems_ToDelete;

    /* 5) Delete ONLY dependent rows that reference the captured obsolete InventoryItemIds. */
    DELETE boq
    FROM dbo.ProjectBoqItems AS boq
    INNER JOIN @ObsoleteItems AS o ON o.InventoryItemId = boq.InventoryItemId;
    DECLARE @BoqDeleted INT = @@ROWCOUNT;

    DELETE eq
    FROM dbo.ProjectEquipmentItems AS eq
    INNER JOIN @ObsoleteItems AS o ON o.InventoryItemId = eq.InventoryItemId;
    DECLARE @EquipDeleted INT = @@ROWCOUNT;

    /* 6) Delete the captured InventoryItems only after their dependent rows are gone. */
    DELETE inv
    FROM dbo.InventoryItems AS inv
    INNER JOIN @ObsoleteItems AS o ON o.InventoryItemId = inv.InventoryItemId;
    DECLARE @ItemsDeleted INT = @@ROWCOUNT;

    /* 7) Normalize legacy aliases onto the canonical categories. */
    UPDATE dbo.InventoryItems
    SET Category = N'מולטימדיה',
        UpdatedAt = SYSUTCDATETIME()
    WHERE LTRIM(RTRIM(Category)) = N'כריזה ומולטימדיה';
    DECLARE @AliasMultimedia INT = @@ROWCOUNT;

    UPDATE dbo.InventoryItems
    SET Category = N'מצלמות אבטחה',
        UpdatedAt = SYSUTCDATETIME()
    WHERE LTRIM(RTRIM(Category)) = N'מצלמות ואבטחה';
    DECLARE @AliasCameras INT = @@ROWCOUNT;

    COMMIT TRANSACTION;

    /* 8) Final summary result set with the actual counts performed. */
    SELECT
        @ItemsDeleted     AS InventoryItems_Deleted,
        @BoqDeleted       AS ProjectBoqItems_Deleted,
        @EquipDeleted     AS ProjectEquipmentItems_Deleted,
        @AliasMultimedia  AS Aliases_Normalized_Multimedia,
        @AliasCameras     AS Aliases_Normalized_Cameras;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;

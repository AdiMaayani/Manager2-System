/*
    ManageR2 project inventory linkage and drawing file metadata migration.

    Run this script manually in SSMS against the intended target database.

    Changes:
    - Links project BOQ rows to InventoryItems and adds optional user-entered unit pricing.
    - Links project equipment rows to InventoryItems.
    - Adds server-side drawing file metadata columns.
*/

IF COL_LENGTH('dbo.ProjectBoqItems', 'InventoryItemId') IS NULL
BEGIN
    ALTER TABLE dbo.ProjectBoqItems
        ADD InventoryItemId INT NULL;
END
GO

IF COL_LENGTH('dbo.ProjectBoqItems', 'UnitPrice') IS NULL
BEGIN
    ALTER TABLE dbo.ProjectBoqItems
        ADD UnitPrice DECIMAL(18,2) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_ProjectBoqItems_InventoryItems'
)
BEGIN
    ALTER TABLE dbo.ProjectBoqItems
        ADD CONSTRAINT FK_ProjectBoqItems_InventoryItems
            FOREIGN KEY (InventoryItemId)
            REFERENCES dbo.InventoryItems (InventoryItemId);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_ProjectBoqItems_UnitPrice_NonNegative'
)
BEGIN
    ALTER TABLE dbo.ProjectBoqItems
        ADD CONSTRAINT CK_ProjectBoqItems_UnitPrice_NonNegative
            CHECK (UnitPrice IS NULL OR UnitPrice >= 0);
END
GO

IF COL_LENGTH('dbo.ProjectEquipmentItems', 'InventoryItemId') IS NULL
BEGIN
    ALTER TABLE dbo.ProjectEquipmentItems
        ADD InventoryItemId INT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_ProjectEquipmentItems_InventoryItems'
)
BEGIN
    ALTER TABLE dbo.ProjectEquipmentItems
        ADD CONSTRAINT FK_ProjectEquipmentItems_InventoryItems
            FOREIGN KEY (InventoryItemId)
            REFERENCES dbo.InventoryItems (InventoryItemId);
END
GO

IF COL_LENGTH('dbo.ProjectDrawings', 'OriginalFileName') IS NULL
BEGIN
    ALTER TABLE dbo.ProjectDrawings
        ADD OriginalFileName NVARCHAR(260) NULL;
END
GO

IF COL_LENGTH('dbo.ProjectDrawings', 'StoredFileName') IS NULL
BEGIN
    ALTER TABLE dbo.ProjectDrawings
        ADD StoredFileName NVARCHAR(260) NULL;
END
GO

IF COL_LENGTH('dbo.ProjectDrawings', 'FilePath') IS NULL
BEGIN
    ALTER TABLE dbo.ProjectDrawings
        ADD FilePath NVARCHAR(500) NULL;
END
GO

IF COL_LENGTH('dbo.ProjectDrawings', 'ContentType') IS NULL
BEGIN
    ALTER TABLE dbo.ProjectDrawings
        ADD ContentType NVARCHAR(120) NULL;
END
GO

IF COL_LENGTH('dbo.ProjectDrawings', 'FileSizeBytes') IS NULL
BEGIN
    ALTER TABLE dbo.ProjectDrawings
        ADD FileSizeBytes BIGINT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_ProjectDrawings_FileSizeBytes_NonNegative'
)
BEGIN
    ALTER TABLE dbo.ProjectDrawings
        ADD CONSTRAINT CK_ProjectDrawings_FileSizeBytes_NonNegative
            CHECK (FileSizeBytes IS NULL OR FileSizeBytes >= 0);
END
GO

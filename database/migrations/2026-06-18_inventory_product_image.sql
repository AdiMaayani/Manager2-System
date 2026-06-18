/*
    ManageR2 inventory product image metadata migration.

    Run this script manually in SSMS against the intended target database.

    Changes:
    - Adds product image metadata columns to InventoryItems.
      Only a server-relative stored path plus content type and size are stored;
      the image binary itself lives on disk under the API wwwroot/uploads/inventory folder.
*/

IF COL_LENGTH('dbo.InventoryItems', 'ImagePath') IS NULL
BEGIN
    ALTER TABLE dbo.InventoryItems
        ADD ImagePath NVARCHAR(260) NULL;
END
GO

IF COL_LENGTH('dbo.InventoryItems', 'ImageContentType') IS NULL
BEGIN
    ALTER TABLE dbo.InventoryItems
        ADD ImageContentType NVARCHAR(100) NULL;
END
GO

IF COL_LENGTH('dbo.InventoryItems', 'ImageFileSizeBytes') IS NULL
BEGIN
    ALTER TABLE dbo.InventoryItems
        ADD ImageFileSizeBytes BIGINT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_InventoryItems_ImageFileSizeBytes_NonNegative'
)
BEGIN
    ALTER TABLE dbo.InventoryItems
        ADD CONSTRAINT CK_InventoryItems_ImageFileSizeBytes_NonNegative
            CHECK (ImageFileSizeBytes IS NULL OR ImageFileSizeBytes >= 0);
END
GO

/*
    ManageR2 Inventory MVP persistence migration.

    Run this script manually in SSMS against the intended target database.

    Changes:
    - Adds dbo.InventoryItems for a company-wide item catalog with one stock balance per item.
    - Adds stored procedures used by the Inventory MVP screen.
*/

IF OBJECT_ID(N'dbo.InventoryItems', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.InventoryItems
    (
        InventoryItemId INT IDENTITY(1,1) NOT NULL,
        SkuCode NVARCHAR(50) NOT NULL,
        ItemName NVARCHAR(200) NOT NULL,
        Category NVARCHAR(100) NULL,
        QuantityOnHand DECIMAL(18,3) NOT NULL CONSTRAINT DF_InventoryItems_QuantityOnHand DEFAULT (0),
        Unit NVARCHAR(20) NOT NULL,
        MinimumQuantity DECIMAL(18,3) NULL,
        LocationName NVARCHAR(200) NULL,
        Notes NVARCHAR(500) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_InventoryItems_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_InventoryItems_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        DeletedAt DATETIME2(7) NULL,
        CONSTRAINT PK_InventoryItems PRIMARY KEY CLUSTERED (InventoryItemId ASC),
        CONSTRAINT CK_InventoryItems_SkuCode_NotBlank
            CHECK (LEN(LTRIM(RTRIM(SkuCode))) > 0),
        CONSTRAINT CK_InventoryItems_ItemName_NotBlank
            CHECK (LEN(LTRIM(RTRIM(ItemName))) > 0),
        CONSTRAINT CK_InventoryItems_QuantityOnHand_NonNegative
            CHECK (QuantityOnHand >= 0),
        CONSTRAINT CK_InventoryItems_Unit_NotBlank
            CHECK (LEN(LTRIM(RTRIM(Unit))) > 0),
        CONSTRAINT CK_InventoryItems_MinimumQuantity_NonNegative
            CHECK (MinimumQuantity IS NULL OR MinimumQuantity >= 0)
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_InventoryItems_SkuCode_Active'
      AND object_id = OBJECT_ID(N'dbo.InventoryItems')
)
BEGIN
    CREATE UNIQUE INDEX UX_InventoryItems_SkuCode_Active
        ON dbo.InventoryItems (SkuCode ASC)
        WHERE IsActive = 1;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_InventoryItems_IsActive_ItemName'
      AND object_id = OBJECT_ID(N'dbo.InventoryItems')
)
BEGIN
    CREATE INDEX IX_InventoryItems_IsActive_ItemName
        ON dbo.InventoryItems (IsActive ASC, ItemName ASC, InventoryItemId ASC);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_InventoryItems_Category_IsActive'
      AND object_id = OBJECT_ID(N'dbo.InventoryItems')
)
BEGIN
    CREATE INDEX IX_InventoryItems_Category_IsActive
        ON dbo.InventoryItems (Category ASC, IsActive ASC);
END
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

CREATE OR ALTER PROCEDURE dbo.sp_Inventory_GetById
    @InventoryItemId INT
AS
BEGIN
    SET NOCOUNT ON;

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
    WHERE InventoryItemId = @InventoryItemId;
END
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

CREATE OR ALTER PROCEDURE dbo.sp_Inventory_Update
    @InventoryItemId INT,
    @SkuCode NVARCHAR(50),
    @ItemName NVARCHAR(200),
    @Category NVARCHAR(100) = NULL,
    @QuantityOnHand DECIMAL(18,3),
    @Unit NVARCHAR(20),
    @MinimumQuantity DECIMAL(18,3) = NULL,
    @LocationName NVARCHAR(200) = NULL,
    @Notes NVARCHAR(500) = NULL,
    @IsActive BIT
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
          AND InventoryItemId <> @InventoryItemId
    )
    BEGIN
        THROW 51206, 'An active inventory item with this SKU already exists.', 1;
    END;

    UPDATE dbo.InventoryItems
    SET
        SkuCode = @NormalizedSkuCode,
        ItemName = @NormalizedItemName,
        Category = NULLIF(LTRIM(RTRIM(@Category)), N''),
        QuantityOnHand = @QuantityOnHand,
        Unit = @NormalizedUnit,
        MinimumQuantity = @MinimumQuantity,
        LocationName = NULLIF(LTRIM(RTRIM(@LocationName)), N''),
        Notes = NULLIF(LTRIM(RTRIM(@Notes)), N''),
        IsActive = @IsActive,
        UpdatedAt = SYSUTCDATETIME(),
        DeletedAt = CASE WHEN @IsActive = 1 THEN NULL ELSE ISNULL(DeletedAt, SYSUTCDATETIME()) END
    WHERE InventoryItemId = @InventoryItemId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Inventory_Deactivate
    @InventoryItemId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.InventoryItems
    SET
        IsActive = 0,
        UpdatedAt = SYSUTCDATETIME(),
        DeletedAt = SYSUTCDATETIME()
    WHERE InventoryItemId = @InventoryItemId
      AND IsActive = 1;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

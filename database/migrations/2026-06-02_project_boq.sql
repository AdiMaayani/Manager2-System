/*
    ManageR2 Project BOQ persistence migration.

    Run this script manually in SSMS against the intended target database.

    Changes:
    - Adds dbo.ProjectBoqItems for project-level Bill of Quantities line items.
    - Adds stored procedures used by the Project Drawer BOQ tab.
*/

IF OBJECT_ID(N'dbo.ProjectBoqItems', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProjectBoqItems
    (
        ProjectBoqItemId INT IDENTITY(1,1) NOT NULL,
        ProjectId INT NOT NULL,
        SystemName NVARCHAR(100) NULL,
        ItemDescription NVARCHAR(300) NOT NULL,
        Quantity DECIMAL(18,3) NOT NULL,
        Unit NVARCHAR(20) NOT NULL,
        SortOrder INT NOT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_ProjectBoqItems_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_ProjectBoqItems_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        DeletedAt DATETIME2(7) NULL,
        CONSTRAINT PK_ProjectBoqItems PRIMARY KEY CLUSTERED (ProjectBoqItemId ASC),
        CONSTRAINT FK_ProjectBoqItems_WorkItems FOREIGN KEY (ProjectId)
            REFERENCES dbo.WorkItems (WorkItemId),
        CONSTRAINT CK_ProjectBoqItems_ItemDescription_NotBlank
            CHECK (LEN(LTRIM(RTRIM(ItemDescription))) > 0),
        CONSTRAINT CK_ProjectBoqItems_Quantity_Positive
            CHECK (Quantity > 0),
        CONSTRAINT CK_ProjectBoqItems_Unit_NotBlank
            CHECK (LEN(LTRIM(RTRIM(Unit))) > 0),
        CONSTRAINT CK_ProjectBoqItems_SortOrder_Positive
            CHECK (SortOrder > 0)
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_ProjectBoqItems_ProjectId_SortOrder'
      AND object_id = OBJECT_ID(N'dbo.ProjectBoqItems')
)
BEGIN
    CREATE INDEX IX_ProjectBoqItems_ProjectId_SortOrder
        ON dbo.ProjectBoqItems (ProjectId ASC, IsActive ASC, SortOrder ASC, ProjectBoqItemId ASC);
END
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
        ProjectBoqItemId,
        ProjectId,
        SystemName,
        ItemDescription,
        Quantity,
        Unit,
        SortOrder,
        CreatedAt,
        UpdatedAt
    FROM dbo.ProjectBoqItems
    WHERE ProjectId = @ProjectId
      AND IsActive = 1
    ORDER BY SortOrder ASC, ProjectBoqItemId ASC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectBoq_Create
    @ProjectId INT,
    @SystemName NVARCHAR(100) = NULL,
    @ItemDescription NVARCHAR(300),
    @Quantity DECIMAL(18,3),
    @Unit NVARCHAR(20),
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

    IF @SortOrder IS NULL
    BEGIN
        SELECT @SortOrder = ISNULL(MAX(SortOrder), 0) + 1
        FROM dbo.ProjectBoqItems
        WHERE ProjectId = @ProjectId
          AND IsActive = 1;
    END;

    INSERT INTO dbo.ProjectBoqItems
    (
        ProjectId,
        SystemName,
        ItemDescription,
        Quantity,
        Unit,
        SortOrder,
        CreatedAt
    )
    VALUES
    (
        @ProjectId,
        NULLIF(LTRIM(RTRIM(@SystemName)), N''),
        LTRIM(RTRIM(@ItemDescription)),
        @Quantity,
        LTRIM(RTRIM(@Unit)),
        @SortOrder,
        SYSUTCDATETIME()
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS ProjectBoqItemId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectBoq_Update
    @ProjectBoqItemId INT,
    @ProjectId INT,
    @SystemName NVARCHAR(100) = NULL,
    @ItemDescription NVARCHAR(300),
    @Quantity DECIMAL(18,3),
    @Unit NVARCHAR(20),
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

    UPDATE dbo.ProjectBoqItems
    SET
        SystemName = NULLIF(LTRIM(RTRIM(@SystemName)), N''),
        ItemDescription = LTRIM(RTRIM(@ItemDescription)),
        Quantity = @Quantity,
        Unit = LTRIM(RTRIM(@Unit)),
        SortOrder = @SortOrder,
        UpdatedAt = SYSUTCDATETIME()
    WHERE ProjectBoqItemId = @ProjectBoqItemId
      AND ProjectId = @ProjectId
      AND IsActive = 1;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectBoq_Delete
    @ProjectId INT,
    @ProjectBoqItemId INT
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

    UPDATE dbo.ProjectBoqItems
    SET
        IsActive = 0,
        UpdatedAt = SYSUTCDATETIME(),
        DeletedAt = SYSUTCDATETIME()
    WHERE ProjectBoqItemId = @ProjectBoqItemId
      AND ProjectId = @ProjectId
      AND IsActive = 1;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectBoq_Reorder
    @ProjectId INT,
    @ProjectBoqItemId INT,
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

    IF @SortOrder <= 0
    BEGIN
        THROW 51104, 'SortOrder must be greater than zero.', 1;
    END;

    UPDATE dbo.ProjectBoqItems
    SET
        SortOrder = @SortOrder,
        UpdatedAt = SYSUTCDATETIME()
    WHERE ProjectBoqItemId = @ProjectBoqItemId
      AND ProjectId = @ProjectId
      AND IsActive = 1;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

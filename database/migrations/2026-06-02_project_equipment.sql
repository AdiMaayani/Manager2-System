/*
    ManageR2 Project Equipment persistence migration.

    Run this script manually in SSMS against the intended target database.

    Changes:
    - Adds dbo.ProjectEquipmentItems for project-level equipment tracking.
    - Adds stored procedures used by the Project Drawer equipment tab.
*/

IF OBJECT_ID(N'dbo.ProjectEquipmentItems', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProjectEquipmentItems
    (
        ProjectEquipmentItemId INT IDENTITY(1,1) NOT NULL,
        ProjectId INT NOT NULL,
        EquipmentName NVARCHAR(200) NOT NULL,
        Status NVARCHAR(50) NOT NULL,
        Location NVARCHAR(200) NULL,
        SortOrder INT NOT NULL,
        CreatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_ProjectEquipmentItems_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CONSTRAINT PK_ProjectEquipmentItems PRIMARY KEY CLUSTERED (ProjectEquipmentItemId ASC),
        CONSTRAINT FK_ProjectEquipmentItems_WorkItems FOREIGN KEY (ProjectId)
            REFERENCES dbo.WorkItems (WorkItemId),
        CONSTRAINT CK_ProjectEquipmentItems_EquipmentName_NotBlank
            CHECK (LEN(LTRIM(RTRIM(EquipmentName))) > 0),
        CONSTRAINT CK_ProjectEquipmentItems_Status_NotBlank
            CHECK (LEN(LTRIM(RTRIM(Status))) > 0)
    );

    CREATE INDEX IX_ProjectEquipmentItems_ProjectId_SortOrder
        ON dbo.ProjectEquipmentItems (ProjectId ASC, SortOrder ASC, ProjectEquipmentItemId ASC);
END
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
        ProjectEquipmentItemId,
        ProjectId,
        EquipmentName,
        Status,
        Location,
        SortOrder,
        CreatedAt,
        UpdatedAt
    FROM dbo.ProjectEquipmentItems
    WHERE ProjectId = @ProjectId
    ORDER BY SortOrder ASC, ProjectEquipmentItemId ASC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectEquipment_Create
    @ProjectId INT,
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

    IF @SortOrder IS NULL
    BEGIN
        SELECT @SortOrder = ISNULL(MAX(SortOrder), 0) + 1
        FROM dbo.ProjectEquipmentItems
        WHERE ProjectId = @ProjectId;
    END;

    INSERT INTO dbo.ProjectEquipmentItems
    (
        ProjectId,
        EquipmentName,
        Status,
        Location,
        SortOrder,
        CreatedAt
    )
    VALUES
    (
        @ProjectId,
        LTRIM(RTRIM(@EquipmentName)),
        LTRIM(RTRIM(@Status)),
        NULLIF(LTRIM(RTRIM(@Location)), N''),
        @SortOrder,
        SYSUTCDATETIME()
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS ProjectEquipmentItemId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectEquipment_Update
    @ProjectEquipmentItemId INT,
    @ProjectId INT,
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

    UPDATE dbo.ProjectEquipmentItems
    SET
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

CREATE OR ALTER PROCEDURE dbo.sp_ProjectEquipment_Delete
    @ProjectEquipmentItemId INT,
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

    DELETE FROM dbo.ProjectEquipmentItems
    WHERE ProjectEquipmentItemId = @ProjectEquipmentItemId
      AND ProjectId = @ProjectId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectEquipment_Reorder
    @ProjectId INT,
    @ProjectEquipmentItemId INT,
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

    UPDATE dbo.ProjectEquipmentItems
    SET
        SortOrder = @SortOrder,
        UpdatedAt = SYSUTCDATETIME()
    WHERE ProjectEquipmentItemId = @ProjectEquipmentItemId
      AND ProjectId = @ProjectId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

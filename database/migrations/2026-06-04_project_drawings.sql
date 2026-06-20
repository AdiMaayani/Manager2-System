/*
    ManageR2 Project Drawings metadata persistence migration.

    Run this script manually in SSMS against the intended target database.

    Changes:
    - Adds dbo.ProjectDrawings for project-level document metadata.
    - Adds stored procedures used by the Project Drawer drawings tab.
*/

IF OBJECT_ID(N'dbo.ProjectDrawings', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProjectDrawings
    (
        ProjectDrawingId INT IDENTITY(1,1) NOT NULL,
        ProjectId INT NOT NULL,
        [Name] NVARCHAR(200) NOT NULL,
        [Type] NVARCHAR(20) NOT NULL,
        DrawingDate DATE NOT NULL,
        Note NVARCHAR(500) NULL,
        SortOrder INT NOT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_ProjectDrawings_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_ProjectDrawings_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        DeletedAt DATETIME2(7) NULL,
        CONSTRAINT PK_ProjectDrawings PRIMARY KEY CLUSTERED (ProjectDrawingId ASC),
        CONSTRAINT FK_ProjectDrawings_WorkItems FOREIGN KEY (ProjectId)
            REFERENCES dbo.WorkItems (WorkItemId),
        CONSTRAINT CK_ProjectDrawings_Name_NotBlank
            CHECK (LEN(LTRIM(RTRIM([Name]))) > 0),
        CONSTRAINT CK_ProjectDrawings_Type
            CHECK ([Type] IN (N'PDF', N'DWG'))
    );

    CREATE INDEX IX_ProjectDrawings_ProjectId_SortOrder
        ON dbo.ProjectDrawings (ProjectId ASC, SortOrder ASC, ProjectDrawingId ASC)
        WHERE IsActive = 1;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectDrawings_GetByProject
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
        ProjectDrawingId,
        ProjectId,
        [Name],
        [Type],
        DrawingDate,
        Note,
        SortOrder,
        CreatedAt,
        UpdatedAt
    FROM dbo.ProjectDrawings
    WHERE ProjectId = @ProjectId
      AND IsActive = 1
    ORDER BY SortOrder ASC, ProjectDrawingId ASC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectDrawings_Create
    @ProjectId INT,
    @Name NVARCHAR(200),
    @Type NVARCHAR(20),
    @DrawingDate DATE,
    @Note NVARCHAR(500) = NULL,
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

    IF NULLIF(LTRIM(RTRIM(@Name)), N'') IS NULL
    BEGIN
        THROW 51001, 'Name is required.', 1;
    END;

    SET @Type = UPPER(LTRIM(RTRIM(@Type)));

    IF @Type NOT IN (N'PDF', N'DWG')
    BEGIN
        THROW 51002, 'Type must be PDF or DWG.', 1;
    END;

    IF @DrawingDate IS NULL
    BEGIN
        THROW 51003, 'DrawingDate is required.', 1;
    END;

    IF @SortOrder IS NULL
    BEGIN
        SELECT @SortOrder = ISNULL(MAX(SortOrder), 0) + 1
        FROM dbo.ProjectDrawings
        WHERE ProjectId = @ProjectId
          AND IsActive = 1;
    END;

    INSERT INTO dbo.ProjectDrawings
    (
        ProjectId,
        [Name],
        [Type],
        DrawingDate,
        Note,
        SortOrder,
        CreatedAt
    )
    VALUES
    (
        @ProjectId,
        LTRIM(RTRIM(@Name)),
        @Type,
        @DrawingDate,
        NULLIF(LTRIM(RTRIM(@Note)), N''),
        @SortOrder,
        SYSUTCDATETIME()
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT);
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectDrawings_Update
    @ProjectDrawingId INT,
    @ProjectId INT,
    @Name NVARCHAR(200),
    @Type NVARCHAR(20),
    @DrawingDate DATE,
    @Note NVARCHAR(500) = NULL,
    @SortOrder INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NULLIF(LTRIM(RTRIM(@Name)), N'') IS NULL
    BEGIN
        THROW 51001, 'Name is required.', 1;
    END;

    SET @Type = UPPER(LTRIM(RTRIM(@Type)));

    IF @Type NOT IN (N'PDF', N'DWG')
    BEGIN
        THROW 51002, 'Type must be PDF or DWG.', 1;
    END;

    IF @DrawingDate IS NULL
    BEGIN
        THROW 51003, 'DrawingDate is required.', 1;
    END;

    UPDATE dbo.ProjectDrawings
    SET
        [Name] = LTRIM(RTRIM(@Name)),
        [Type] = @Type,
        DrawingDate = @DrawingDate,
        Note = NULLIF(LTRIM(RTRIM(@Note)), N''),
        SortOrder = @SortOrder,
        UpdatedAt = SYSUTCDATETIME()
    WHERE ProjectDrawingId = @ProjectDrawingId
      AND ProjectId = @ProjectId
      AND IsActive = 1;

    SELECT @@ROWCOUNT;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectDrawings_Delete
    @ProjectId INT,
    @ProjectDrawingId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.ProjectDrawings
    SET
        IsActive = 0,
        DeletedAt = SYSUTCDATETIME(),
        UpdatedAt = SYSUTCDATETIME()
    WHERE ProjectDrawingId = @ProjectDrawingId
      AND ProjectId = @ProjectId
      AND IsActive = 1;

    SELECT @@ROWCOUNT;
END
GO

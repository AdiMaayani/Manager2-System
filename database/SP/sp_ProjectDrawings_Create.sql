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

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

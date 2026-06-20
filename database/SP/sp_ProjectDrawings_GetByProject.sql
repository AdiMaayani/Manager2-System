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
        OriginalFileName,
        StoredFileName,
        FilePath,
        ContentType,
        FileSizeBytes,
        SortOrder,
        CreatedAt,
        UpdatedAt
    FROM dbo.ProjectDrawings
    WHERE ProjectId = @ProjectId
      AND IsActive = 1
    ORDER BY SortOrder ASC, ProjectDrawingId ASC;
END
GO

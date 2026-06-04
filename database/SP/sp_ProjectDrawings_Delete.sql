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

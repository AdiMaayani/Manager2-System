SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
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

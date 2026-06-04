SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
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

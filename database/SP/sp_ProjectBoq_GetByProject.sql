SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
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

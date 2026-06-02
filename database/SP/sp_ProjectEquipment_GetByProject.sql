SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
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

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
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

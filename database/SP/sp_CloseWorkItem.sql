SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[sp_CloseWorkItem]
    @WorkItemId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.WorkItems
    SET
        Status = 'Cancelled',
        ClosedAt = GETDATE()
    WHERE WorkItemId = @WorkItemId
      AND ClosedAt IS NULL;

    SELECT @@ROWCOUNT AS RowsAffected;
END;
GO

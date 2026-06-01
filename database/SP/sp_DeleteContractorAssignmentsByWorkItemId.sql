SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[sp_DeleteContractorAssignmentsByWorkItemId]
    @WorkItemId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM dbo.WorkContractorAssignments
    WHERE WorkItemId = @WorkItemId;

    SELECT @@ROWCOUNT AS RowsAffected;
END;
GO

USE [igroup30_prod];
GO

CREATE OR ALTER PROCEDURE dbo.sp_DeleteContractorAssignmentsByWorkItemId
    @WorkItemId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM dbo.WorkContractorAssignments
    WHERE WorkItemId = @WorkItemId;

    SELECT @@ROWCOUNT;
END
GO

USE [igroup30_prod];
GO

CREATE OR ALTER PROCEDURE dbo.sp_DeleteEmployeeAssignmentsByWorkItemId
    @WorkItemId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM dbo.WorkEmployeeAssignments
    WHERE WorkItemId = @WorkItemId;

    SELECT @@ROWCOUNT;
END
GO

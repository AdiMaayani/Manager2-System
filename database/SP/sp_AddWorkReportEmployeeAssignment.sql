SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_AddWorkReportEmployeeAssignment]
    @WorkReportId INT,
    @EmployeeId INT = NULL,
    @EmployeeName NVARCHAR(100) = NULL,
    @AssignmentRole NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.WorkReportEmployeeAssignments
    (
        WorkReportId,
        EmployeeId,
        EmployeeName,
        AssignmentRole,
        AssignedAt
    )
    VALUES
    (
        @WorkReportId,
        @EmployeeId,
        @EmployeeName,
        @AssignmentRole,
        GETDATE()
    );
END;
GO

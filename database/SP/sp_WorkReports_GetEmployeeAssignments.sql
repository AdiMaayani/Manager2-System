SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_WorkReports_GetEmployeeAssignments
    @WorkReportId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        EmployeeId,
        EmployeeName
    FROM dbo.WorkReportEmployeeAssignments
    WHERE WorkReportId = @WorkReportId
    ORDER BY WorkReportEmployeeAssignmentId;
END
GO

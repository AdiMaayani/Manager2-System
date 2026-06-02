SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_WorkReports_DeleteEmployeeAssignments
    @WorkReportId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM dbo.WorkReportEmployeeAssignments
    WHERE WorkReportId = @WorkReportId;
END
GO

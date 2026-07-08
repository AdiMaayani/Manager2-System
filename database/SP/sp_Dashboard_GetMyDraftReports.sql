SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_Dashboard_GetMyDraftReports
    @EmployeeId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @EmployeeId IS NULL OR @EmployeeId <= 0
        RETURN;

    SELECT TOP (50)
        wr.WorkReportId,
        wr.WorkItemId,
        wr.ReportType,
        wr.ReportDate,
        wr.ProjectName,
        wr.CustomerName,
        wr.Status
    FROM dbo.WorkReports AS wr
    WHERE wr.ReporterEmployeeId = @EmployeeId
      AND wr.Status = N'טיוטה'
    ORDER BY wr.ReportDate DESC, wr.WorkReportId DESC;
END
GO

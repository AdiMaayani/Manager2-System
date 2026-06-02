SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_WorkReports_GetById
    @WorkReportId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        WorkReportId,
        WorkItemId,
        ReportType,
        ReportDate,
        ProjectName,
        CustomerName,
        Site,
        StartTime,
        EndTime,
        Summary,
        Notes,
        ReporterEmployeeId,
        ReporterName,
        ReporterRole,
        Status,
        FollowUpRequired,
        FollowUpReason
    FROM dbo.WorkReports
    WHERE WorkReportId = @WorkReportId;
END
GO

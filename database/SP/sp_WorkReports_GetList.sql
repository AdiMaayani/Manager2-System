SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_WorkReports_GetList
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        WorkReportId,
        ReportDate,
        ProjectName,
        CustomerName,
        ReporterName,
        Status,
        FollowUpRequired
    FROM dbo.WorkReports
    ORDER BY ReportDate DESC, WorkReportId DESC;
END
GO

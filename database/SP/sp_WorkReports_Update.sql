SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_WorkReports_Update
    @WorkReportId INT,
    @WorkItemId INT = NULL,
    @ReportType NVARCHAR(50) = NULL,
    @ReportDate DATETIME = NULL,
    @ProjectName NVARCHAR(150) = NULL,
    @CustomerName NVARCHAR(150) = NULL,
    @Site NVARCHAR(200) = NULL,
    @StartTime NVARCHAR(10) = NULL,
    @EndTime NVARCHAR(10) = NULL,
    @Summary NVARCHAR(1000) = NULL,
    @Notes NVARCHAR(2000) = NULL,
    @ReporterEmployeeId INT = NULL,
    @ReporterName NVARCHAR(100) = NULL,
    @ReporterRole NVARCHAR(100) = NULL,
    @WorkersCount INT = NULL,
    @Status NVARCHAR(50) = N'טיוטה',
    @FollowUpRequired BIT = NULL,
    @FollowUpReason NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.WorkReports
    SET
        WorkItemId = @WorkItemId,
        ReportType = @ReportType,
        ReportDate = @ReportDate,
        ProjectName = @ProjectName,
        CustomerName = @CustomerName,
        Site = @Site,
        StartTime = @StartTime,
        EndTime = @EndTime,
        Summary = @Summary,
        Notes = @Notes,
        ReporterEmployeeId = @ReporterEmployeeId,
        ReporterName = @ReporterName,
        ReporterRole = @ReporterRole,
        WorkersCount = @WorkersCount,
        Status = @Status,
        FollowUpRequired = @FollowUpRequired,
        FollowUpReason = @FollowUpReason
    WHERE WorkReportId = @WorkReportId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

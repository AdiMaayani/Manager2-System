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
    @FollowUpReason NVARCHAR(1000) = NULL,
    @UpdatedByUserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.WorkReports WHERE WorkReportId=@WorkReportId AND LifecycleStatus=N'Reversed')
        THROW 51360, 'Reversed reports are read-only.', 1;

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
        FollowUpReason = @FollowUpReason,
        UpdatedAt = SYSUTCDATETIME(),
        UpdatedByUserId = @UpdatedByUserId
    WHERE WorkReportId = @WorkReportId
      AND LifecycleStatus IN (N'Draft', N'Finalized');

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

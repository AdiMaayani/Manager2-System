SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_CreateWorkReport]
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
    @AmendsWorkReportId INT = NULL,
    @UpdatedByUserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @AmendsWorkReportId IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.WorkReports WHERE WorkReportId=@AmendsWorkReportId AND LifecycleStatus=N'Reversed')
        THROW 51361, 'An amendment must reference a reversed work report.', 1;

    INSERT INTO dbo.WorkReports
    (
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
        WorkersCount,
		Status,
        FollowUpRequired,
        FollowUpReason,
        CreatedAt,
        LifecycleStatus,
        AmendsWorkReportId,
        UpdatedAt,
        UpdatedByUserId
    )
    VALUES
    (
        @WorkItemId,
        @ReportType,
        @ReportDate,
        @ProjectName,
        @CustomerName,
        @Site,
        @StartTime,
        @EndTime,
        @Summary,
        @Notes,
        @ReporterEmployeeId,
        @ReporterName,
        @ReporterRole,
        @WorkersCount,
		@Status,
        @FollowUpRequired,
        @FollowUpReason,
        SYSUTCDATETIME(),
        N'Draft',
        @AmendsWorkReportId,
        SYSUTCDATETIME(),
        @UpdatedByUserId
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS NewWorkReportId;
END;
GO

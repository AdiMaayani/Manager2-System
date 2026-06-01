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
    @FollowUpReason NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;

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
        CreatedAt
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
        GETDATE()
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS NewWorkReportId;
END;
GO

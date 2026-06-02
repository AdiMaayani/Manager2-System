/*
    ManageR2 reports lifecycle migration.

    Run this script manually in SSMS against the intended target database.
    It adds stored procedures for report list/detail reads, edit, and physical delete.

    Notes:
    - No table schema is changed.
    - WorkReports has no soft-delete column, so delete is a physical delete.
    - WorkReports has no ServiceCallId/ServiceCallTitle columns, so those fields
      cannot be persisted by this migration.
*/

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

CREATE OR ALTER PROCEDURE dbo.sp_WorkReports_GetSystems
    @WorkReportId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT SystemName
    FROM dbo.WorkReportSystems
    WHERE WorkReportId = @WorkReportId
    ORDER BY WorkReportSystemId;
END
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

CREATE OR ALTER PROCEDURE dbo.sp_WorkReports_DeleteSystems
    @WorkReportId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM dbo.WorkReportSystems
    WHERE WorkReportId = @WorkReportId;
END
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

CREATE OR ALTER PROCEDURE dbo.sp_WorkReports_Delete
    @WorkReportId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    DELETE FROM dbo.WorkReportEmployeeAssignments
    WHERE WorkReportId = @WorkReportId;

    DELETE FROM dbo.WorkReportSystems
    WHERE WorkReportId = @WorkReportId;

    DELETE FROM dbo.WorkReports
    WHERE WorkReportId = @WorkReportId;

    SELECT @@ROWCOUNT AS RowsAffected;

    COMMIT TRANSACTION;
END
GO

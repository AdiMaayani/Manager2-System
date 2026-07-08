/*
================================================================================
ManageR2 — Fix sp_WorkReports_Update @AmendsWorkReportId parameter (2026-07-08)
================================================================================

WARNING: Run only against the intended target database.
Confirm DB_NAME() and @@SERVERNAME before executing.

This script CREATE OR ALTERs dbo.sp_WorkReports_Update only.
No table changes, no data changes, no other procedures.

Use UTF-8-safe execution (SSMS UTF-8 encoding or sqlcmd -f 65001).
-- USE [YourTargetDatabase];  -- uncomment and set before running
================================================================================
*/

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
    @AmendsWorkReportId INT = NULL,
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
        AmendsWorkReportId = @AmendsWorkReportId,
        UpdatedAt = SYSUTCDATETIME(),
        UpdatedByUserId = @UpdatedByUserId
    WHERE WorkReportId = @WorkReportId
      AND LifecycleStatus IN (N'Draft', N'Finalized');

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

/*
================================================================================
READ-ONLY post-check (run after patch; does not modify anything)
================================================================================
*/
SET NOCOUNT ON;

DECLARE @Definition NVARCHAR(MAX) =
(
    SELECT m.definition
    FROM sys.procedures p
    INNER JOIN sys.sql_modules m ON m.object_id = p.object_id
    WHERE p.name = N'sp_WorkReports_Update'
      AND p.schema_id = SCHEMA_ID(N'dbo')
);

SELECT
    N'sp_WorkReports_Update' AS ProcedureName,
    CASE WHEN @Definition IS NULL THEN N'FAIL' ELSE N'PASS' END AS ProcedureExists,
    CASE WHEN EXISTS (
        SELECT 1
        FROM sys.procedures p
        INNER JOIN sys.parameters pr ON pr.object_id = p.object_id
        WHERE p.name = N'sp_WorkReports_Update'
          AND p.schema_id = SCHEMA_ID(N'dbo')
          AND pr.name = N'@AmendsWorkReportId'
    ) THEN N'PASS' ELSE N'FAIL' END AS HasAmendsWorkReportId,
    CASE WHEN EXISTS (
        SELECT 1
        FROM sys.procedures p
        INNER JOIN sys.parameters pr ON pr.object_id = p.object_id
        WHERE p.name = N'sp_WorkReports_Update'
          AND p.schema_id = SCHEMA_ID(N'dbo')
          AND pr.name = N'@UpdatedByUserId'
    ) THEN N'PASS' ELSE N'FAIL' END AS HasUpdatedByUserId,
    CASE WHEN CHARINDEX(N'טיוטה', @Definition) > 0 THEN N'PASS' ELSE N'FAIL' END AS HebrewDefaultReadable,
    CASE WHEN CHARINDEX(N'LifecycleStatus=N''Reversed''', @Definition) > 0 THEN N'PASS' ELSE N'FAIL' END AS ReversedGuardPresent,
    CASE WHEN @Definition IS NOT NULL AND CHARINDEX(NCHAR(65533), @Definition) = 0 THEN N'PASS' ELSE N'FAIL' END AS NoReplacementCharacters;

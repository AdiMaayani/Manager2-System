/*
================================================================================
ManageR2 — Fix work-report lifecycle output contract (2026-07-12)
================================================================================

WARNING: Run only against the intended development/test target database.
Confirm DB_NAME() and @@SERVERNAME before executing.

This script CREATE OR ALTERs:
- dbo.sp_WorkReports_Finalize
- dbo.sp_WorkReports_Reverse

It does not change tables or data. The work-report lifecycle columns from
2026-06-19_workplan_reports_overhaul.sql must already exist.
Lifecycle output parameters are populated before COMMIT so any SQL-side contract
failure rolls back inventory and lifecycle changes.
-- USE [YourTargetDatabase];  -- uncomment and set before running
================================================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @ExpectedDatabaseName SYSNAME = N'';
DECLARE @ExpectedServerName SYSNAME = N'';
IF NULLIF(@ExpectedDatabaseName, N'') IS NULL OR NULLIF(@ExpectedServerName, N'') IS NULL
    THROW 51440, 'Set @ExpectedDatabaseName and @ExpectedServerName before execution.', 1;
IF DB_NAME() <> @ExpectedDatabaseName OR CONVERT(SYSNAME, @@SERVERNAME) <> @ExpectedServerName
    THROW 51443, 'Connected database/server does not match the operator-approved target.', 1;

IF OBJECT_ID(N'dbo.WorkReports', N'U') IS NULL
    THROW 51441, 'dbo.WorkReports does not exist in the selected database.', 1;

IF COL_LENGTH(N'dbo.WorkReports', N'LifecycleStatus') IS NULL
   OR COL_LENGTH(N'dbo.WorkReports', N'FinalizedAt') IS NULL
   OR COL_LENGTH(N'dbo.WorkReports', N'FinalizedByUserId') IS NULL
   OR COL_LENGTH(N'dbo.WorkReports', N'ReversedAt') IS NULL
   OR COL_LENGTH(N'dbo.WorkReports', N'ReversedByUserId') IS NULL
   OR COL_LENGTH(N'dbo.WorkReports', N'ReversalReason') IS NULL
BEGIN
    THROW 51442, 'WorkReports lifecycle schema is behind the application. Apply the approved SQL Server lifecycle migration first.', 1;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_WorkReports_Finalize
 @WorkReportId INT,@FinalizedByUserId INT=NULL,
 @OutputStatus NVARCHAR(50)=NULL OUTPUT,@OutputLifecycleStatus NVARCHAR(20)=NULL OUTPUT,
 @OutputFinalizedAt DATETIME2(7)=NULL OUTPUT,@OutputFinalizedByUserId INT=NULL OUTPUT,
 @OutputReversedAt DATETIME2(7)=NULL OUTPUT,@OutputReversedByUserId INT=NULL OUTPUT,
 @OutputReversalReason NVARCHAR(500)=NULL OUTPUT
AS BEGIN SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  DECLARE @Life NVARCHAR(20);
  SELECT @Life=LifecycleStatus FROM dbo.WorkReports WITH(UPDLOCK,HOLDLOCK) WHERE WorkReportId=@WorkReportId;
  IF @Life IS NULL THROW 51340,''Work report not found.'',1;
  IF @Life=N''Reversed'' THROW 51341,''A reversed report cannot be finalized.'',1;
  IF @Life=N''Draft'' BEGIN
   EXEC dbo.sp_InventoryStockMovements_ApplyForReport @WorkReportId,N''ReportUsage'',@FinalizedByUserId;
   UPDATE dbo.WorkReports SET LifecycleStatus=N''Finalized'',FinalizedAt=SYSUTCDATETIME(),FinalizedByUserId=@FinalizedByUserId,
    UpdatedAt=SYSUTCDATETIME(),UpdatedByUserId=@FinalizedByUserId WHERE WorkReportId=@WorkReportId;
  END;
  SELECT @OutputStatus=Status,@OutputLifecycleStatus=LifecycleStatus,
   @OutputFinalizedAt=FinalizedAt,@OutputFinalizedByUserId=FinalizedByUserId,
   @OutputReversedAt=ReversedAt,@OutputReversedByUserId=ReversedByUserId,
   @OutputReversalReason=ReversalReason
  FROM dbo.WorkReports WHERE WorkReportId=@WorkReportId;
  IF @OutputLifecycleStatus IS NULL THROW 51342,''Finalized report lifecycle output could not be loaded.'',1;
  COMMIT;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
END';

    EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_WorkReports_Reverse
 @WorkReportId INT,@ReversalReason NVARCHAR(500)=NULL,@ReversedByUserId INT=NULL,
 @OutputStatus NVARCHAR(50)=NULL OUTPUT,@OutputLifecycleStatus NVARCHAR(20)=NULL OUTPUT,
 @OutputFinalizedAt DATETIME2(7)=NULL OUTPUT,@OutputFinalizedByUserId INT=NULL OUTPUT,
 @OutputReversedAt DATETIME2(7)=NULL OUTPUT,@OutputReversedByUserId INT=NULL OUTPUT,
 @OutputReversalReason NVARCHAR(500)=NULL OUTPUT
AS BEGIN SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  DECLARE @Life NVARCHAR(20);
  SELECT @Life=LifecycleStatus FROM dbo.WorkReports WITH(UPDLOCK,HOLDLOCK) WHERE WorkReportId=@WorkReportId;
  IF @Life IS NULL THROW 51351,''Work report not found.'',1;
  IF @Life=N''Draft'' THROW 51352,''A Draft report cannot be reversed.'',1;
  IF @Life=N''Finalized'' BEGIN
   IF NULLIF(LTRIM(RTRIM(@ReversalReason)),N'''') IS NULL THROW 51350,''Reversal reason is required.'',1;
   EXEC dbo.sp_InventoryStockMovements_ApplyForReport @WorkReportId,N''ReportReversal'',@ReversedByUserId;
   UPDATE dbo.WorkReports SET LifecycleStatus=N''Reversed'',ReversedAt=SYSUTCDATETIME(),ReversedByUserId=@ReversedByUserId,
    ReversalReason=@ReversalReason,UpdatedAt=SYSUTCDATETIME(),UpdatedByUserId=@ReversedByUserId WHERE WorkReportId=@WorkReportId;
  END;
  SELECT @OutputStatus=Status,@OutputLifecycleStatus=LifecycleStatus,
   @OutputFinalizedAt=FinalizedAt,@OutputFinalizedByUserId=FinalizedByUserId,
   @OutputReversedAt=ReversedAt,@OutputReversedByUserId=ReversedByUserId,
   @OutputReversalReason=ReversalReason
  FROM dbo.WorkReports WHERE WorkReportId=@WorkReportId;
  IF @OutputLifecycleStatus IS NULL THROW 51353,''Reversed report lifecycle output could not be loaded.'',1;
  COMMIT;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
END';

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;

/*
READ-ONLY post-check
*/
SELECT
    p.name AS ProcedureName,
    CASE WHEN CHARINDEX(N'@OutputLifecycleStatus', m.definition) > 0
          AND CHARINDEX(N'IF @OutputLifecycleStatus IS NULL THROW', m.definition) > 0
          AND CHARINDEX(N'COMMIT', m.definition) > CHARINDEX(N'@OutputLifecycleStatus IS NULL', m.definition)
        THEN N'PASS' ELSE N'FAIL' END AS LifecycleResultContract
FROM sys.procedures p
INNER JOIN sys.sql_modules m ON m.object_id = p.object_id
WHERE p.schema_id = SCHEMA_ID(N'dbo')
  AND p.name IN (N'sp_WorkReports_Finalize', N'sp_WorkReports_Reverse')
ORDER BY p.name;
GO

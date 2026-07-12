/*
================================================================================
ManageR2 — Allow same-day project milestones (2026-07-12)
================================================================================

WARNING: Run only against the intended development/test target database.
Confirm DB_NAME() and @@SERVERNAME before executing.

This patch updates only:
- CK_ProjectMilestones_PlannedRange
- dbo.sp_ProjectMilestones_Create
- dbo.sp_ProjectMilestones_Update

It does not change existing data.
-- USE [YourTargetDatabase];  -- uncomment and set before running
================================================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @ExpectedDatabaseName SYSNAME = N'';
DECLARE @ExpectedServerName SYSNAME = N'';
IF NULLIF(@ExpectedDatabaseName, N'') IS NULL OR NULLIF(@ExpectedServerName, N'') IS NULL
    THROW 51438, 'Set @ExpectedDatabaseName and @ExpectedServerName before execution.', 1;
IF DB_NAME() <> @ExpectedDatabaseName OR CONVERT(SYSNAME, @@SERVERNAME) <> @ExpectedServerName
    THROW 51439, 'Connected database/server does not match the operator-approved target.', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'dbo.ProjectMilestones', N'U') IS NULL
        THROW 51440, 'dbo.ProjectMilestones does not exist in the selected database.', 1;

    IF EXISTS
    (
        SELECT 1
        FROM sys.check_constraints
        WHERE name = N'CK_ProjectMilestones_PlannedRange'
          AND parent_object_id = OBJECT_ID(N'dbo.ProjectMilestones')
    )
    BEGIN
        ALTER TABLE dbo.ProjectMilestones
            DROP CONSTRAINT CK_ProjectMilestones_PlannedRange;
    END;

    ALTER TABLE dbo.ProjectMilestones WITH CHECK
        ADD CONSTRAINT CK_ProjectMilestones_PlannedRange CHECK
        (
            (PlannedStart IS NULL AND PlannedEnd IS NULL) OR
            (PlannedStart IS NOT NULL AND PlannedEnd IS NOT NULL AND PlannedEnd >= PlannedStart)
        );

    ALTER TABLE dbo.ProjectMilestones
        CHECK CONSTRAINT CK_ProjectMilestones_PlannedRange;

    EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_ProjectMilestones_Create
 @ProjectId INT,@Title NVARCHAR(200),@Description NVARCHAR(1000)=NULL,@SortOrder INT=0,
 @Status NVARCHAR(50)=N''Planned'',@ManagerEmployeeId INT=NULL,
 @PlannedStart DATETIME2(7)=NULL,@PlannedEnd DATETIME2(7)=NULL
AS BEGIN SET NOCOUNT ON;
 IF NOT EXISTS(SELECT 1 FROM dbo.WorkItems WHERE WorkItemId=@ProjectId AND WorkType=N''Project'' AND IsArchived=0) THROW 51200,''Active project not found.'',1;
 IF @ManagerEmployeeId IS NULL THROW 51202,''ManagerEmployeeId is required for new milestones.'',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.Employees WHERE EmployeeId=@ManagerEmployeeId AND IsActive=1) THROW 51203,''Active manager employee not found.'',1;
 IF (@PlannedStart IS NULL AND @PlannedEnd IS NOT NULL) OR (@PlannedStart IS NOT NULL AND @PlannedEnd IS NULL) OR @PlannedEnd<@PlannedStart THROW 51201,''Planned dates must be null together or end on or after the start.'',1;
 INSERT dbo.ProjectMilestones(ProjectId,Title,Description,SortOrder,Status,ManagerEmployeeId,PlannedStart,PlannedEnd)
 VALUES(@ProjectId,@Title,@Description,@SortOrder,@Status,@ManagerEmployeeId,@PlannedStart,@PlannedEnd);
 SELECT CAST(SCOPE_IDENTITY() AS INT) ProjectMilestoneId;
END';

    EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_ProjectMilestones_Update
 @ProjectMilestoneId INT,@ProjectId INT,@Title NVARCHAR(200),@Description NVARCHAR(1000)=NULL,
 @SortOrder INT,@Status NVARCHAR(50),@ManagerEmployeeId INT=NULL,
 @PlannedStart DATETIME2(7)=NULL,@PlannedEnd DATETIME2(7)=NULL,
 @ActualStart DATETIME2(7)=NULL,@ActualEnd DATETIME2(7)=NULL,@ProgressPercent DECIMAL(5,2)=0
AS BEGIN SET NOCOUNT ON;
 IF NOT EXISTS(SELECT 1 FROM dbo.WorkItems WHERE WorkItemId=@ProjectId AND WorkType=N''Project'' AND IsArchived=0) THROW 51210,''Active project not found.'',1;
 IF (@PlannedStart IS NULL AND @PlannedEnd IS NOT NULL) OR (@PlannedStart IS NOT NULL AND @PlannedEnd IS NULL) OR @PlannedEnd<@PlannedStart THROW 51211,''Planned dates must be null together or end on or after the start.'',1;
 IF (@ActualStart IS NULL AND @ActualEnd IS NOT NULL) OR (@ActualStart IS NOT NULL AND @ActualEnd IS NULL) OR @ActualEnd<=@ActualStart THROW 51212,''Actual dates must be null together or form an increasing range.'',1;
 IF @ManagerEmployeeId IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dbo.Employees WHERE EmployeeId=@ManagerEmployeeId AND IsActive=1) THROW 51214,''Active manager employee not found.'',1;
 IF EXISTS(SELECT 1 FROM dbo.WorkItems WHERE MilestoneId=@ProjectMilestoneId AND IsArchived=0 AND ParentWorkItemId<>@ProjectId) THROW 51213,''Cannot move a milestone across projects while tasks reference it.'',1;
 UPDATE dbo.ProjectMilestones SET ProjectId=@ProjectId,Title=@Title,Description=@Description,
  SortOrder=@SortOrder,Status=@Status,ManagerEmployeeId=@ManagerEmployeeId,PlannedStart=@PlannedStart,PlannedEnd=@PlannedEnd,
  ActualStart=@ActualStart,ActualEnd=@ActualEnd,ProgressPercent=@ProgressPercent,UpdatedAt=SYSUTCDATETIME()
 WHERE ProjectMilestoneId=@ProjectMilestoneId AND IsActive=1;
 SELECT @@ROWCOUNT RowsAffected;
END';

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

/*
READ-ONLY post-check
*/
SELECT
    DB_NAME() AS DatabaseName,
    @@SERVERNAME AS ServerName,
    definition AS PlannedRangeConstraint
FROM sys.check_constraints
WHERE name = N'CK_ProjectMilestones_PlannedRange'
  AND parent_object_id = OBJECT_ID(N'dbo.ProjectMilestones');

SELECT
    p.name AS ProcedureName,
    CASE WHEN CHARINDEX(N'@PlannedEnd<@PlannedStart', m.definition) > 0
        THEN N'PASS' ELSE N'FAIL' END AS SameDayGuard
FROM sys.procedures p
INNER JOIN sys.sql_modules m ON m.object_id = p.object_id
WHERE p.schema_id = SCHEMA_ID(N'dbo')
  AND p.name IN (N'sp_ProjectMilestones_Create', N'sp_ProjectMilestones_Update')
ORDER BY p.name;
GO

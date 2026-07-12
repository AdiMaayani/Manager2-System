/*
================================================================================
ManageR2 — Prevent site customer reassignment (2026-07-12)
================================================================================

WARNING: Run only against the intended development/test target database.
Confirm DB_NAME() and @@SERVERNAME before executing.

This script CREATE OR ALTERs dbo.sp_UpdateSite only.
It does not change tables or data.
-- USE [YourTargetDatabase];  -- uncomment and set before running
================================================================================
*/

SET NOCOUNT ON;

DECLARE @ExpectedDatabaseName SYSNAME = N'';
DECLARE @ExpectedServerName SYSNAME = N'';
IF NULLIF(@ExpectedDatabaseName, N'') IS NULL OR NULLIF(@ExpectedServerName, N'') IS NULL
    THROW 51448, 'Set @ExpectedDatabaseName and @ExpectedServerName before execution.', 1;
IF DB_NAME() <> @ExpectedDatabaseName OR CONVERT(SYSNAME, @@SERVERNAME) <> @ExpectedServerName
    THROW 51449, 'Connected database/server does not match the operator-approved target.', 1;
IF OBJECT_ID(N'dbo.Sites', N'U') IS NULL
    THROW 51451, 'dbo.Sites does not exist in the selected database.', 1;

EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_UpdateSite
    @SiteId INT,
    @CustomerId INT,
    @SiteName NVARCHAR(100),
    @AddressLine NVARCHAR(200) = NULL,
    @City NVARCHAR(50) = NULL,
    @IsPrimary BIT,
    @Notes NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.Sites
        WHERE SiteId = @SiteId
          AND IsActive = 1
          AND CustomerId <> @CustomerId
    )
        THROW 51450, ''Reassigning a site to another customer is not allowed.'', 1;

    UPDATE dbo.Sites
    SET
        SiteName = @SiteName,
        AddressLine = @AddressLine,
        City = @City,
        IsPrimary = @IsPrimary,
        Notes = @Notes,
        UpdatedAt = SYSUTCDATETIME()
    WHERE SiteId = @SiteId
      AND IsActive = 1;

    SELECT @@ROWCOUNT AS RowsAffected;
END';

/*
READ-ONLY post-check
*/
SELECT
    CASE WHEN CHARINDEX(N'Reassigning a site to another customer is not allowed', definition) > 0
        THEN N'PASS' ELSE N'FAIL' END AS CustomerReassignmentGuard
FROM sys.sql_modules
WHERE object_id = OBJECT_ID(N'dbo.sp_UpdateSite');
GO

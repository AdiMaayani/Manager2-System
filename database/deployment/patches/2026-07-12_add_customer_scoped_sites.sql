/*
================================================================================
ManageR2 — Add customer-scoped site retrieval (2026-07-12)
================================================================================

WARNING: Run only against the intended development/test target database.
Set the expected database and server names before executing.

This script CREATE OR ALTERs dbo.sp_GetSitesByCustomerId only.
It does not change tables or data.
================================================================================
*/

SET NOCOUNT ON;

DECLARE @ExpectedDatabaseName SYSNAME = N'';
DECLARE @ExpectedServerName SYSNAME = N'';
IF NULLIF(@ExpectedDatabaseName, N'') IS NULL OR NULLIF(@ExpectedServerName, N'') IS NULL
    THROW 51458, 'Set @ExpectedDatabaseName and @ExpectedServerName before execution.', 1;
IF DB_NAME() <> @ExpectedDatabaseName OR CONVERT(SYSNAME, @@SERVERNAME) <> @ExpectedServerName
    THROW 51459, 'Connected database/server does not match the operator-approved target.', 1;
IF OBJECT_ID(N'dbo.Sites', N'U') IS NULL
    THROW 51460, 'dbo.Sites does not exist in the selected database.', 1;

EXEC sys.sp_executesql N'
CREATE OR ALTER PROCEDURE dbo.sp_GetSitesByCustomerId
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        SiteId,
        CustomerId,
        SiteName,
        AddressLine,
        City,
        IsPrimary,
        Notes,
        CreatedAt,
        UpdatedAt
    FROM dbo.Sites
    WHERE CustomerId = @CustomerId
      AND IsActive = 1
    ORDER BY IsPrimary DESC, SiteName, SiteId;
END';

SELECT
    CASE WHEN OBJECT_ID(N'dbo.sp_GetSitesByCustomerId', N'P') IS NOT NULL
        THEN N'PASS' ELSE N'FAIL' END AS CustomerScopedSitesProcedure;
GO

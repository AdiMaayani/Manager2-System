/*
    ManageR2 login lockout migration.

    Purpose:
        Adds account-lockout support for the login flow (defense-in-depth alongside the
        per-IP login rate limiter). After a configurable number of consecutive failed
        login attempts the account is temporarily locked.

    Safety:
        - Additive only. Adds two nullable/defaulted columns to dbo.Users and three
          stored procedures. It does not drop or alter existing columns or data.
        - Idempotent: re-running it is safe (columns are guarded with IF NOT EXISTS,
          procedures use CREATE OR ALTER).
        - The API treats these procedures as best-effort: until this script is applied
          the login flow keeps working with lockout simply disabled.

    How to run:
        Execute this script manually in SSMS (or sqlcmd) against the target database, e.g.

            sqlcmd -S localhost -d ManageR2_Dev -i database/migrations/2026-06-14_users_login_lockout.sql

    Tuning:
        Lockout thresholds live in sp_Users_RegisterFailedLogin below
        (@MaxAttempts = 5 failed attempts, @LockoutMinutes = 15 minute lock).
*/

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = N'FailedLoginAttempts')
BEGIN
    ALTER TABLE dbo.Users ADD FailedLoginAttempts INT NOT NULL CONSTRAINT DF_Users_FailedLoginAttempts DEFAULT (0);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = N'LockoutUntilUtc')
BEGIN
    ALTER TABLE dbo.Users ADD LockoutUntilUtc DATETIME2 NULL;
END;
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_Users_GetLoginSecurity]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        FailedLoginAttempts,
        LockoutUntilUtc
    FROM dbo.Users
    WHERE UserId = @UserId;
END;
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_Users_RegisterFailedLogin]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @MaxAttempts INT = 5;
    DECLARE @LockoutMinutes INT = 15;

    UPDATE dbo.Users
    SET
        FailedLoginAttempts = ISNULL(FailedLoginAttempts, 0) + 1,
        LockoutUntilUtc = CASE
            WHEN ISNULL(FailedLoginAttempts, 0) + 1 >= @MaxAttempts
                THEN DATEADD(MINUTE, @LockoutMinutes, SYSUTCDATETIME())
            ELSE LockoutUntilUtc
        END
    WHERE UserId = @UserId;
END;
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_Users_ClearFailedLogin]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Users
    SET
        FailedLoginAttempts = 0,
        LockoutUntilUtc = NULL
    WHERE UserId = @UserId
      AND (FailedLoginAttempts <> 0 OR LockoutUntilUtc IS NOT NULL);
END;
GO

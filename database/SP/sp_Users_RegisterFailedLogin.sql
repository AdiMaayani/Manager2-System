SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
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

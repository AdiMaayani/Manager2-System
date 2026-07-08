SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
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

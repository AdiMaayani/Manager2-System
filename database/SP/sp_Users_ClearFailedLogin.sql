SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
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

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* ---------------------------------------------------------
   3) Update dbo.sp_GetUserById
   --------------------------------------------------------- */
CREATE OR ALTER PROCEDURE [dbo].[sp_GetUserById]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        UserId,
        EmployeeId,
        Username,
        Email,
        PasswordHash,
        PasswordSalt,
        IsActive,
        LastLoginAt,
        CreatedAt,
        Phone,
        Notes
    FROM dbo.Users
    WHERE UserId = @UserId;
END;

GO

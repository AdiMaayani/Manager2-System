SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* ---------------------------------------------------------
   2) Update dbo.sp_GetUsers
   --------------------------------------------------------- */
CREATE OR ALTER PROCEDURE [dbo].[sp_GetUsers]
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
    ORDER BY UserId DESC;
END;

GO

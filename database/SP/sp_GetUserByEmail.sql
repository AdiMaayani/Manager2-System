SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[sp_GetUserByEmail]
    @Email NVARCHAR(255)
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
    WHERE Email = @Email;
END;

GO

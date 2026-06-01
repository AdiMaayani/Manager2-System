SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* ---------------------------------------------------------
   5) Update dbo.sp_UpdateUser
   --------------------------------------------------------- */
CREATE OR ALTER PROCEDURE [dbo].[sp_UpdateUser]
    @UserId INT,
    @EmployeeId INT,
    @Username NVARCHAR(100),
    @Email NVARCHAR(255),
    @PasswordHash NVARCHAR(MAX),
    @PasswordSalt NVARCHAR(MAX),
    @IsActive BIT,
    @Phone NVARCHAR(50) = NULL,
    @Notes NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Users
    SET
        EmployeeId = @EmployeeId,
        Username = @Username,
        Email = @Email,
        PasswordHash = @PasswordHash,
        PasswordSalt = @PasswordSalt,
        IsActive = @IsActive,
        Phone = @Phone,
        Notes = @Notes
    WHERE UserId = @UserId;

    SELECT @@ROWCOUNT AS RowsAffected;
END;

GO

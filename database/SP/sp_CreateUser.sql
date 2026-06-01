SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* ---------------------------------------------------------
   4) Update dbo.sp_CreateUser
   --------------------------------------------------------- */
CREATE OR ALTER PROCEDURE [dbo].[sp_CreateUser]
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

    INSERT INTO dbo.Users
    (
        EmployeeId,
        Username,
        Email,
        PasswordHash,
        PasswordSalt,
        IsActive,
        CreatedAt,
        Phone,
        Notes
    )
    VALUES
    (
        @EmployeeId,
        @Username,
        @Email,
        @PasswordHash,
        @PasswordSalt,
        @IsActive,
        SYSUTCDATETIME(),
        @Phone,
        @Notes
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS NewUserId;
END;

GO

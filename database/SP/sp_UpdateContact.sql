SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/*==============================================================*/
/* sp_UpdateContact                                             */
/*==============================================================*/
CREATE OR ALTER PROCEDURE [dbo].[sp_UpdateContact]
    @ContactId INT,
    @FullName NVARCHAR(200),
    @JobTitle NVARCHAR(150) = NULL,
    @ContactCategory NVARCHAR(50),
    @CustomerId INT = NULL,
    @CompanyName NVARCHAR(200) = NULL,
    @Phone NVARCHAR(50) = NULL,
    @SecondaryPhone NVARCHAR(50) = NULL,
    @Email NVARCHAR(255) = NULL,
    @PreferredChannel NVARCHAR(50) = NULL,
    @City NVARCHAR(100) = NULL,
    @Address NVARCHAR(255) = NULL,
    @Status NVARCHAR(50) = NULL,
    @Notes NVARCHAR(1000) = NULL,
    @IsActive BIT,
    @UpdatedByUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Contacts
    SET
        FullName = LTRIM(RTRIM(@FullName)),
        JobTitle = NULLIF(LTRIM(RTRIM(@JobTitle)), ''),
        ContactCategory = LTRIM(RTRIM(@ContactCategory)),
        CustomerId = @CustomerId,
        CompanyName = NULLIF(LTRIM(RTRIM(@CompanyName)), ''),
        Phone = NULLIF(LTRIM(RTRIM(@Phone)), ''),
        SecondaryPhone = NULLIF(LTRIM(RTRIM(@SecondaryPhone)), ''),
        Email = NULLIF(LTRIM(RTRIM(@Email)), ''),
        PreferredChannel = NULLIF(LTRIM(RTRIM(@PreferredChannel)), ''),
        City = NULLIF(LTRIM(RTRIM(@City)), ''),
        Address = NULLIF(LTRIM(RTRIM(@Address)), ''),
        Status = NULLIF(LTRIM(RTRIM(@Status)), ''),
        Notes = NULLIF(LTRIM(RTRIM(@Notes)), ''),
        IsActive = @IsActive,
        UpdatedAt = SYSUTCDATETIME(),
        UpdatedByUserId = @UpdatedByUserId
    WHERE ContactId = @ContactId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

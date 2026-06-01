SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/*==============================================================*/
/* sp_CreateContact                                             */
/*==============================================================*/
CREATE OR ALTER PROCEDURE [dbo].[sp_CreateContact]
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
    @CreatedByUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.Contacts
    (
        FullName,
        JobTitle,
        ContactCategory,
        CustomerId,
        CompanyName,
        Phone,
        SecondaryPhone,
        Email,
        PreferredChannel,
        City,
        Address,
        Status,
        Notes,
        IsActive,
        CreatedAt,
        CreatedByUserId,
        UpdatedAt,
        UpdatedByUserId
    )
    VALUES
    (
        LTRIM(RTRIM(@FullName)),
        NULLIF(LTRIM(RTRIM(@JobTitle)), ''),
        LTRIM(RTRIM(@ContactCategory)),
        @CustomerId,
        NULLIF(LTRIM(RTRIM(@CompanyName)), ''),
        NULLIF(LTRIM(RTRIM(@Phone)), ''),
        NULLIF(LTRIM(RTRIM(@SecondaryPhone)), ''),
        NULLIF(LTRIM(RTRIM(@Email)), ''),
        NULLIF(LTRIM(RTRIM(@PreferredChannel)), ''),
        NULLIF(LTRIM(RTRIM(@City)), ''),
        NULLIF(LTRIM(RTRIM(@Address)), ''),
        NULLIF(LTRIM(RTRIM(@Status)), ''),
        NULLIF(LTRIM(RTRIM(@Notes)), ''),
        @IsActive,
        SYSUTCDATETIME(),
        @CreatedByUserId,
        NULL,
        NULL
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS ContactId;
END
GO

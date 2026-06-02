SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_Settings_UpsertCompanySettings
    @CompanyName NVARCHAR(200),
    @LegalName NVARCHAR(200) = NULL,
    @RegistrationNumber NVARCHAR(50) = NULL,
    @Email NVARCHAR(254) = NULL,
    @Phone NVARCHAR(50) = NULL,
    @Address NVARCHAR(500) = NULL,
    @Website NVARCHAR(250) = NULL,
    @UpdatedByUserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.CompanySettings WHERE CompanySettingsId = 1)
    BEGIN
        UPDATE dbo.CompanySettings
        SET
            CompanyName = @CompanyName,
            LegalName = @LegalName,
            RegistrationNumber = @RegistrationNumber,
            Email = @Email,
            Phone = @Phone,
            Address = @Address,
            Website = @Website,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedByUserId = @UpdatedByUserId
        WHERE CompanySettingsId = 1;
    END
    ELSE
    BEGIN
        INSERT INTO dbo.CompanySettings
        (
            CompanySettingsId,
            CompanyName,
            LegalName,
            RegistrationNumber,
            Email,
            Phone,
            Address,
            Website,
            UpdatedAt,
            UpdatedByUserId
        )
        VALUES
        (
            1,
            @CompanyName,
            @LegalName,
            @RegistrationNumber,
            @Email,
            @Phone,
            @Address,
            @Website,
            SYSUTCDATETIME(),
            @UpdatedByUserId
        );
    END

    EXEC dbo.sp_Settings_GetCompanySettings;
END
GO

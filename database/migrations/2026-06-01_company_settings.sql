/*
    ManageR2 company settings migration.

    Run this script manually in SSMS against the intended target database.
    It adds a single-row company profile table and the stored procedures used
    by the Settings page. It does not store secrets, connection strings, or JWT keys.
*/

IF OBJECT_ID(N'dbo.CompanySettings', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CompanySettings
    (
        CompanySettingsId TINYINT NOT NULL
            CONSTRAINT PK_CompanySettings PRIMARY KEY
            CONSTRAINT CK_CompanySettings_SingleRow CHECK (CompanySettingsId = 1),
        CompanyName NVARCHAR(200) NOT NULL,
        LegalName NVARCHAR(200) NULL,
        RegistrationNumber NVARCHAR(50) NULL,
        Email NVARCHAR(254) NULL,
        Phone NVARCHAR(50) NULL,
        Address NVARCHAR(500) NULL,
        Website NVARCHAR(250) NULL,
        UpdatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_CompanySettings_UpdatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedByUserId INT NULL
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.CompanySettings WHERE CompanySettingsId = 1)
BEGIN
    INSERT INTO dbo.CompanySettings
    (
        CompanySettingsId,
        CompanyName,
        UpdatedAt
    )
    VALUES
    (
        1,
        N'ManageR²',
        SYSUTCDATETIME()
    );
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Settings_GetCompanySettings
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (1)
        CompanyName,
        LegalName,
        RegistrationNumber,
        Email,
        Phone,
        Address,
        Website,
        UpdatedAt
    FROM dbo.CompanySettings
    WHERE CompanySettingsId = 1;
END
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

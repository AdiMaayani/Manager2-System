SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
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

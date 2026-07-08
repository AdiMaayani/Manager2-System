SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_CustomerSystemSecrets_Create
    @CustomerSystemId     INT,
    @SecretType           NVARCHAR(50),
    @Username             NVARCHAR(255) = NULL,
    @EncryptedSecretValue NVARCHAR(MAX),
    @MaskedPreview        NVARCHAR(64) = NULL,
    @Notes                NVARCHAR(1000) = NULL,
    @IsActive             BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NormalizedSecretType NVARCHAR(50) = NULLIF(LTRIM(RTRIM(@SecretType)), N'');

    IF @NormalizedSecretType IS NULL
    BEGIN
        THROW 52110, 'SecretType is required.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@EncryptedSecretValue)), N'') IS NULL
    BEGIN
        THROW 52111, 'EncryptedSecretValue is required.', 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.CustomerSystems WHERE CustomerSystemId = @CustomerSystemId)
    BEGIN
        THROW 52112, 'The specified customer system does not exist.', 1;
    END;

    INSERT INTO dbo.CustomerSystemSecrets
    (
        CustomerSystemId, SecretType, Username, EncryptedSecretValue, MaskedPreview, Notes, IsActive, CreatedAtUtc
    )
    VALUES
    (
        @CustomerSystemId,
        @NormalizedSecretType,
        NULLIF(LTRIM(RTRIM(@Username)), N''),
        @EncryptedSecretValue,
        @MaskedPreview,
        NULLIF(LTRIM(RTRIM(@Notes)), N''),
        @IsActive,
        SYSUTCDATETIME()
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS SecretId;
END
GO

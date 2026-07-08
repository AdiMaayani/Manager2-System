SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- Update metadata, and the encrypted value only when a new one is supplied (@EncryptedSecretValue NULL
-- keeps the existing value, so editing metadata never requires re-sending the secret).
CREATE OR ALTER PROCEDURE dbo.sp_CustomerSystemSecrets_Update
    @SecretId             INT,
    @SecretType           NVARCHAR(50),
    @Username             NVARCHAR(255) = NULL,
    @EncryptedSecretValue NVARCHAR(MAX) = NULL,
    @MaskedPreview        NVARCHAR(64) = NULL,
    @Notes                NVARCHAR(1000) = NULL,
    @IsActive             BIT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NormalizedSecretType NVARCHAR(50) = NULLIF(LTRIM(RTRIM(@SecretType)), N'');

    IF @NormalizedSecretType IS NULL
    BEGIN
        THROW 52110, 'SecretType is required.', 1;
    END;

    UPDATE dbo.CustomerSystemSecrets
    SET
        SecretType = @NormalizedSecretType,
        Username = NULLIF(LTRIM(RTRIM(@Username)), N''),
        EncryptedSecretValue = CASE
            WHEN NULLIF(LTRIM(RTRIM(@EncryptedSecretValue)), N'') IS NULL THEN EncryptedSecretValue
            ELSE @EncryptedSecretValue
        END,
        MaskedPreview = CASE
            WHEN NULLIF(LTRIM(RTRIM(@EncryptedSecretValue)), N'') IS NULL THEN MaskedPreview
            ELSE @MaskedPreview
        END,
        Notes = NULLIF(LTRIM(RTRIM(@Notes)), N''),
        IsActive = @IsActive,
        UpdatedAtUtc = SYSUTCDATETIME()
    WHERE SecretId = @SecretId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

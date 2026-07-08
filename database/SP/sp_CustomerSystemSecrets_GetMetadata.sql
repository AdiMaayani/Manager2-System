SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- Metadata only. NEVER returns EncryptedSecretValue or any plaintext.
CREATE OR ALTER PROCEDURE dbo.sp_CustomerSystemSecrets_GetMetadata
    @CustomerSystemId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        SecretId,
        CustomerSystemId,
        SecretType,
        Username,
        MaskedPreview,
        Notes,
        IsActive,
        CreatedAtUtc,
        UpdatedAtUtc
    FROM dbo.CustomerSystemSecrets
    WHERE CustomerSystemId = @CustomerSystemId
    ORDER BY IsActive DESC, SecretId ASC;
END
GO

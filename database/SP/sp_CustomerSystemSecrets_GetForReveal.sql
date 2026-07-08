SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- Reveal read path: returns the encrypted blob for the API to decrypt. Used ONLY by the explicit,
-- permission-gated and audited reveal endpoint, never by list/detail endpoints.
CREATE OR ALTER PROCEDURE dbo.sp_CustomerSystemSecrets_GetForReveal
    @CustomerSystemId INT,
    @SecretId         INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        SecretId,
        CustomerSystemId,
        SecretType,
        Username,
        EncryptedSecretValue,
        IsActive
    FROM dbo.CustomerSystemSecrets
    WHERE SecretId = @SecretId
      AND CustomerSystemId = @CustomerSystemId;
END
GO

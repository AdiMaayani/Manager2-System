SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_CustomerSystemSecrets_Deactivate
    @SecretId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.CustomerSystemSecrets
    SET IsActive = 0,
        UpdatedAtUtc = SYSUTCDATETIME()
    WHERE SecretId = @SecretId
      AND IsActive = 1;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_CustomerSystems_Deactivate
    @CustomerSystemId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.CustomerSystems
    SET IsActive = 0,
        UpdatedAtUtc = SYSUTCDATETIME()
    WHERE CustomerSystemId = @CustomerSystemId
      AND IsActive = 1;

    -- Cascade-deactivate the system's secrets so they can no longer be revealed.
    UPDATE dbo.CustomerSystemSecrets
    SET IsActive = 0,
        UpdatedAtUtc = SYSUTCDATETIME()
    WHERE CustomerSystemId = @CustomerSystemId
      AND IsActive = 1;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

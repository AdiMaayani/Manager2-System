SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_Quotes_Deactivate
    @QuoteId INT,
    @UpdatedByUserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Quotes
    SET
        IsActive = 0,
        UpdatedAt = SYSUTCDATETIME(),
        UpdatedByUserId = @UpdatedByUserId,
        DeletedAt = SYSUTCDATETIME()
    WHERE QuoteId = @QuoteId
      AND IsActive = 1;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

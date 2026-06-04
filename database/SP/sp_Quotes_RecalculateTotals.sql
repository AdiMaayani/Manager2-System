SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_Quotes_RecalculateTotals
    @QuoteId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Subtotal DECIMAL(18,2);
    DECLARE @VatRate DECIMAL(5,2);

    SELECT @VatRate = VatRate
    FROM dbo.Quotes
    WHERE QuoteId = @QuoteId;

    IF @VatRate IS NULL
    BEGIN
        THROW 51304, 'Quote was not found.', 1;
    END;

    SELECT @Subtotal = ISNULL(SUM(LineTotal), 0)
    FROM dbo.QuoteLineItems
    WHERE QuoteId = @QuoteId;

    DECLARE @VatAmount DECIMAL(18,2) = ROUND(@Subtotal * @VatRate / 100.0, 2);

    UPDATE dbo.Quotes
    SET
        Subtotal = @Subtotal,
        VatAmount = @VatAmount,
        Total = @Subtotal + @VatAmount,
        UpdatedAt = SYSUTCDATETIME()
    WHERE QuoteId = @QuoteId;

    SELECT
        @Subtotal AS Subtotal,
        @VatAmount AS VatAmount,
        @Subtotal + @VatAmount AS Total;
END
GO

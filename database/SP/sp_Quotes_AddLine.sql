SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_Quotes_AddLine
    @QuoteId INT,
    @Description NVARCHAR(500),
    @Quantity DECIMAL(18,2),
    @Unit NVARCHAR(50),
    @UnitPrice DECIMAL(18,2),
    @SortOrder INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Quotes WHERE QuoteId = @QuoteId)
    BEGIN
        THROW 51304, 'Quote was not found.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@Description)), N'') IS NULL
    BEGIN
        THROW 51305, 'Line description is required.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@Unit)), N'') IS NULL
    BEGIN
        THROW 51306, 'Line unit is required.', 1;
    END;

    IF @Quantity < 0
    BEGIN
        THROW 51307, 'Line quantity cannot be negative.', 1;
    END;

    IF @UnitPrice < 0
    BEGIN
        THROW 51308, 'Line unit price cannot be negative.', 1;
    END;

    IF @SortOrder IS NULL
    BEGIN
        SELECT @SortOrder = ISNULL(MAX(SortOrder), 0) + 1
        FROM dbo.QuoteLineItems
        WHERE QuoteId = @QuoteId;
    END;

    INSERT INTO dbo.QuoteLineItems
    (
        QuoteId,
        Description,
        Quantity,
        Unit,
        UnitPrice,
        LineTotal,
        SortOrder,
        CreatedAt
    )
    VALUES
    (
        @QuoteId,
        LTRIM(RTRIM(@Description)),
        @Quantity,
        LTRIM(RTRIM(@Unit)),
        @UnitPrice,
        ROUND(@Quantity * @UnitPrice, 2),
        @SortOrder,
        SYSUTCDATETIME()
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS QuoteLineItemId;
END
GO

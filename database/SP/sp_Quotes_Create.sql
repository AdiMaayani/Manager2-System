SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_Quotes_Create
    @CustomerId INT,
    @ProjectId INT = NULL,
    @QuoteDate DATE,
    @ValidUntil DATE = NULL,
    @Status NVARCHAR(50) = N'Draft',
    @Notes NVARCHAR(1000) = NULL,
    @VatRate DECIMAL(5,2) = 17.00,
    @CreatedByUserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NormalizedStatus NVARCHAR(50) =
        ISNULL(NULLIF(LTRIM(RTRIM(@Status)), N''), N'Draft');

    IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerId = @CustomerId)
    BEGIN
        THROW 51300, 'Customer was not found.', 1;
    END;

    IF @ProjectId IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM dbo.WorkItems WHERE WorkItemId = @ProjectId AND WorkType = 'Project'
    )
    BEGIN
        THROW 51301, 'Project was not found.', 1;
    END;

    IF @NormalizedStatus NOT IN (N'Draft', N'Sent', N'Tracking', N'Approved', N'Rejected')
    BEGIN
        THROW 51302, 'Status is invalid.', 1;
    END;

    IF @VatRate IS NULL OR @VatRate < 0
    BEGIN
        THROW 51303, 'VatRate cannot be negative.', 1;
    END;

    DECLARE @Year INT = YEAR(SYSUTCDATETIME());
    DECLARE @Prefix NVARCHAR(20) = N'Q-' + CAST(@Year AS NVARCHAR(4)) + N'-';
    DECLARE @NextSequence INT;

    SELECT @NextSequence = ISNULL(MAX(CAST(RIGHT(QuoteNumber, 4) AS INT)), 0) + 1
    FROM dbo.Quotes
    WHERE QuoteNumber LIKE @Prefix + N'[0-9][0-9][0-9][0-9]';

    DECLARE @QuoteNumber NVARCHAR(50) =
        @Prefix + RIGHT(N'0000' + CAST(@NextSequence AS NVARCHAR(10)), 4);

    INSERT INTO dbo.Quotes
    (
        QuoteNumber,
        CustomerId,
        ProjectId,
        QuoteDate,
        ValidUntil,
        Status,
        Notes,
        VatRate,
        Subtotal,
        VatAmount,
        Total,
        IsActive,
        CreatedAt,
        CreatedByUserId
    )
    VALUES
    (
        @QuoteNumber,
        @CustomerId,
        @ProjectId,
        @QuoteDate,
        @ValidUntil,
        @NormalizedStatus,
        NULLIF(LTRIM(RTRIM(@Notes)), N''),
        @VatRate,
        0,
        0,
        0,
        1,
        SYSUTCDATETIME(),
        @CreatedByUserId
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS QuoteId;
END
GO

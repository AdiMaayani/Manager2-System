SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_Quotes_UpdateHeader
    @QuoteId INT,
    @CustomerId INT,
    @ProjectId INT = NULL,
    @QuoteDate DATE,
    @ValidUntil DATE = NULL,
    @Status NVARCHAR(50),
    @Notes NVARCHAR(1000) = NULL,
    @VatRate DECIMAL(5,2),
    @UpdatedByUserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NormalizedStatus NVARCHAR(50) =
        ISNULL(NULLIF(LTRIM(RTRIM(@Status)), N''), N'Draft');

    IF NOT EXISTS (SELECT 1 FROM dbo.Quotes WHERE QuoteId = @QuoteId AND IsActive = 1)
    BEGIN
        THROW 51304, 'Quote was not found.', 1;
    END;

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

    UPDATE dbo.Quotes
    SET
        CustomerId = @CustomerId,
        ProjectId = @ProjectId,
        QuoteDate = @QuoteDate,
        ValidUntil = @ValidUntil,
        Status = @NormalizedStatus,
        Notes = NULLIF(LTRIM(RTRIM(@Notes)), N''),
        VatRate = @VatRate,
        UpdatedAt = SYSUTCDATETIME(),
        UpdatedByUserId = @UpdatedByUserId
    WHERE QuoteId = @QuoteId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_Quotes_GetList
    @Search NVARCHAR(200) = NULL,
    @CustomerId INT = NULL,
    @ProjectId INT = NULL,
    @Status NVARCHAR(50) = NULL,
    @FromDate DATE = NULL,
    @ToDate DATE = NULL,
    @IncludeInactive BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NormalizedSearch NVARCHAR(200) = NULLIF(LTRIM(RTRIM(@Search)), N'');
    DECLARE @NormalizedStatus NVARCHAR(50) = NULLIF(LTRIM(RTRIM(@Status)), N'');

    SELECT
        q.QuoteId,
        q.QuoteNumber,
        q.CustomerId,
        c.CustomerName,
        q.ProjectId,
        p.Title AS ProjectTitle,
        q.QuoteDate,
        q.ValidUntil,
        q.Status,
        q.Notes,
        q.VatRate,
        q.Subtotal,
        q.VatAmount,
        q.Total,
        q.IsActive,
        q.CreatedAt,
        q.UpdatedAt
    FROM dbo.Quotes q
    INNER JOIN dbo.Customers c ON q.CustomerId = c.CustomerId
    LEFT JOIN dbo.WorkItems p ON q.ProjectId = p.WorkItemId
    WHERE (@IncludeInactive = 1 OR q.IsActive = 1)
      AND (@CustomerId IS NULL OR q.CustomerId = @CustomerId)
      AND (@ProjectId IS NULL OR q.ProjectId = @ProjectId)
      AND (@NormalizedStatus IS NULL OR q.Status = @NormalizedStatus)
      AND (@FromDate IS NULL OR q.QuoteDate >= @FromDate)
      AND (@ToDate IS NULL OR q.QuoteDate <= @ToDate)
      AND (
            @NormalizedSearch IS NULL
            OR q.QuoteNumber LIKE N'%' + @NormalizedSearch + N'%'
            OR c.CustomerName LIKE N'%' + @NormalizedSearch + N'%'
            OR ISNULL(p.Title, N'') LIKE N'%' + @NormalizedSearch + N'%'
            OR ISNULL(q.Notes, N'') LIKE N'%' + @NormalizedSearch + N'%'
          )
    ORDER BY q.QuoteDate DESC, q.QuoteId DESC;
END
GO

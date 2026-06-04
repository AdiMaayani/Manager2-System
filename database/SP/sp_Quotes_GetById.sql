SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_Quotes_GetById
    @QuoteId INT
AS
BEGIN
    SET NOCOUNT ON;

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
    WHERE q.QuoteId = @QuoteId;

    SELECT
        li.QuoteLineItemId,
        li.QuoteId,
        li.Description,
        li.Quantity,
        li.Unit,
        li.UnitPrice,
        li.LineTotal,
        li.SortOrder
    FROM dbo.QuoteLineItems li
    WHERE li.QuoteId = @QuoteId
    ORDER BY li.SortOrder ASC, li.QuoteLineItemId ASC;
END
GO

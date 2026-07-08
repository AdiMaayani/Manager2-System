SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_Dashboard_GetQuotesNeedingFollowUp
    @StaleDays INT = 7
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Days INT = CASE WHEN @StaleDays IS NULL OR @StaleDays < 0 THEN 7 ELSE @StaleDays END;
    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

    SELECT TOP (50)
        q.QuoteId,
        q.QuoteNumber,
        q.CustomerId,
        c.CustomerName,
        q.ProjectId,
        p.Title AS ProjectTitle,
        q.Status,
        q.QuoteDate,
        q.ValidUntil,
        q.UpdatedAt,
        q.Total,
        DATEDIFF(DAY, COALESCE(CAST(q.UpdatedAt AS DATE), q.QuoteDate), @Today) AS DaysSinceActivity,
        CAST(CASE WHEN q.ValidUntil IS NOT NULL AND q.ValidUntil < @Today THEN 1 ELSE 0 END AS BIT) AS IsExpired
    FROM dbo.Quotes AS q
    LEFT JOIN dbo.Customers AS c ON c.CustomerId = q.CustomerId
    LEFT JOIN dbo.WorkItems AS p ON p.WorkItemId = q.ProjectId
    WHERE q.IsActive = 1
      AND q.Status IN (N'Sent', N'Tracking')
      AND DATEDIFF(DAY, COALESCE(CAST(q.UpdatedAt AS DATE), q.QuoteDate), @Today) >= @Days
    ORDER BY DaysSinceActivity DESC, q.QuoteDate ASC;
END
GO

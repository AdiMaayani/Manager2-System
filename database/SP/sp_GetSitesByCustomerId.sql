SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetSitesByCustomerId
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        SiteId,
        CustomerId,
        SiteName,
        AddressLine,
        City,
        IsPrimary,
        Notes,
        CreatedAt,
        UpdatedAt
    FROM dbo.Sites
    WHERE CustomerId = @CustomerId
      AND IsActive = 1
    ORDER BY IsPrimary DESC, SiteName, SiteId;
END
GO

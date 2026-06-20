SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[sp_GetSites]
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
    WHERE IsActive = 1
    ORDER BY SiteId DESC;
END
GO

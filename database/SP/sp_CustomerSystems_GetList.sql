SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_CustomerSystems_GetList
    @CustomerId      INT,
    @IncludeInactive BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        cs.CustomerSystemId,
        cs.CustomerId,
        cs.SiteId,
        s.SiteName,
        cs.SystemType,
        cs.SystemName,
        cs.Vendor,
        cs.Model,
        cs.Host,
        cs.Port,
        cs.Url,
        cs.LocationDescription,
        cs.Notes,
        cs.IsActive,
        cs.CreatedAtUtc,
        cs.UpdatedAtUtc
    FROM dbo.CustomerSystems AS cs
    LEFT JOIN dbo.Sites AS s ON s.SiteId = cs.SiteId
    WHERE cs.CustomerId = @CustomerId
      AND (@IncludeInactive = 1 OR cs.IsActive = 1)
    ORDER BY cs.IsActive DESC, cs.SystemName ASC, cs.CustomerSystemId ASC;
END
GO

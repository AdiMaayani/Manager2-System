SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[Rec_GetSiteAddressProfile]
    @SiteId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        p.SiteId,
        s.SiteName,
        p.InputAddress,
        p.FormattedAddress,
        p.ValidationProvider,
        p.ValidationStatus,
        p.ValidationVerdict,
        p.ValidationScore,
        p.ExternalPlaceRef,
        p.City,
        p.Country,
        p.ZoneId,
        wz.ZoneName
    FROM dbo.Rec_SiteAddressProfile p
    INNER JOIN dbo.Sites s
        ON s.SiteId = p.SiteId
    LEFT JOIN dbo.Rec_WorkZones wz
        ON wz.ZoneId = p.ZoneId
    WHERE p.SiteId = @SiteId;
END
GO

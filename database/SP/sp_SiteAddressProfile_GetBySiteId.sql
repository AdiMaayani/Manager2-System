SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_SiteAddressProfile_GetBySiteId
    @SiteId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        p.SiteAddressProfileId,
        p.SiteId,
        p.InputAddress,
        p.FormattedAddress,
        p.ValidationProvider,
        p.ValidationStatus,
        p.ValidationVerdict,
        p.ValidationScore,
        p.ExternalPlaceRef,
        p.Street,
        p.HouseNumber,
        p.City,
        p.Postcode,
        p.StateOrRegion,
        p.Country,
        p.ZoneId,
        p.Latitude,
        p.Longitude,
        p.ValidatedAt,
        p.CreatedAt,
        p.UpdatedAt
    FROM dbo.Rec_SiteAddressProfile p
    WHERE p.SiteId = @SiteId;
END
GO

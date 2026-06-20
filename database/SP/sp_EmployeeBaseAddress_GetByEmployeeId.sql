SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_EmployeeBaseAddress_GetByEmployeeId
    @EmployeeId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        b.EmployeeBaseAddressId,
        b.EmployeeId,
        b.InputAddress,
        b.FormattedAddress,
        b.ValidationProvider,
        b.ValidationStatus,
        b.ValidationVerdict,
        b.ValidationScore,
        b.ExternalPlaceRef,
        b.Street,
        b.HouseNumber,
        b.City,
        b.Postcode,
        b.StateOrRegion,
        b.Country,
        b.ZoneId,
        b.Latitude,
        b.Longitude,
        b.ValidatedAt,
        b.CreatedAt,
        b.UpdatedAt
    FROM dbo.Rec_EmployeeBaseAddress b
    WHERE b.EmployeeId = @EmployeeId;
END
GO

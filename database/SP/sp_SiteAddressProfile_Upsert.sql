SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_SiteAddressProfile_Upsert
    @SiteId INT,
    @InputAddress NVARCHAR(300) = NULL,
    @FormattedAddress NVARCHAR(300) = NULL,
    @ValidationProvider NVARCHAR(50) = NULL,
    @ValidationStatus NVARCHAR(30) = NULL,
    @ValidationVerdict NVARCHAR(50) = NULL,
    @ValidationScore DECIMAL(5, 2) = NULL,
    @ExternalPlaceRef NVARCHAR(200) = NULL,
    @Street NVARCHAR(200) = NULL,
    @HouseNumber NVARCHAR(50) = NULL,
    @City NVARCHAR(100) = NULL,
    @Postcode NVARCHAR(30) = NULL,
    @StateOrRegion NVARCHAR(100) = NULL,
    @Country NVARCHAR(100) = NULL,
    @ZoneId INT = NULL,
    @Latitude DECIMAL(9, 6) = NULL,
    @Longitude DECIMAL(9, 6) = NULL,
    @ValidatedAt DATETIME2(0) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Sites WHERE SiteId = @SiteId)
    BEGIN
        THROW 50404, N'Site not found.', 1;
    END

    BEGIN TRAN;

    UPDATE dbo.Rec_SiteAddressProfile
    SET
        InputAddress = @InputAddress,
        FormattedAddress = @FormattedAddress,
        ValidationProvider = @ValidationProvider,
        ValidationStatus = @ValidationStatus,
        ValidationVerdict = @ValidationVerdict,
        ValidationScore = @ValidationScore,
        ExternalPlaceRef = @ExternalPlaceRef,
        Street = @Street,
        HouseNumber = @HouseNumber,
        City = @City,
        Postcode = @Postcode,
        StateOrRegion = @StateOrRegion,
        Country = @Country,
        ZoneId = @ZoneId,
        Latitude = @Latitude,
        Longitude = @Longitude,
        ValidatedAt = @ValidatedAt,
        UpdatedAt = sysutcdatetime()
    WHERE SiteId = @SiteId;

    IF @@ROWCOUNT = 0
    BEGIN
        INSERT INTO dbo.Rec_SiteAddressProfile
        (
            SiteId,
            InputAddress,
            FormattedAddress,
            ValidationProvider,
            ValidationStatus,
            ValidationVerdict,
            ValidationScore,
            ExternalPlaceRef,
            Street,
            HouseNumber,
            City,
            Postcode,
            StateOrRegion,
            Country,
            ZoneId,
            Latitude,
            Longitude,
            ValidatedAt,
            CreatedAt
        )
        VALUES
        (
            @SiteId,
            @InputAddress,
            @FormattedAddress,
            @ValidationProvider,
            @ValidationStatus,
            @ValidationVerdict,
            @ValidationScore,
            @ExternalPlaceRef,
            @Street,
            @HouseNumber,
            @City,
            @Postcode,
            @StateOrRegion,
            @Country,
            @ZoneId,
            @Latitude,
            @Longitude,
            @ValidatedAt,
            sysutcdatetime()
        );
    END

    COMMIT TRAN;

    EXEC dbo.sp_SiteAddressProfile_GetBySiteId @SiteId = @SiteId;
END
GO

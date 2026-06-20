/*
    Administrative / reusable path only — NOT used by the Phase A composite Site save.

    Use sp_Site_SaveWithAddressProfile for production Site create/update with optional profile.
    This procedure remains for manual maintenance, tooling, or future direct profile writes.
*/
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

    IF NOT EXISTS (SELECT 1 FROM dbo.Sites WHERE SiteId = @SiteId AND IsActive = 1)
    BEGIN
        RAISERROR(N'Site not found.', 16, 1);
        RETURN;
    END

    BEGIN TRY
        BEGIN TRAN;

        IF NOT EXISTS (
            SELECT 1
            FROM dbo.Rec_SiteAddressProfile WITH (UPDLOCK, HOLDLOCK)
            WHERE SiteId = @SiteId
        )
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
        ELSE
        BEGIN
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
        END

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
            ROLLBACK TRAN;

        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
        RETURN;
    END CATCH

    EXEC dbo.sp_SiteAddressProfile_GetBySiteId @SiteId = @SiteId;
END
GO

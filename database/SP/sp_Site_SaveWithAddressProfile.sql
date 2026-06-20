/*
    Production path: atomic Site operational save with optional address profile.

    @HasAddressProfile = 0: update Site operational fields only; leave profile untouched;
    do not compare identity; do not invalidate routes.

    Route invalidation uses sp_RouteEstimates_InvalidateByTargetSiteId inside the transaction.
*/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_Site_SaveWithAddressProfile
    @SiteId INT = NULL,
    @CustomerId INT,
    @SiteName NVARCHAR(100),
    @AddressLine NVARCHAR(200) = NULL,
    @City NVARCHAR(50) = NULL,
    @IsPrimary BIT,
    @Notes NVARCHAR(500) = NULL,
    @HasAddressProfile BIT = 0,
    @InputAddress NVARCHAR(300) = NULL,
    @FormattedAddress NVARCHAR(300) = NULL,
    @ValidationProvider NVARCHAR(50) = NULL,
    @ValidationStatus NVARCHAR(30) = NULL,
    @ValidationVerdict NVARCHAR(50) = NULL,
    @ValidationScore DECIMAL(5, 2) = NULL,
    @ExternalPlaceRef NVARCHAR(200) = NULL,
    @Street NVARCHAR(200) = NULL,
    @HouseNumber NVARCHAR(50) = NULL,
    @ProfileCity NVARCHAR(100) = NULL,
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

    DECLARE @ResolvedSiteId INT = @SiteId;
    DECLARE @ExistingCustomerId INT;
    DECLARE @OldPlaceRef NVARCHAR(200);
    DECLARE @OldLatitude DECIMAL(9, 6);
    DECLARE @OldLongitude DECIMAL(9, 6);
    DECLARE @OldFormatted NVARCHAR(300);
    DECLARE @OldValidationStatus NVARCHAR(30);
    DECLARE @ShouldInvalidate BIT = 0;

    BEGIN TRY
        BEGIN TRAN;

        IF @ResolvedSiteId IS NULL OR @ResolvedSiteId <= 0
        BEGIN
            INSERT INTO dbo.Sites
            (
                CustomerId,
                SiteName,
                AddressLine,
                City,
                IsPrimary,
                Notes,
                CreatedAt
            )
            VALUES
            (
                @CustomerId,
                @SiteName,
                @AddressLine,
                @City,
                @IsPrimary,
                @Notes,
                SYSDATETIME()
            );

            SET @ResolvedSiteId = CAST(SCOPE_IDENTITY() AS INT);
        END
        ELSE
        BEGIN
            SELECT @ExistingCustomerId = CustomerId
            FROM dbo.Sites WITH (UPDLOCK, HOLDLOCK)
            WHERE SiteId = @ResolvedSiteId
              AND IsActive = 1;

            IF @ExistingCustomerId IS NULL
            BEGIN
                RAISERROR(N'Site not found.', 16, 1);
                ROLLBACK TRAN;
                RETURN;
            END

            IF @ExistingCustomerId <> @CustomerId
            BEGIN
                RAISERROR(N'Site customer mismatch. Reassigning a Site to another Customer is not allowed.', 16, 1);
                ROLLBACK TRAN;
                RETURN;
            END

            IF @HasAddressProfile = 1
            BEGIN
                SELECT
                    @OldPlaceRef = ExternalPlaceRef,
                    @OldLatitude = Latitude,
                    @OldLongitude = Longitude,
                    @OldFormatted = FormattedAddress,
                    @OldValidationStatus = ValidationStatus
                FROM dbo.Rec_SiteAddressProfile WITH (UPDLOCK, HOLDLOCK)
                WHERE SiteId = @ResolvedSiteId;
            END

            UPDATE dbo.Sites
            SET
                SiteName = @SiteName,
                AddressLine = @AddressLine,
                City = @City,
                IsPrimary = @IsPrimary,
                Notes = @Notes,
                UpdatedAt = SYSUTCDATETIME()
            WHERE SiteId = @ResolvedSiteId
              AND IsActive = 1;
        END

        IF @HasAddressProfile = 1
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
                City = @ProfileCity,
                Postcode = @Postcode,
                StateOrRegion = @StateOrRegion,
                Country = @Country,
                ZoneId = @ZoneId,
                Latitude = @Latitude,
                Longitude = @Longitude,
                ValidatedAt = @ValidatedAt,
                UpdatedAt = sysutcdatetime()
            WHERE SiteId = @ResolvedSiteId;

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
                    @ResolvedSiteId,
                    @InputAddress,
                    @FormattedAddress,
                    @ValidationProvider,
                    @ValidationStatus,
                    @ValidationVerdict,
                    @ValidationScore,
                    @ExternalPlaceRef,
                    @Street,
                    @HouseNumber,
                    @ProfileCity,
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

            IF @ValidationStatus = N'Validated'
               AND @OldValidationStatus = N'Validated'
            BEGIN
                IF @OldPlaceRef IS NOT NULL
                   AND @ExternalPlaceRef IS NOT NULL
                   AND @OldPlaceRef <> @ExternalPlaceRef
                    SET @ShouldInvalidate = 1;
                ELSE IF @OldLatitude IS NOT NULL AND @OldLongitude IS NOT NULL
                     AND @Latitude IS NOT NULL AND @Longitude IS NOT NULL
                     AND (ROUND(@OldLatitude, 6) <> ROUND(@Latitude, 6)
                          OR ROUND(@OldLongitude, 6) <> ROUND(@Longitude, 6))
                    SET @ShouldInvalidate = 1;
                ELSE IF LOWER(LTRIM(RTRIM(ISNULL(@OldFormatted, N'')))) <> LOWER(LTRIM(RTRIM(ISNULL(@FormattedAddress, N''))))
                    SET @ShouldInvalidate = 1;
            END

            IF @ShouldInvalidate = 1
            BEGIN
                EXEC dbo.sp_RouteEstimates_InvalidateByTargetSiteId @TargetSiteId = @ResolvedSiteId;
            END
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

    SELECT
        s.SiteId,
        s.CustomerId,
        s.SiteName,
        s.AddressLine,
        s.City,
        s.IsPrimary,
        s.Notes,
        s.CreatedAt,
        s.UpdatedAt,
        p.SiteAddressProfileId,
        p.InputAddress,
        p.FormattedAddress,
        p.ValidationProvider,
        p.ValidationStatus,
        p.ValidationVerdict,
        p.ValidationScore,
        p.ExternalPlaceRef,
        p.Street,
        p.HouseNumber,
        p.City AS ProfileCity,
        p.Postcode,
        p.StateOrRegion,
        p.Country,
        p.ZoneId,
        p.Latitude,
        p.Longitude,
        p.ValidatedAt,
        p.CreatedAt AS ProfileCreatedAt,
        p.UpdatedAt AS ProfileUpdatedAt
    FROM dbo.Sites s
    LEFT JOIN dbo.Rec_SiteAddressProfile p ON p.SiteId = s.SiteId
    WHERE s.SiteId = @ResolvedSiteId;
END
GO

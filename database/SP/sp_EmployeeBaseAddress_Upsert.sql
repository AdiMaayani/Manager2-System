/*
    Production path: atomic employee base-address upsert with validated route invalidation.

    Route invalidation runs in the same transaction as profile persistence.
    sp_RouteEstimates_InvalidateByEmployeeId remains available for administrative use.
*/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_EmployeeBaseAddress_Upsert
    @EmployeeId INT,
    @InputAddress NVARCHAR(300),
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

    DECLARE @OldPlaceRef NVARCHAR(200);
    DECLARE @OldLatitude DECIMAL(9, 6);
    DECLARE @OldLongitude DECIMAL(9, 6);
    DECLARE @OldFormatted NVARCHAR(300);
    DECLARE @OldValidationStatus NVARCHAR(30);
    DECLARE @ShouldInvalidate BIT = 0;

    IF NOT EXISTS (SELECT 1 FROM dbo.Employees WHERE EmployeeId = @EmployeeId)
    BEGIN
        RAISERROR(N'Employee not found.', 16, 1);
        RETURN;
    END

    BEGIN TRY
        BEGIN TRAN;

        SELECT
            @OldPlaceRef = ExternalPlaceRef,
            @OldLatitude = Latitude,
            @OldLongitude = Longitude,
            @OldFormatted = FormattedAddress,
            @OldValidationStatus = ValidationStatus
        FROM dbo.Rec_EmployeeBaseAddress WITH (UPDLOCK, HOLDLOCK)
        WHERE EmployeeId = @EmployeeId;

        UPDATE dbo.Rec_EmployeeBaseAddress
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
        WHERE EmployeeId = @EmployeeId;

        IF @@ROWCOUNT = 0
        BEGIN
            INSERT INTO dbo.Rec_EmployeeBaseAddress
            (
                EmployeeId,
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
                @EmployeeId,
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
            EXEC dbo.sp_RouteEstimates_InvalidateByEmployeeId @EmployeeId = @EmployeeId;
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

    EXEC dbo.sp_EmployeeBaseAddress_GetByEmployeeId @EmployeeId = @EmployeeId;
END
GO

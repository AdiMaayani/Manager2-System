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

    IF NOT EXISTS (SELECT 1 FROM dbo.Employees WHERE EmployeeId = @EmployeeId)
    BEGIN
        THROW 50404, N'Employee not found.', 1;
    END

    BEGIN TRAN;

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

    COMMIT TRAN;

    EXEC dbo.sp_EmployeeBaseAddress_GetByEmployeeId @EmployeeId = @EmployeeId;
END
GO

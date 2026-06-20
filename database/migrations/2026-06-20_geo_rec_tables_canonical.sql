/*
    Phase 0 — Geo geographic tables canonical schema gate.

    Run manually in SSMS against the target database.
    DO NOT execute from the application.

    Creates Rec_EmployeeBaseAddress, Rec_SiteAddressProfile, and Rec_RouteEstimates
    only when each table is missing. Never drops or recreates existing tables.
    Throws if an existing table has an incompatible shape.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

-- ---------------------------------------------------------------------------
-- Compatibility helpers
-- ---------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.__GeoAssertColumn', N'P') IS NOT NULL
    DROP PROCEDURE dbo.__GeoAssertColumn;
GO

CREATE PROCEDURE dbo.__GeoAssertColumn
    @TableName SYSNAME,
    @ColumnName SYSNAME,
    @TypeName SYSNAME,
    @Precision TINYINT = NULL,
    @Scale TINYINT = NULL,
    @IsNullable BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    IF OBJECT_ID(N'dbo.' + QUOTENAME(@TableName), N'U') IS NULL
        RETURN;

    IF COL_LENGTH(N'dbo.' + @TableName, @ColumnName) IS NULL
    BEGIN
        DECLARE @Missing NVARCHAR(400) = N'Incompatible schema: dbo.' + @TableName + N' is missing column ' + @ColumnName + N'.';
        THROW 50001, @Missing, 1;
    END

    DECLARE @ActualType NVARCHAR(128);
    DECLARE @ActualPrecision TINYINT;
    DECLARE @ActualScale TINYINT;
    DECLARE @ActualNullable BIT;

    SELECT
        @ActualType = ty.name,
        @ActualPrecision = c.precision,
        @ActualScale = c.scale,
        @ActualNullable = c.is_nullable
    FROM sys.columns c
    INNER JOIN sys.types ty ON c.user_type_id = ty.user_type_id
    WHERE c.object_id = OBJECT_ID(N'dbo.' + @TableName)
      AND c.name = @ColumnName;

    IF @ActualType <> @TypeName
       OR (@Precision IS NOT NULL AND @ActualPrecision <> @Precision)
       OR (@Scale IS NOT NULL AND @ActualScale <> @Scale)
       OR @ActualNullable <> @IsNullable
    BEGIN
        DECLARE @Mismatch NVARCHAR(400) = N'Incompatible schema: dbo.' + @TableName + N'.' + @ColumnName + N' shape mismatch.';
        THROW 50002, @Mismatch, 1;
    END
END
GO

-- ---------------------------------------------------------------------------
-- Rec_EmployeeBaseAddress
-- ---------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.Rec_EmployeeBaseAddress', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Rec_EmployeeBaseAddress
    (
        EmployeeBaseAddressId INT IDENTITY(1,1) NOT NULL,
        EmployeeId INT NOT NULL,
        InputAddress NVARCHAR(300) NOT NULL,
        FormattedAddress NVARCHAR(300) NULL,
        ValidationProvider NVARCHAR(50) NULL,
        ValidationStatus NVARCHAR(30) NULL,
        ValidationVerdict NVARCHAR(50) NULL,
        ValidationScore DECIMAL(5, 2) NULL,
        ExternalPlaceRef NVARCHAR(200) NULL,
        Street NVARCHAR(200) NULL,
        HouseNumber NVARCHAR(50) NULL,
        City NVARCHAR(100) NULL,
        Postcode NVARCHAR(30) NULL,
        StateOrRegion NVARCHAR(100) NULL,
        Country NVARCHAR(100) NULL,
        ZoneId INT NULL,
        Latitude DECIMAL(9, 6) NULL,
        Longitude DECIMAL(9, 6) NULL,
        ValidatedAt DATETIME2(0) NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Rec_EmployeeBaseAddress_CreatedAt DEFAULT (sysutcdatetime()),
        UpdatedAt DATETIME2(0) NULL,
        CONSTRAINT PK_Rec_EmployeeBaseAddress PRIMARY KEY CLUSTERED (EmployeeBaseAddressId),
        CONSTRAINT UQ_Rec_EmployeeBaseAddress_EmployeeId UNIQUE (EmployeeId),
        CONSTRAINT CK_Rec_EmployeeBaseAddress_ValidationScore CHECK (ValidationScore IS NULL OR (ValidationScore >= 0 AND ValidationScore <= 100))
    );

    ALTER TABLE dbo.Rec_EmployeeBaseAddress WITH CHECK
        ADD CONSTRAINT FK_Rec_EmployeeBaseAddress_Employees FOREIGN KEY (EmployeeId) REFERENCES dbo.Employees (EmployeeId);

    IF OBJECT_ID(N'dbo.Rec_WorkZones', N'U') IS NOT NULL
    BEGIN
        ALTER TABLE dbo.Rec_EmployeeBaseAddress WITH CHECK
            ADD CONSTRAINT FK_Rec_EmployeeBaseAddress_WorkZones FOREIGN KEY (ZoneId) REFERENCES dbo.Rec_WorkZones (ZoneId);
    END
END
ELSE
BEGIN
    EXEC dbo.__GeoAssertColumn @TableName = N'Rec_EmployeeBaseAddress', @ColumnName = N'EmployeeId', @TypeName = N'int', @IsNullable = 0;
    EXEC dbo.__GeoAssertColumn @TableName = N'Rec_EmployeeBaseAddress', @ColumnName = N'InputAddress', @TypeName = N'nvarchar', @IsNullable = 0;
    EXEC dbo.__GeoAssertColumn @TableName = N'Rec_EmployeeBaseAddress', @ColumnName = N'ValidationScore', @TypeName = N'decimal', @Precision = 5, @Scale = 2, @IsNullable = 1;
END
GO

-- ---------------------------------------------------------------------------
-- Rec_SiteAddressProfile
-- ---------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.Rec_SiteAddressProfile', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Rec_SiteAddressProfile
    (
        SiteAddressProfileId INT IDENTITY(1,1) NOT NULL,
        SiteId INT NOT NULL,
        InputAddress NVARCHAR(300) NULL,
        FormattedAddress NVARCHAR(300) NULL,
        ValidationProvider NVARCHAR(50) NULL,
        ValidationStatus NVARCHAR(30) NULL,
        ValidationVerdict NVARCHAR(50) NULL,
        ValidationScore DECIMAL(5, 2) NULL,
        ExternalPlaceRef NVARCHAR(200) NULL,
        Street NVARCHAR(200) NULL,
        HouseNumber NVARCHAR(50) NULL,
        City NVARCHAR(100) NULL,
        Postcode NVARCHAR(30) NULL,
        StateOrRegion NVARCHAR(100) NULL,
        Country NVARCHAR(100) NULL,
        ZoneId INT NULL,
        Latitude DECIMAL(9, 6) NULL,
        Longitude DECIMAL(9, 6) NULL,
        ValidatedAt DATETIME2(0) NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Rec_SiteAddressProfile_CreatedAt DEFAULT (sysutcdatetime()),
        UpdatedAt DATETIME2(0) NULL,
        CONSTRAINT PK_Rec_SiteAddressProfile PRIMARY KEY CLUSTERED (SiteAddressProfileId),
        CONSTRAINT UQ_Rec_SiteAddressProfile_SiteId UNIQUE (SiteId),
        CONSTRAINT CK_Rec_SiteAddressProfile_ValidationScore CHECK (ValidationScore IS NULL OR (ValidationScore >= 0 AND ValidationScore <= 100))
    );

    ALTER TABLE dbo.Rec_SiteAddressProfile WITH CHECK
        ADD CONSTRAINT FK_Rec_SiteAddressProfile_Sites FOREIGN KEY (SiteId) REFERENCES dbo.Sites (SiteId);

    IF OBJECT_ID(N'dbo.Rec_WorkZones', N'U') IS NOT NULL
    BEGIN
        ALTER TABLE dbo.Rec_SiteAddressProfile WITH CHECK
            ADD CONSTRAINT FK_Rec_SiteAddressProfile_WorkZones FOREIGN KEY (ZoneId) REFERENCES dbo.Rec_WorkZones (ZoneId);
    END
END
ELSE
BEGIN
    EXEC dbo.__GeoAssertColumn @TableName = N'Rec_SiteAddressProfile', @ColumnName = N'SiteId', @TypeName = N'int', @IsNullable = 0;
    EXEC dbo.__GeoAssertColumn @TableName = N'Rec_SiteAddressProfile', @ColumnName = N'ValidationScore', @TypeName = N'decimal', @Precision = 5, @Scale = 2, @IsNullable = 1;
END
GO

-- ---------------------------------------------------------------------------
-- Rec_RouteEstimates
-- ---------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.Rec_RouteEstimates', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Rec_RouteEstimates
    (
        RouteEstimateId INT IDENTITY(1,1) NOT NULL,
        EmployeeId INT NOT NULL,
        TargetSiteId INT NOT NULL,
        OriginType NVARCHAR(30) NOT NULL,
        OriginReferenceId INT NULL,
        OriginAddress NVARCHAR(300) NULL,
        TargetAddress NVARCHAR(300) NULL,
        RoutingProvider NVARCHAR(50) NULL,
        RoutingStatus NVARCHAR(30) NULL,
        RoutingMode NVARCHAR(20) NOT NULL CONSTRAINT DF_Rec_RouteEstimates_RoutingMode DEFAULT (N'Driving'),
        EstimatedDistanceKm DECIMAL(10, 2) NULL,
        EstimatedTravelMinutes INT NULL,
        CalculatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Rec_RouteEstimates_CalculatedAt DEFAULT (sysutcdatetime()),
        IsCurrent BIT NOT NULL CONSTRAINT DF_Rec_RouteEstimates_IsCurrent DEFAULT (1),
        CONSTRAINT PK_Rec_RouteEstimates PRIMARY KEY CLUSTERED (RouteEstimateId),
        CONSTRAINT CK_Rec_RouteEstimates_Distance CHECK (EstimatedDistanceKm IS NULL OR EstimatedDistanceKm >= 0),
        CONSTRAINT CK_Rec_RouteEstimates_OriginType CHECK (OriginType IN (N'HomeBase', N'PlannedStop', N'LastKnownLocation')),
        CONSTRAINT CK_Rec_RouteEstimates_RoutingMode CHECK (RoutingMode IN (N'Driving', N'Walking', N'Cycling')),
        CONSTRAINT CK_Rec_RouteEstimates_TravelMinutes CHECK (EstimatedTravelMinutes IS NULL OR EstimatedTravelMinutes >= 0)
    );

    ALTER TABLE dbo.Rec_RouteEstimates WITH CHECK
        ADD CONSTRAINT FK_Rec_RouteEstimates_Employees FOREIGN KEY (EmployeeId) REFERENCES dbo.Employees (EmployeeId);

    ALTER TABLE dbo.Rec_RouteEstimates WITH CHECK
        ADD CONSTRAINT FK_Rec_RouteEstimates_Sites FOREIGN KEY (TargetSiteId) REFERENCES dbo.Sites (SiteId);

    CREATE NONCLUSTERED INDEX IX_Rec_RouteEstimates_EmployeeId_TargetSiteId_Current
        ON dbo.Rec_RouteEstimates (EmployeeId, TargetSiteId, IsCurrent);
END
ELSE
BEGIN
    EXEC dbo.__GeoAssertColumn @TableName = N'Rec_RouteEstimates', @ColumnName = N'EmployeeId', @TypeName = N'int', @IsNullable = 0;
    EXEC dbo.__GeoAssertColumn @TableName = N'Rec_RouteEstimates', @ColumnName = N'TargetSiteId', @TypeName = N'int', @IsNullable = 0;
    EXEC dbo.__GeoAssertColumn @TableName = N'Rec_RouteEstimates', @ColumnName = N'IsCurrent', @TypeName = N'bit', @IsNullable = 0;
END
GO

IF OBJECT_ID(N'dbo.__GeoAssertColumn', N'P') IS NOT NULL
    DROP PROCEDURE dbo.__GeoAssertColumn;
GO

PRINT N'Geo canonical schema gate completed.';
GO

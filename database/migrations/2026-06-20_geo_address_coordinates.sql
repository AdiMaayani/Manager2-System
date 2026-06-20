/*
    Phase 0 — Add Latitude/Longitude to geographic profile tables when missing.

    Run manually AFTER 2026-06-20_geo_rec_tables_canonical.sql when tables exist.
    DO NOT execute from the application.

    Idempotent: adds nullable DECIMAL(9,6) columns only when absent.
    Throws if profile tables are missing entirely.
*/

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.Rec_EmployeeBaseAddress', N'U') IS NULL
BEGIN
    THROW 50010, N'Rec_EmployeeBaseAddress does not exist. Run geo_rec_tables_canonical migration first.', 1;
END

IF OBJECT_ID(N'dbo.Rec_SiteAddressProfile', N'U') IS NULL
BEGIN
    THROW 50011, N'Rec_SiteAddressProfile does not exist. Run geo_rec_tables_canonical migration first.', 1;
END

IF COL_LENGTH(N'dbo.Rec_EmployeeBaseAddress', N'Latitude') IS NULL
BEGIN
    ALTER TABLE dbo.Rec_EmployeeBaseAddress ADD Latitude DECIMAL(9, 6) NULL;
END
GO

IF COL_LENGTH(N'dbo.Rec_EmployeeBaseAddress', N'Longitude') IS NULL
BEGIN
    ALTER TABLE dbo.Rec_EmployeeBaseAddress ADD Longitude DECIMAL(9, 6) NULL;
END
GO

IF COL_LENGTH(N'dbo.Rec_SiteAddressProfile', N'Latitude') IS NULL
BEGIN
    ALTER TABLE dbo.Rec_SiteAddressProfile ADD Latitude DECIMAL(9, 6) NULL;
END
GO

IF COL_LENGTH(N'dbo.Rec_SiteAddressProfile', N'Longitude') IS NULL
BEGIN
    ALTER TABLE dbo.Rec_SiteAddressProfile ADD Longitude DECIMAL(9, 6) NULL;
END
GO

PRINT N'Geo coordinate extension completed.';
GO

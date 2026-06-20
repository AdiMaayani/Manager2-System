/*
    Phase 0 — Verify Latitude/Longitude shape on geographic profile tables.

    Run manually AFTER 2026-06-20_geo_rec_tables_canonical.sql.
    DO NOT execute from the application.

    Responsibility split:
    - Canonical migration creates/adds missing coordinate columns as DECIMAL(9,6) NULL.
    - This migration verifies existing coordinate columns match DECIMAL(9,6) NULL.
    - Adds missing columns only when canonical migration was skipped on an older database.

    Uses RAISERROR instead of THROW for database compatibility level 100 support.
*/

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.__GeoVerifyCoordinateColumn', N'P') IS NOT NULL
    DROP PROCEDURE dbo.__GeoVerifyCoordinateColumn;
GO

CREATE PROCEDURE dbo.__GeoVerifyCoordinateColumn
    @TableName SYSNAME,
    @ColumnName SYSNAME
AS
BEGIN
    SET NOCOUNT ON;

    IF COL_LENGTH(N'dbo.' + @TableName, @ColumnName) IS NULL
    BEGIN
        DECLARE @AddSql NVARCHAR(400) = N'ALTER TABLE dbo.' + QUOTENAME(@TableName)
            + N' ADD ' + QUOTENAME(@ColumnName) + N' DECIMAL(9, 6) NULL;';
        EXEC sys.sp_executesql @AddSql;
        RETURN;
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

    IF @ActualType NOT IN (N'decimal', N'numeric')
       OR @ActualPrecision <> 9
       OR @ActualScale <> 6
       OR @ActualNullable <> 1
    BEGIN
        DECLARE @Mismatch NVARCHAR(400) = N'Incompatible schema: dbo.' + @TableName + N'.' + @ColumnName
            + N' must be DECIMAL(9,6) NULL.';
        RAISERROR(@Mismatch, 16, 1);
        RETURN;
    END
END
GO

IF OBJECT_ID(N'dbo.__GeoRequireTable', N'P') IS NOT NULL
    DROP PROCEDURE dbo.__GeoRequireTable;
GO

CREATE PROCEDURE dbo.__GeoRequireTable
    @TableName SYSNAME,
    @Message NVARCHAR(400)
AS
BEGIN
    SET NOCOUNT ON;

    IF OBJECT_ID(N'dbo.' + @TableName, N'U') IS NULL
    BEGIN
        RAISERROR(@Message, 16, 1);
        RETURN;
    END
END
GO

EXEC dbo.__GeoRequireTable
    @TableName = N'Rec_EmployeeBaseAddress',
    @Message = N'Rec_EmployeeBaseAddress does not exist. Run geo_rec_tables_canonical migration first.';
GO

EXEC dbo.__GeoRequireTable
    @TableName = N'Rec_SiteAddressProfile',
    @Message = N'Rec_SiteAddressProfile does not exist. Run geo_rec_tables_canonical migration first.';
GO

EXEC dbo.__GeoVerifyCoordinateColumn @TableName = N'Rec_EmployeeBaseAddress', @ColumnName = N'Latitude';
GO

EXEC dbo.__GeoVerifyCoordinateColumn @TableName = N'Rec_EmployeeBaseAddress', @ColumnName = N'Longitude';
GO

EXEC dbo.__GeoVerifyCoordinateColumn @TableName = N'Rec_SiteAddressProfile', @ColumnName = N'Latitude';
GO

EXEC dbo.__GeoVerifyCoordinateColumn @TableName = N'Rec_SiteAddressProfile', @ColumnName = N'Longitude';
GO

IF OBJECT_ID(N'dbo.__GeoVerifyCoordinateColumn', N'P') IS NOT NULL
    DROP PROCEDURE dbo.__GeoVerifyCoordinateColumn;
GO

IF OBJECT_ID(N'dbo.__GeoRequireTable', N'P') IS NOT NULL
    DROP PROCEDURE dbo.__GeoRequireTable;
GO

PRINT N'Geo coordinate extension completed.';
GO

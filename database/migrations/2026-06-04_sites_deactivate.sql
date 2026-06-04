/*
    ManageR2 Sites soft-deactivate migration.

    Run this script manually in SSMS against the intended target database.

    Changes:
    - Adds IsActive, UpdatedAt, and DeletedAt to dbo.Sites.
    - Filters site lookups to active sites.
    - Adds dbo.sp_DeactivateSite with a guard for open work items.
*/

IF COL_LENGTH('dbo.Sites', 'IsActive') IS NULL
BEGIN
    ALTER TABLE dbo.Sites
        ADD IsActive BIT NOT NULL CONSTRAINT DF_Sites_IsActive DEFAULT (1);
END
GO

IF COL_LENGTH('dbo.Sites', 'UpdatedAt') IS NULL
BEGIN
    ALTER TABLE dbo.Sites
        ADD UpdatedAt DATETIME2(7) NULL;
END
GO

IF COL_LENGTH('dbo.Sites', 'DeletedAt') IS NULL
BEGIN
    ALTER TABLE dbo.Sites
        ADD DeletedAt DATETIME2(7) NULL;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetSites
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        SiteId,
        CustomerId,
        SiteName,
        AddressLine,
        City,
        IsPrimary,
        Notes,
        CreatedAt,
        UpdatedAt
    FROM dbo.Sites
    WHERE IsActive = 1
    ORDER BY SiteId DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetSiteById
    @SiteId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        SiteId,
        CustomerId,
        SiteName,
        AddressLine,
        City,
        IsPrimary,
        Notes,
        CreatedAt,
        UpdatedAt
    FROM dbo.Sites
    WHERE SiteId = @SiteId
      AND IsActive = 1;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_UpdateSite
    @SiteId INT,
    @CustomerId INT,
    @SiteName NVARCHAR(100),
    @AddressLine NVARCHAR(200) = NULL,
    @City NVARCHAR(50) = NULL,
    @IsPrimary BIT,
    @Notes NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Sites
    SET
        CustomerId = @CustomerId,
        SiteName = @SiteName,
        AddressLine = @AddressLine,
        City = @City,
        IsPrimary = @IsPrimary,
        Notes = @Notes,
        UpdatedAt = SYSUTCDATETIME()
    WHERE SiteId = @SiteId
      AND IsActive = 1;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_DeactivateSite
    @SiteId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM dbo.WorkItems
        WHERE SiteId = @SiteId
          AND ClosedAt IS NULL
          AND Status NOT IN (N'Closed', N'Cancelled', N'Done')
    )
    BEGIN
        THROW 51010, 'Cannot deactivate a site that is used by open work items.', 1;
    END;

    UPDATE dbo.Sites
    SET
        IsActive = 0,
        UpdatedAt = SYSUTCDATETIME(),
        DeletedAt = SYSUTCDATETIME()
    WHERE SiteId = @SiteId
      AND IsActive = 1;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

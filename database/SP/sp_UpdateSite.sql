SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_UpdateSite]
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

    IF EXISTS
    (
        SELECT 1
        FROM dbo.Sites
        WHERE SiteId = @SiteId
          AND IsActive = 1
          AND CustomerId <> @CustomerId
    )
        THROW 51450, 'Reassigning a site to another customer is not allowed.', 1;

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

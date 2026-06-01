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

    UPDATE dbo.Sites
    SET
        CustomerId = @CustomerId,
        SiteName = @SiteName,
        AddressLine = @AddressLine,
        City = @City,
        IsPrimary = @IsPrimary,
        Notes = @Notes
    WHERE SiteId = @SiteId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

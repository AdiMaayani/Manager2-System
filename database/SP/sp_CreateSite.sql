SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_CreateSite]
    @CustomerId INT,
    @SiteName NVARCHAR(100),
    @AddressLine NVARCHAR(200) = NULL,
    @City NVARCHAR(50) = NULL,
    @IsPrimary BIT,
    @Notes NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

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

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS SiteId;
END
GO

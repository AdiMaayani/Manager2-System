SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_CustomerSystems_Create
    @CustomerId          INT,
    @SiteId              INT = NULL,
    @SystemType          NVARCHAR(100),
    @SystemName          NVARCHAR(200),
    @Vendor              NVARCHAR(150) = NULL,
    @Model               NVARCHAR(150) = NULL,
    @Host                NVARCHAR(255) = NULL,
    @Port                INT = NULL,
    @Url                 NVARCHAR(500) = NULL,
    @LocationDescription NVARCHAR(500) = NULL,
    @Notes               NVARCHAR(1000) = NULL,
    @IsActive            BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NormalizedSystemType NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@SystemType)), N'');
    DECLARE @NormalizedSystemName NVARCHAR(200) = NULLIF(LTRIM(RTRIM(@SystemName)), N'');

    IF @NormalizedSystemType IS NULL
    BEGIN
        THROW 52100, 'SystemType is required.', 1;
    END;

    IF @NormalizedSystemName IS NULL
    BEGIN
        THROW 52101, 'SystemName is required.', 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerId = @CustomerId)
    BEGIN
        THROW 52102, 'The specified customer does not exist.', 1;
    END;

    IF @SiteId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Sites WHERE SiteId = @SiteId AND CustomerId = @CustomerId)
    BEGIN
        THROW 52103, 'The specified site does not belong to the customer.', 1;
    END;

    INSERT INTO dbo.CustomerSystems
    (
        CustomerId, SiteId, SystemType, SystemName, Vendor, Model, Host, Port, Url,
        LocationDescription, Notes, IsActive, CreatedAtUtc
    )
    VALUES
    (
        @CustomerId,
        @SiteId,
        @NormalizedSystemType,
        @NormalizedSystemName,
        NULLIF(LTRIM(RTRIM(@Vendor)), N''),
        NULLIF(LTRIM(RTRIM(@Model)), N''),
        NULLIF(LTRIM(RTRIM(@Host)), N''),
        @Port,
        NULLIF(LTRIM(RTRIM(@Url)), N''),
        NULLIF(LTRIM(RTRIM(@LocationDescription)), N''),
        NULLIF(LTRIM(RTRIM(@Notes)), N''),
        @IsActive,
        SYSUTCDATETIME()
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS CustomerSystemId;
END
GO

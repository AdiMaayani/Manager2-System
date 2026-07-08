SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_CustomerSystems_Update
    @CustomerSystemId    INT,
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
    @IsActive            BIT
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

    IF @SiteId IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM dbo.Sites AS s
        INNER JOIN dbo.CustomerSystems AS cs ON cs.CustomerSystemId = @CustomerSystemId
        WHERE s.SiteId = @SiteId AND s.CustomerId = cs.CustomerId
    )
    BEGIN
        THROW 52103, 'The specified site does not belong to the customer.', 1;
    END;

    UPDATE dbo.CustomerSystems
    SET
        SiteId = @SiteId,
        SystemType = @NormalizedSystemType,
        SystemName = @NormalizedSystemName,
        Vendor = NULLIF(LTRIM(RTRIM(@Vendor)), N''),
        Model = NULLIF(LTRIM(RTRIM(@Model)), N''),
        Host = NULLIF(LTRIM(RTRIM(@Host)), N''),
        Port = @Port,
        Url = NULLIF(LTRIM(RTRIM(@Url)), N''),
        LocationDescription = NULLIF(LTRIM(RTRIM(@LocationDescription)), N''),
        Notes = NULLIF(LTRIM(RTRIM(@Notes)), N''),
        IsActive = @IsActive,
        UpdatedAtUtc = SYSUTCDATETIME()
    WHERE CustomerSystemId = @CustomerSystemId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

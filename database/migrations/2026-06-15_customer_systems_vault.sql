/*
    ManageR2 Customer Systems Vault migration.

    Run this script manually in SSMS (or sqlcmd) against the intended target database:

        sqlcmd -S localhost -d ManageR2_Dev -i database/migrations/2026-06-15_customer_systems_vault.sql

    Purpose:
        Secure storage for sensitive customer system access details (cameras, alarms, servers,
        smart-electricity/control systems, IP addresses, credentials, etc.).

    Safety:
        - Additive only. Creates three new tables and their stored procedures. It does not modify or
          drop any existing tables or data. Idempotent (IF NOT EXISTS guards + CREATE OR ALTER).

    Security notes:
        - Secret values are encrypted by the API before insert; the database only stores the encrypted
          blob (EncryptedSecretValue) plus a non-sensitive masked preview. No plaintext secret is stored.
        - Reveal is a separate API operation that is always recorded in CustomerSystemSecretAccessLog.
*/

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* ============================================================
   Tables
   ============================================================ */

IF OBJECT_ID(N'dbo.CustomerSystems', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CustomerSystems
    (
        CustomerSystemId    INT IDENTITY(1,1) NOT NULL,
        CustomerId          INT NOT NULL,
        SiteId              INT NULL,
        SystemType          NVARCHAR(100) NOT NULL,
        SystemName          NVARCHAR(200) NOT NULL,
        Vendor              NVARCHAR(150) NULL,
        Model               NVARCHAR(150) NULL,
        Host                NVARCHAR(255) NULL,
        Port                INT NULL,
        Url                 NVARCHAR(500) NULL,
        LocationDescription NVARCHAR(500) NULL,
        Notes               NVARCHAR(1000) NULL,
        IsActive            BIT NOT NULL CONSTRAINT DF_CustomerSystems_IsActive DEFAULT (1),
        CreatedAtUtc        DATETIME2(7) NOT NULL CONSTRAINT DF_CustomerSystems_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        UpdatedAtUtc        DATETIME2(7) NULL,
        CONSTRAINT PK_CustomerSystems PRIMARY KEY CLUSTERED (CustomerSystemId ASC),
        CONSTRAINT FK_CustomerSystems_Customers
            FOREIGN KEY (CustomerId) REFERENCES dbo.Customers (CustomerId),
        CONSTRAINT FK_CustomerSystems_Sites
            FOREIGN KEY (SiteId) REFERENCES dbo.Sites (SiteId),
        CONSTRAINT CK_CustomerSystems_SystemType_NotBlank
            CHECK (LEN(LTRIM(RTRIM(SystemType))) > 0),
        CONSTRAINT CK_CustomerSystems_SystemName_NotBlank
            CHECK (LEN(LTRIM(RTRIM(SystemName))) > 0),
        CONSTRAINT CK_CustomerSystems_Port_Range
            CHECK (Port IS NULL OR (Port BETWEEN 1 AND 65535))
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_CustomerSystems_Customer_Active'
      AND object_id = OBJECT_ID(N'dbo.CustomerSystems')
)
BEGIN
    CREATE INDEX IX_CustomerSystems_Customer_Active
        ON dbo.CustomerSystems (CustomerId ASC, IsActive ASC, SystemName ASC);
END
GO

IF OBJECT_ID(N'dbo.CustomerSystemSecrets', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CustomerSystemSecrets
    (
        SecretId             INT IDENTITY(1,1) NOT NULL,
        CustomerSystemId     INT NOT NULL,
        SecretType           NVARCHAR(50) NOT NULL,
        Username             NVARCHAR(255) NULL,
        EncryptedSecretValue NVARCHAR(MAX) NOT NULL,
        MaskedPreview        NVARCHAR(64) NULL,
        Notes                NVARCHAR(1000) NULL,
        IsActive             BIT NOT NULL CONSTRAINT DF_CustomerSystemSecrets_IsActive DEFAULT (1),
        CreatedAtUtc         DATETIME2(7) NOT NULL CONSTRAINT DF_CustomerSystemSecrets_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        UpdatedAtUtc         DATETIME2(7) NULL,
        CONSTRAINT PK_CustomerSystemSecrets PRIMARY KEY CLUSTERED (SecretId ASC),
        CONSTRAINT FK_CustomerSystemSecrets_CustomerSystems
            FOREIGN KEY (CustomerSystemId) REFERENCES dbo.CustomerSystems (CustomerSystemId),
        CONSTRAINT CK_CustomerSystemSecrets_SecretType_NotBlank
            CHECK (LEN(LTRIM(RTRIM(SecretType))) > 0),
        CONSTRAINT CK_CustomerSystemSecrets_EncryptedValue_NotBlank
            CHECK (LEN(LTRIM(RTRIM(EncryptedSecretValue))) > 0)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_CustomerSystemSecrets_System_Active'
      AND object_id = OBJECT_ID(N'dbo.CustomerSystemSecrets')
)
BEGIN
    CREATE INDEX IX_CustomerSystemSecrets_System_Active
        ON dbo.CustomerSystemSecrets (CustomerSystemId ASC, IsActive ASC, SecretId ASC);
END
GO

IF OBJECT_ID(N'dbo.CustomerSystemSecretAccessLog', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CustomerSystemSecretAccessLog
    (
        AccessLogId      INT IDENTITY(1,1) NOT NULL,
        SecretId         INT NOT NULL,
        CustomerSystemId INT NOT NULL,
        AccessedByUserId INT NOT NULL,
        AccessedAtUtc    DATETIME2(7) NOT NULL CONSTRAINT DF_CustomerSystemSecretAccessLog_AccessedAtUtc DEFAULT SYSUTCDATETIME(),
        AccessReason     NVARCHAR(500) NULL,
        Action           NVARCHAR(50) NOT NULL CONSTRAINT DF_CustomerSystemSecretAccessLog_Action DEFAULT (N'RevealSecret'),
        ClientIp         NVARCHAR(64) NULL,
        CONSTRAINT PK_CustomerSystemSecretAccessLog PRIMARY KEY CLUSTERED (AccessLogId ASC),
        CONSTRAINT FK_CustomerSystemSecretAccessLog_Secrets
            FOREIGN KEY (SecretId) REFERENCES dbo.CustomerSystemSecrets (SecretId),
        CONSTRAINT FK_CustomerSystemSecretAccessLog_Systems
            FOREIGN KEY (CustomerSystemId) REFERENCES dbo.CustomerSystems (CustomerSystemId),
        CONSTRAINT FK_CustomerSystemSecretAccessLog_Users
            FOREIGN KEY (AccessedByUserId) REFERENCES dbo.Users (UserId)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_CustomerSystemSecretAccessLog_Secret'
      AND object_id = OBJECT_ID(N'dbo.CustomerSystemSecretAccessLog')
)
BEGIN
    CREATE INDEX IX_CustomerSystemSecretAccessLog_Secret
        ON dbo.CustomerSystemSecretAccessLog (SecretId ASC, AccessedAtUtc DESC);
END
GO

/* ============================================================
   Customer Systems stored procedures
   ============================================================ */

CREATE OR ALTER PROCEDURE dbo.sp_CustomerSystems_GetList
    @CustomerId      INT,
    @IncludeInactive BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        cs.CustomerSystemId,
        cs.CustomerId,
        cs.SiteId,
        s.SiteName,
        cs.SystemType,
        cs.SystemName,
        cs.Vendor,
        cs.Model,
        cs.Host,
        cs.Port,
        cs.Url,
        cs.LocationDescription,
        cs.Notes,
        cs.IsActive,
        cs.CreatedAtUtc,
        cs.UpdatedAtUtc
    FROM dbo.CustomerSystems AS cs
    LEFT JOIN dbo.Sites AS s ON s.SiteId = cs.SiteId
    WHERE cs.CustomerId = @CustomerId
      AND (@IncludeInactive = 1 OR cs.IsActive = 1)
    ORDER BY cs.IsActive DESC, cs.SystemName ASC, cs.CustomerSystemId ASC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_CustomerSystems_GetById
    @CustomerSystemId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        cs.CustomerSystemId,
        cs.CustomerId,
        cs.SiteId,
        s.SiteName,
        cs.SystemType,
        cs.SystemName,
        cs.Vendor,
        cs.Model,
        cs.Host,
        cs.Port,
        cs.Url,
        cs.LocationDescription,
        cs.Notes,
        cs.IsActive,
        cs.CreatedAtUtc,
        cs.UpdatedAtUtc
    FROM dbo.CustomerSystems AS cs
    LEFT JOIN dbo.Sites AS s ON s.SiteId = cs.SiteId
    WHERE cs.CustomerSystemId = @CustomerSystemId;
END
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

CREATE OR ALTER PROCEDURE dbo.sp_CustomerSystems_Deactivate
    @CustomerSystemId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.CustomerSystems
    SET IsActive = 0,
        UpdatedAtUtc = SYSUTCDATETIME()
    WHERE CustomerSystemId = @CustomerSystemId
      AND IsActive = 1;

    -- Cascade-deactivate the system's secrets so they can no longer be revealed.
    UPDATE dbo.CustomerSystemSecrets
    SET IsActive = 0,
        UpdatedAtUtc = SYSUTCDATETIME()
    WHERE CustomerSystemId = @CustomerSystemId
      AND IsActive = 1;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

/* ============================================================
   Customer System Secrets stored procedures
   ============================================================ */

-- Metadata only. NEVER returns EncryptedSecretValue or any plaintext.
CREATE OR ALTER PROCEDURE dbo.sp_CustomerSystemSecrets_GetMetadata
    @CustomerSystemId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        SecretId,
        CustomerSystemId,
        SecretType,
        Username,
        MaskedPreview,
        Notes,
        IsActive,
        CreatedAtUtc,
        UpdatedAtUtc
    FROM dbo.CustomerSystemSecrets
    WHERE CustomerSystemId = @CustomerSystemId
    ORDER BY IsActive DESC, SecretId ASC;
END
GO

-- Reveal read path: returns the encrypted blob for the API to decrypt. Used ONLY by the explicit,
-- permission-gated and audited reveal endpoint, never by list/detail endpoints.
CREATE OR ALTER PROCEDURE dbo.sp_CustomerSystemSecrets_GetForReveal
    @CustomerSystemId INT,
    @SecretId         INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        SecretId,
        CustomerSystemId,
        SecretType,
        Username,
        EncryptedSecretValue,
        IsActive
    FROM dbo.CustomerSystemSecrets
    WHERE SecretId = @SecretId
      AND CustomerSystemId = @CustomerSystemId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_CustomerSystemSecrets_Create
    @CustomerSystemId     INT,
    @SecretType           NVARCHAR(50),
    @Username             NVARCHAR(255) = NULL,
    @EncryptedSecretValue NVARCHAR(MAX),
    @MaskedPreview        NVARCHAR(64) = NULL,
    @Notes                NVARCHAR(1000) = NULL,
    @IsActive             BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NormalizedSecretType NVARCHAR(50) = NULLIF(LTRIM(RTRIM(@SecretType)), N'');

    IF @NormalizedSecretType IS NULL
    BEGIN
        THROW 52110, 'SecretType is required.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@EncryptedSecretValue)), N'') IS NULL
    BEGIN
        THROW 52111, 'EncryptedSecretValue is required.', 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.CustomerSystems WHERE CustomerSystemId = @CustomerSystemId)
    BEGIN
        THROW 52112, 'The specified customer system does not exist.', 1;
    END;

    INSERT INTO dbo.CustomerSystemSecrets
    (
        CustomerSystemId, SecretType, Username, EncryptedSecretValue, MaskedPreview, Notes, IsActive, CreatedAtUtc
    )
    VALUES
    (
        @CustomerSystemId,
        @NormalizedSecretType,
        NULLIF(LTRIM(RTRIM(@Username)), N''),
        @EncryptedSecretValue,
        @MaskedPreview,
        NULLIF(LTRIM(RTRIM(@Notes)), N''),
        @IsActive,
        SYSUTCDATETIME()
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS SecretId;
END
GO

-- Update metadata, and the encrypted value only when a new one is supplied (@EncryptedSecretValue NULL
-- keeps the existing value, so editing metadata never requires re-sending the secret).
CREATE OR ALTER PROCEDURE dbo.sp_CustomerSystemSecrets_Update
    @SecretId             INT,
    @SecretType           NVARCHAR(50),
    @Username             NVARCHAR(255) = NULL,
    @EncryptedSecretValue NVARCHAR(MAX) = NULL,
    @MaskedPreview        NVARCHAR(64) = NULL,
    @Notes                NVARCHAR(1000) = NULL,
    @IsActive             BIT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NormalizedSecretType NVARCHAR(50) = NULLIF(LTRIM(RTRIM(@SecretType)), N'');

    IF @NormalizedSecretType IS NULL
    BEGIN
        THROW 52110, 'SecretType is required.', 1;
    END;

    UPDATE dbo.CustomerSystemSecrets
    SET
        SecretType = @NormalizedSecretType,
        Username = NULLIF(LTRIM(RTRIM(@Username)), N''),
        EncryptedSecretValue = CASE
            WHEN NULLIF(LTRIM(RTRIM(@EncryptedSecretValue)), N'') IS NULL THEN EncryptedSecretValue
            ELSE @EncryptedSecretValue
        END,
        MaskedPreview = CASE
            WHEN NULLIF(LTRIM(RTRIM(@EncryptedSecretValue)), N'') IS NULL THEN MaskedPreview
            ELSE @MaskedPreview
        END,
        Notes = NULLIF(LTRIM(RTRIM(@Notes)), N''),
        IsActive = @IsActive,
        UpdatedAtUtc = SYSUTCDATETIME()
    WHERE SecretId = @SecretId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_CustomerSystemSecrets_Deactivate
    @SecretId INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.CustomerSystemSecrets
    SET IsActive = 0,
        UpdatedAtUtc = SYSUTCDATETIME()
    WHERE SecretId = @SecretId
      AND IsActive = 1;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_CustomerSystemSecrets_LogAccess
    @SecretId         INT,
    @CustomerSystemId INT,
    @AccessedByUserId INT,
    @AccessReason     NVARCHAR(500) = NULL,
    @Action           NVARCHAR(50) = N'RevealSecret',
    @ClientIp         NVARCHAR(64) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.CustomerSystemSecretAccessLog
    (
        SecretId, CustomerSystemId, AccessedByUserId, AccessedAtUtc, AccessReason, Action, ClientIp
    )
    VALUES
    (
        @SecretId,
        @CustomerSystemId,
        @AccessedByUserId,
        SYSUTCDATETIME(),
        NULLIF(LTRIM(RTRIM(@AccessReason)), N''),
        ISNULL(NULLIF(LTRIM(RTRIM(@Action)), N''), N'RevealSecret'),
        NULLIF(LTRIM(RTRIM(@ClientIp)), N'')
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS AccessLogId;
END
GO

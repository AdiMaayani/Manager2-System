SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
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

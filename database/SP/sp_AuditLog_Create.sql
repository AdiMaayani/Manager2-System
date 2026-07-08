SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- Internal, server-side only write path. There is no public create endpoint for audit rows.
CREATE OR ALTER PROCEDURE dbo.sp_AuditLog_Create
    @UserId       INT = NULL,
    @Action       NVARCHAR(100),
    @EntityType   NVARCHAR(100),
    @EntityId     INT = NULL,
    @Severity     NVARCHAR(20) = N'Info',
    @Summary      NVARCHAR(500),
    @MetadataJson NVARCHAR(MAX) = NULL,
    @ClientIp     NVARCHAR(64) = NULL,
    @UserAgent    NVARCHAR(512) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NormalizedAction     NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@Action)), N'');
    DECLARE @NormalizedEntityType NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@EntityType)), N'');
    DECLARE @NormalizedSeverity   NVARCHAR(20)  = NULLIF(LTRIM(RTRIM(@Severity)), N'');
    DECLARE @NormalizedSummary    NVARCHAR(500) = NULLIF(LTRIM(RTRIM(@Summary)), N'');

    IF @NormalizedAction IS NULL
    BEGIN
        THROW 53000, 'Action is required.', 1;
    END;

    IF @NormalizedEntityType IS NULL
    BEGIN
        THROW 53001, 'EntityType is required.', 1;
    END;

    IF @NormalizedSummary IS NULL
    BEGIN
        THROW 53002, 'Summary is required.', 1;
    END;

    -- Default/normalize severity; unknown values fall back to Info so a bad caller never blocks the write.
    IF @NormalizedSeverity NOT IN (N'Info', N'Warning', N'Critical')
    BEGIN
        SET @NormalizedSeverity = N'Info';
    END;

    INSERT INTO dbo.AuditLog
    (
        OccurredAtUtc, UserId, Action, EntityType, EntityId, Severity, Summary, MetadataJson, ClientIp, UserAgent
    )
    VALUES
    (
        SYSUTCDATETIME(),
        @UserId,
        @NormalizedAction,
        @NormalizedEntityType,
        @EntityId,
        @NormalizedSeverity,
        @NormalizedSummary,
        NULLIF(LTRIM(RTRIM(@MetadataJson)), N''),
        NULLIF(LTRIM(RTRIM(@ClientIp)), N''),
        NULLIF(LTRIM(RTRIM(@UserAgent)), N'')
    );

    SELECT CAST(SCOPE_IDENTITY() AS BIGINT) AS AuditLogId;
END
GO

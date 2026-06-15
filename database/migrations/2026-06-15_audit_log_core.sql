/*
    ManageR2 Core Audit Log migration (feature/audit-log-core).

    Run this script manually in SSMS (or sqlcmd) against the intended target database:

        sqlcmd -S localhost -d ManageR2_Dev -i database/migrations/2026-06-15_audit_log_core.sql

    Purpose:
        A single, focused audit trail for high-value security and operational actions
        (login/security, user & role management, customer systems vault, service calls,
        and core work-item changes). It is intentionally NOT a request-level access log:
        only meaningful state changes and security events are written here.

    Safety:
        - Additive only. Creates one new table (dbo.AuditLog) and two stored procedures.
          It does not modify or drop any existing table, column, or data.
        - Idempotent (IF NOT EXISTS guards + CREATE OR ALTER).

    Security notes:
        - AuditLog NEVER stores plaintext secrets, passwords, JWTs, or raw connection
          strings. MetadataJson is a small, sanitized JSON document built server-side.
        - UserId is stored WITHOUT a foreign key on purpose: audit rows must survive even
          if the referenced user is later hard-deleted, and login-failure events for an
          unknown e-mail legitimately have a NULL UserId.
*/

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* ============================================================
   Table
   ============================================================ */

IF OBJECT_ID(N'dbo.AuditLog', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AuditLog
    (
        AuditLogId    BIGINT IDENTITY(1,1) NOT NULL,
        OccurredAtUtc DATETIME2(7) NOT NULL CONSTRAINT DF_AuditLog_OccurredAtUtc DEFAULT SYSUTCDATETIME(),
        UserId        INT NULL,
        Action        NVARCHAR(100) NOT NULL,
        EntityType    NVARCHAR(100) NOT NULL,
        EntityId      INT NULL,
        Severity      NVARCHAR(20) NOT NULL CONSTRAINT DF_AuditLog_Severity DEFAULT (N'Info'),
        Summary       NVARCHAR(500) NOT NULL,
        MetadataJson  NVARCHAR(MAX) NULL,
        ClientIp      NVARCHAR(64) NULL,
        UserAgent     NVARCHAR(512) NULL,
        CONSTRAINT PK_AuditLog PRIMARY KEY CLUSTERED (AuditLogId ASC),
        CONSTRAINT CK_AuditLog_Action_NotBlank
            CHECK (LEN(LTRIM(RTRIM(Action))) > 0),
        CONSTRAINT CK_AuditLog_EntityType_NotBlank
            CHECK (LEN(LTRIM(RTRIM(EntityType))) > 0),
        CONSTRAINT CK_AuditLog_Severity_Allowed
            CHECK (Severity IN (N'Info', N'Warning', N'Critical'))
    );
END
GO

-- Primary read pattern: newest-first, optionally filtered by time/action/entity/severity.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_AuditLog_OccurredAt'
      AND object_id = OBJECT_ID(N'dbo.AuditLog')
)
BEGIN
    CREATE INDEX IX_AuditLog_OccurredAt
        ON dbo.AuditLog (OccurredAtUtc DESC, AuditLogId DESC);
END
GO

-- Supports "show everything for this entity" lookups (e.g. one user, one work item).
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_AuditLog_Entity'
      AND object_id = OBJECT_ID(N'dbo.AuditLog')
)
BEGIN
    CREATE INDEX IX_AuditLog_Entity
        ON dbo.AuditLog (EntityType ASC, EntityId ASC, OccurredAtUtc DESC);
END
GO

/* ============================================================
   Stored procedures
   ============================================================ */

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

-- Read path for the authorized Audit Log screen. All filters are optional; results are newest-first
-- and capped by @MaxRows (defensively clamped to 1..1000). UserName is resolved for display only.
CREATE OR ALTER PROCEDURE dbo.sp_AuditLog_GetList
    @FromUtc    DATETIME2(7) = NULL,
    @ToUtc      DATETIME2(7) = NULL,
    @Action     NVARCHAR(100) = NULL,
    @EntityType NVARCHAR(100) = NULL,
    @Severity   NVARCHAR(20) = NULL,
    @UserId     INT = NULL,
    @MaxRows    INT = 200
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @EffectiveMaxRows INT =
        CASE
            WHEN @MaxRows IS NULL OR @MaxRows < 1 THEN 200
            WHEN @MaxRows > 1000 THEN 1000
            ELSE @MaxRows
        END;

    DECLARE @NormalizedAction     NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@Action)), N'');
    DECLARE @NormalizedEntityType NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@EntityType)), N'');
    DECLARE @NormalizedSeverity   NVARCHAR(20)  = NULLIF(LTRIM(RTRIM(@Severity)), N'');

    SELECT TOP (@EffectiveMaxRows)
        a.AuditLogId,
        a.OccurredAtUtc,
        a.UserId,
        u.Username AS UserName,
        a.Action,
        a.EntityType,
        a.EntityId,
        a.Severity,
        a.Summary,
        a.MetadataJson,
        a.ClientIp,
        a.UserAgent
    FROM dbo.AuditLog AS a
    LEFT JOIN dbo.Users AS u ON u.UserId = a.UserId
    WHERE (@FromUtc IS NULL OR a.OccurredAtUtc >= @FromUtc)
      AND (@ToUtc IS NULL OR a.OccurredAtUtc <= @ToUtc)
      AND (@NormalizedAction IS NULL OR a.Action = @NormalizedAction)
      AND (@NormalizedEntityType IS NULL OR a.EntityType = @NormalizedEntityType)
      AND (@NormalizedSeverity IS NULL OR a.Severity = @NormalizedSeverity)
      AND (@UserId IS NULL OR a.UserId = @UserId)
    ORDER BY a.OccurredAtUtc DESC, a.AuditLogId DESC;
END
GO

/* ============================================================
   Manual SSMS verification queries (run after the migration)
   ============================================================

-- 1. Table exists with the expected columns.
SELECT c.name AS ColumnName, t.name AS DataType, c.max_length, c.is_nullable
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.AuditLog')
ORDER BY c.column_id;

-- 2. Both stored procedures exist.
SELECT name, type_desc, create_date, modify_date
FROM sys.objects
WHERE name IN (N'sp_AuditLog_Create', N'sp_AuditLog_GetList')
ORDER BY name;

-- 3. Smoke-test an insert (Info severity, no user, no entity) and read it back.
EXEC dbo.sp_AuditLog_Create
    @Action     = N'AuditSelfTest',
    @EntityType = N'System',
    @Severity   = N'Info',
    @Summary    = N'Manual verification insert from SSMS.';

EXEC dbo.sp_AuditLog_GetList @Action = N'AuditSelfTest', @MaxRows = 10;

-- 4. Confirm severity validation defaults an unknown value to Info instead of failing.
EXEC dbo.sp_AuditLog_Create
    @Action     = N'AuditSelfTest',
    @EntityType = N'System',
    @Severity   = N'BogusLevel',
    @Summary    = N'Severity normalization check.';

SELECT TOP 5 AuditLogId, Severity, Summary
FROM dbo.AuditLog
WHERE Action = N'AuditSelfTest'
ORDER BY AuditLogId DESC;

-- 5. Clean up the self-test rows when done.
DELETE FROM dbo.AuditLog WHERE Action = N'AuditSelfTest';

*/

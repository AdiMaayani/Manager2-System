/*
    ManageR2 Audit Log search migration (feature/ui-ux-followup-fixes).

    Run this script manually in SSMS (or sqlcmd) against the intended target database:

        sqlcmd -S localhost -d ManageR2_Dev -i database/migrations/2026-06-18_audit_search.sql

    Purpose:
        Add a single optional @Search parameter to dbo.sp_AuditLog_GetList so the Audit Log
        screen can run one free-text search across the most relevant stored columns instead of
        misusing the exact @Action filter. Matching is performed BEFORE the TOP cap so the search
        scans the full table, not just the most recent capped page.

    Safety:
        - Additive only. CREATE OR ALTER on one existing stored procedure; no schema/data change.
        - Idempotent. Re-running re-applies the same definition.

    Notes:
        - @Search matches the RAW stored English values (Action / Summary / EntityType) plus the
          resolved Username and the EntityId cast to text. Hebrew label matching is a frontend-only
          concern and is intentionally not handled here.
        - @Action / @EntityType / @Severity remain independent exact filters and are unchanged.
*/

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.sp_AuditLog_GetList
    @FromUtc    DATETIME2(7) = NULL,
    @ToUtc      DATETIME2(7) = NULL,
    @Action     NVARCHAR(100) = NULL,
    @EntityType NVARCHAR(100) = NULL,
    @Severity   NVARCHAR(20) = NULL,
    @UserId     INT = NULL,
    @Search     NVARCHAR(200) = NULL,
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
    DECLARE @NormalizedSearch     NVARCHAR(200) = NULLIF(LTRIM(RTRIM(@Search)), N'');

    -- Escape LIKE wildcards in the search term so a literal % or _ does not broaden the match.
    DECLARE @SearchPattern NVARCHAR(210) = NULL;
    IF @NormalizedSearch IS NOT NULL
    BEGIN
        SET @SearchPattern =
            N'%' +
            REPLACE(REPLACE(REPLACE(@NormalizedSearch, N'[', N'[[]'), N'%', N'[%]'), N'_', N'[_]') +
            N'%';
    END;

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
      AND (
            @SearchPattern IS NULL
            OR a.Action LIKE @SearchPattern
            OR a.Summary LIKE @SearchPattern
            OR a.EntityType LIKE @SearchPattern
            OR u.Username LIKE @SearchPattern
            OR CAST(a.EntityId AS NVARCHAR(50)) LIKE @SearchPattern
          )
    ORDER BY a.OccurredAtUtc DESC, a.AuditLogId DESC;
END
GO

/* ============================================================
   Manual SSMS verification queries (run after the migration)
   ============================================================

-- 1. Procedure now exposes @Search.
SELECT p.name AS ParameterName, t.name AS DataType
FROM sys.parameters p
JOIN sys.types t ON t.user_type_id = p.user_type_id
WHERE p.object_id = OBJECT_ID(N'dbo.sp_AuditLog_GetList')
ORDER BY p.parameter_id;

-- 2. Free-text search hits action/summary/user/entityType/entityId.
EXEC dbo.sp_AuditLog_GetList @Search = N'User', @MaxRows = 20;

-- 3. Empty search behaves exactly like before (newest-first capped list).
EXEC dbo.sp_AuditLog_GetList @MaxRows = 20;

*/

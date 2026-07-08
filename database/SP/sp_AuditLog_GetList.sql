SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
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

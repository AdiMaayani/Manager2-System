/*
  Diagnostics-gated Israel-local wall-clock -> UTC conversion.
  All flags default to 0. With defaults this script is read-only and creates no objects.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @ConventionConfirmedIsraelLocal BIT=0;
DECLARE @ApplyConversion BIT=0;
DECLARE @ApproveSwap BIT=0;
DECLARE @ApproveReverse BIT=0;

/* Diagnostics always run before any gated DDL or data mutation. */
SELECT TOP(200)
    WorkItemId,Title,WorkType,TaskCategory,PlannedStart,PlannedEnd,ActualStart,ActualEnd,
    PlannedStart AT TIME ZONE 'Israel Standard Time' AS PlannedStartIsraelOffset,
    CONVERT(DATETIME2(7),PlannedStart AT TIME ZONE 'Israel Standard Time' AT TIME ZONE 'UTC') AS PreviewPlannedStartUtc,
    CONVERT(DATETIME2(7),PlannedEnd AT TIME ZONE 'Israel Standard Time' AT TIME ZONE 'UTC') AS PreviewPlannedEndUtc
FROM dbo.WorkItems
WHERE PlannedStart IS NOT NULL OR PlannedEnd IS NOT NULL
ORDER BY WorkItemId;

SELECT DATEPART(YEAR,PlannedStart) CalendarYear,DATEPART(MONTH,PlannedStart) CalendarMonth,
       COUNT(*) AS [RowCount],MIN(PlannedStart) MinValue,MAX(PlannedStart) MaxValue
FROM dbo.WorkItems
WHERE PlannedStart IS NOT NULL
GROUP BY DATEPART(YEAR,PlannedStart),DATEPART(MONTH,PlannedStart)
ORDER BY CalendarYear,CalendarMonth;

SELECT WorkItemId,Title,PlannedStart,PlannedEnd
FROM dbo.WorkItems
WHERE (PlannedStart IS NULL AND PlannedEnd IS NOT NULL)
   OR (PlannedStart IS NOT NULL AND PlannedEnd IS NULL)
   OR PlannedEnd<=PlannedStart;

/* Review rows around likely DST transition hours explicitly; SQL Server resolves them
   deterministically, but the operator must confirm the source convention before approval. */
SELECT TOP(200) WorkItemId,Title,PlannedStart,
       PlannedStart AT TIME ZONE 'Israel Standard Time' AS IsraelOffsetResolution,
       DATEPART(TZOFFSET,PlannedStart AT TIME ZONE 'Israel Standard Time') AS OffsetMinutes
FROM dbo.WorkItems
WHERE PlannedStart IS NOT NULL AND DATEPART(HOUR,PlannedStart) BETWEEN 1 AND 3
ORDER BY PlannedStart,WorkItemId;

IF @ApplyConversion=1 AND @ConventionConfirmedIsraelLocal=0
    THROW 51500,'Timezone convention is not confirmed. Conversion stopped without changes.',1;
IF @ApproveSwap=1 AND @ApplyConversion=0
    THROW 51501,'Swap requires the shadow conversion phase in the same approved execution.',1;
IF @ApproveReverse=1 AND (@ApplyConversion=1 OR @ApproveSwap=1)
    THROW 51503,'Conversion/swap and reverse cannot run in the same execution.',1;

IF @ApplyConversion=1
BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'dbo._WorkItemsPlannedDatetimeUtcAudit',N'U') IS NULL
        EXEC(N'CREATE TABLE dbo._WorkItemsPlannedDatetimeUtcAudit
        (
            WorkItemId INT NOT NULL CONSTRAINT PK__WorkItemsPlannedDatetimeUtcAudit PRIMARY KEY,
            PlannedStartLocal DATETIME2(7) NULL,PlannedEndLocal DATETIME2(7) NULL,
            ActualStartLocal DATETIME2(7) NULL,ActualEndLocal DATETIME2(7) NULL,
            ConvertedAt DATETIME2(7) NOT NULL CONSTRAINT DF__WorkItemsPlannedDatetimeUtcAudit_ConvertedAt DEFAULT SYSUTCDATETIME()
        );');
    IF OBJECT_ID(N'dbo._ProjectMilestonesDatetimeUtcAudit',N'U') IS NULL
        EXEC(N'CREATE TABLE dbo._ProjectMilestonesDatetimeUtcAudit
        (
            ProjectMilestoneId INT NOT NULL CONSTRAINT PK__ProjectMilestonesDatetimeUtcAudit PRIMARY KEY,
            PlannedStartLocal DATETIME2(7) NULL,PlannedEndLocal DATETIME2(7) NULL,
            ActualStartLocal DATETIME2(7) NULL,ActualEndLocal DATETIME2(7) NULL,
            ConvertedAt DATETIME2(7) NOT NULL CONSTRAINT DF__ProjectMilestonesDatetimeUtcAudit_ConvertedAt DEFAULT SYSUTCDATETIME()
        );');

    IF COL_LENGTH(N'dbo.WorkItems',N'PlannedStartUtc') IS NULL EXEC(N'ALTER TABLE dbo.WorkItems ADD PlannedStartUtc DATETIME2(7) NULL;');
    IF COL_LENGTH(N'dbo.WorkItems',N'PlannedEndUtc') IS NULL EXEC(N'ALTER TABLE dbo.WorkItems ADD PlannedEndUtc DATETIME2(7) NULL;');
    IF COL_LENGTH(N'dbo.WorkItems',N'ActualStartUtc') IS NULL EXEC(N'ALTER TABLE dbo.WorkItems ADD ActualStartUtc DATETIME2(7) NULL;');
    IF COL_LENGTH(N'dbo.WorkItems',N'ActualEndUtc') IS NULL EXEC(N'ALTER TABLE dbo.WorkItems ADD ActualEndUtc DATETIME2(7) NULL;');
    IF COL_LENGTH(N'dbo.ProjectMilestones',N'PlannedStartUtc') IS NULL EXEC(N'ALTER TABLE dbo.ProjectMilestones ADD PlannedStartUtc DATETIME2(7) NULL;');
    IF COL_LENGTH(N'dbo.ProjectMilestones',N'PlannedEndUtc') IS NULL EXEC(N'ALTER TABLE dbo.ProjectMilestones ADD PlannedEndUtc DATETIME2(7) NULL;');
    IF COL_LENGTH(N'dbo.ProjectMilestones',N'ActualStartUtc') IS NULL EXEC(N'ALTER TABLE dbo.ProjectMilestones ADD ActualStartUtc DATETIME2(7) NULL;');
    IF COL_LENGTH(N'dbo.ProjectMilestones',N'ActualEndUtc') IS NULL EXEC(N'ALTER TABLE dbo.ProjectMilestones ADD ActualEndUtc DATETIME2(7) NULL;');

    EXEC sys.sp_executesql N'
        INSERT dbo._WorkItemsPlannedDatetimeUtcAudit(WorkItemId,PlannedStartLocal,PlannedEndLocal,ActualStartLocal,ActualEndLocal)
        SELECT WorkItemId,PlannedStart,PlannedEnd,ActualStart,ActualEnd
        FROM dbo.WorkItems w
        WHERE (PlannedStart IS NOT NULL OR PlannedEnd IS NOT NULL OR ActualStart IS NOT NULL OR ActualEnd IS NOT NULL)
          AND NOT EXISTS(SELECT 1 FROM dbo._WorkItemsPlannedDatetimeUtcAudit a WHERE a.WorkItemId=w.WorkItemId);

        UPDATE w SET
            PlannedStartUtc=CONVERT(DATETIME2(7),a.PlannedStartLocal AT TIME ZONE ''Israel Standard Time'' AT TIME ZONE ''UTC''),
            PlannedEndUtc=CONVERT(DATETIME2(7),a.PlannedEndLocal AT TIME ZONE ''Israel Standard Time'' AT TIME ZONE ''UTC''),
            ActualStartUtc=CONVERT(DATETIME2(7),a.ActualStartLocal AT TIME ZONE ''Israel Standard Time'' AT TIME ZONE ''UTC''),
            ActualEndUtc=CONVERT(DATETIME2(7),a.ActualEndLocal AT TIME ZONE ''Israel Standard Time'' AT TIME ZONE ''UTC'')
        FROM dbo.WorkItems w JOIN dbo._WorkItemsPlannedDatetimeUtcAudit a ON a.WorkItemId=w.WorkItemId;

        INSERT dbo._ProjectMilestonesDatetimeUtcAudit(ProjectMilestoneId,PlannedStartLocal,PlannedEndLocal,ActualStartLocal,ActualEndLocal)
        SELECT ProjectMilestoneId,PlannedStart,PlannedEnd,ActualStart,ActualEnd
        FROM dbo.ProjectMilestones p
        WHERE p.LegacyWorkItemId IS NOT NULL
          AND NOT EXISTS(SELECT 1 FROM dbo._ProjectMilestonesDatetimeUtcAudit a WHERE a.ProjectMilestoneId=p.ProjectMilestoneId)
          AND NOT EXISTS(
              SELECT 1 FROM dbo.WorkItems wi
              JOIN dbo._WorkItemsPlannedDatetimeUtcAudit wa ON wa.WorkItemId=wi.WorkItemId
              WHERE wi.WorkItemId=p.LegacyWorkItemId
                AND (wi.PlannedStart=wi.PlannedStartUtc OR (wi.PlannedStart IS NULL AND wi.PlannedStartUtc IS NULL))
                AND (wi.PlannedEnd=wi.PlannedEndUtc OR (wi.PlannedEnd IS NULL AND wi.PlannedEndUtc IS NULL))
          );

        UPDATE p SET
            PlannedStartUtc=CONVERT(DATETIME2(7),a.PlannedStartLocal AT TIME ZONE ''Israel Standard Time'' AT TIME ZONE ''UTC''),
            PlannedEndUtc=CONVERT(DATETIME2(7),a.PlannedEndLocal AT TIME ZONE ''Israel Standard Time'' AT TIME ZONE ''UTC''),
            ActualStartUtc=CONVERT(DATETIME2(7),a.ActualStartLocal AT TIME ZONE ''Israel Standard Time'' AT TIME ZONE ''UTC''),
            ActualEndUtc=CONVERT(DATETIME2(7),a.ActualEndLocal AT TIME ZONE ''Israel Standard Time'' AT TIME ZONE ''UTC'')
        FROM dbo.ProjectMilestones p
        JOIN dbo._ProjectMilestonesDatetimeUtcAudit a ON a.ProjectMilestoneId=p.ProjectMilestoneId;

        IF EXISTS(SELECT 1 FROM dbo.WorkItems w JOIN dbo._WorkItemsPlannedDatetimeUtcAudit a ON a.WorkItemId=w.WorkItemId
                  WHERE a.PlannedStartLocal IS NOT NULL AND w.PlannedStartUtc IS NULL)
            THROW 51502,''Shadow conversion verification failed.'',1;

        IF @DoSwap=1
        BEGIN
            UPDATE w SET PlannedStart=PlannedStartUtc,PlannedEnd=PlannedEndUtc,ActualStart=ActualStartUtc,ActualEnd=ActualEndUtc
            FROM dbo.WorkItems w JOIN dbo._WorkItemsPlannedDatetimeUtcAudit a ON a.WorkItemId=w.WorkItemId;
            UPDATE p SET PlannedStart=PlannedStartUtc,PlannedEnd=PlannedEndUtc,ActualStart=ActualStartUtc,ActualEnd=ActualEndUtc
            FROM dbo.ProjectMilestones p JOIN dbo._ProjectMilestonesDatetimeUtcAudit a ON a.ProjectMilestoneId=p.ProjectMilestoneId;
        END;',N'@DoSwap BIT',@DoSwap=@ApproveSwap;

    COMMIT;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT>0 ROLLBACK;
    THROW;
END CATCH;

IF @ApproveReverse=1
BEGIN TRY
    BEGIN TRANSACTION;
    IF OBJECT_ID(N'dbo._WorkItemsPlannedDatetimeUtcAudit',N'U') IS NULL
        THROW 51510,'WorkItem timezone audit table is missing.',1;
    IF OBJECT_ID(N'dbo._ProjectMilestonesDatetimeUtcAudit',N'U') IS NULL
        THROW 51511,'Milestone timezone audit table is missing.',1;

    EXEC(N'
        IF EXISTS(
            SELECT 1 FROM dbo.WorkItems w JOIN dbo._WorkItemsPlannedDatetimeUtcAudit a ON a.WorkItemId=w.WorkItemId
            WHERE NOT((w.PlannedStart=w.PlannedStartUtc OR (w.PlannedStart IS NULL AND w.PlannedStartUtc IS NULL))
                  AND (w.PlannedEnd=w.PlannedEndUtc OR (w.PlannedEnd IS NULL AND w.PlannedEndUtc IS NULL))
                  AND (w.ActualStart=w.ActualStartUtc OR (w.ActualStart IS NULL AND w.ActualStartUtc IS NULL))
                  AND (w.ActualEnd=w.ActualEndUtc OR (w.ActualEnd IS NULL AND w.ActualEndUtc IS NULL)))
        ) THROW 51512,''Cannot reverse: a WorkItem datetime changed after UTC swap.'',1;

        IF EXISTS(
            SELECT 1 FROM dbo.ProjectMilestones p JOIN dbo._ProjectMilestonesDatetimeUtcAudit a ON a.ProjectMilestoneId=p.ProjectMilestoneId
            WHERE NOT((p.PlannedStart=p.PlannedStartUtc OR (p.PlannedStart IS NULL AND p.PlannedStartUtc IS NULL))
                  AND (p.PlannedEnd=p.PlannedEndUtc OR (p.PlannedEnd IS NULL AND p.PlannedEndUtc IS NULL))
                  AND (p.ActualStart=p.ActualStartUtc OR (p.ActualStart IS NULL AND p.ActualStartUtc IS NULL))
                  AND (p.ActualEnd=p.ActualEndUtc OR (p.ActualEnd IS NULL AND p.ActualEndUtc IS NULL)))
        ) THROW 51513,''Cannot reverse: a milestone datetime changed after UTC swap.'',1;

        IF EXISTS(
            SELECT 1 FROM dbo.ProjectMilestones p
            JOIN dbo._WorkItemsPlannedDatetimeUtcAudit wa ON wa.WorkItemId=p.LegacyWorkItemId
            JOIN dbo.WorkItems wi ON wi.WorkItemId=wa.WorkItemId
            WHERE NOT EXISTS(SELECT 1 FROM dbo._ProjectMilestonesDatetimeUtcAudit ma WHERE ma.ProjectMilestoneId=p.ProjectMilestoneId)
              AND NOT((p.PlannedStart=wi.PlannedStartUtc OR (p.PlannedStart IS NULL AND wi.PlannedStartUtc IS NULL))
                  AND (p.PlannedEnd=wi.PlannedEndUtc OR (p.PlannedEnd IS NULL AND wi.PlannedEndUtc IS NULL))
                  AND (p.ActualStart=wi.ActualStartUtc OR (p.ActualStart IS NULL AND wi.ActualStartUtc IS NULL))
                  AND (p.ActualEnd=wi.ActualEndUtc OR (p.ActualEnd IS NULL AND wi.ActualEndUtc IS NULL)))
        ) THROW 51514,''Cannot reverse: a post-swap legacy milestone datetime changed.'',1;

        UPDATE w SET PlannedStart=a.PlannedStartLocal,PlannedEnd=a.PlannedEndLocal,
                     ActualStart=a.ActualStartLocal,ActualEnd=a.ActualEndLocal
        FROM dbo.WorkItems w JOIN dbo._WorkItemsPlannedDatetimeUtcAudit a ON a.WorkItemId=w.WorkItemId;
        UPDATE p SET PlannedStart=a.PlannedStartLocal,PlannedEnd=a.PlannedEndLocal,
                     ActualStart=a.ActualStartLocal,ActualEnd=a.ActualEndLocal
        FROM dbo.ProjectMilestones p JOIN dbo._ProjectMilestonesDatetimeUtcAudit a ON a.ProjectMilestoneId=p.ProjectMilestoneId;
        UPDATE p SET PlannedStart=wa.PlannedStartLocal,PlannedEnd=wa.PlannedEndLocal,
                     ActualStart=wa.ActualStartLocal,ActualEnd=wa.ActualEndLocal
        FROM dbo.ProjectMilestones p
        JOIN dbo._WorkItemsPlannedDatetimeUtcAudit wa ON wa.WorkItemId=p.LegacyWorkItemId
        WHERE NOT EXISTS(SELECT 1 FROM dbo._ProjectMilestonesDatetimeUtcAudit ma WHERE ma.ProjectMilestoneId=p.ProjectMilestoneId);');
    COMMIT;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT>0 ROLLBACK;
    THROW;
END CATCH;

/* Verification is read-only and works before or after an approved conversion. */
IF OBJECT_ID(N'dbo._WorkItemsPlannedDatetimeUtcAudit',N'U') IS NOT NULL
    EXEC(N'SELECT TOP(200) a.WorkItemId,a.PlannedStartLocal,w.PlannedStartUtc,w.PlannedStart,
                  DATEDIFF(MINUTE,w.PlannedStartUtc,w.PlannedEndUtc) DurationMinutes
           FROM dbo._WorkItemsPlannedDatetimeUtcAudit a JOIN dbo.WorkItems w ON w.WorkItemId=a.WorkItemId
           ORDER BY a.WorkItemId;');
GO

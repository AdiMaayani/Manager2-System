/*
================================================================================
ManageR2 — READ-ONLY pre-deployment check (2026-07-08)
================================================================================
Purpose: Verify target database readiness before applying
         database/deployment/patches/2026-07-08_redeploy_current_canonical_sps.sql

This script is READ-ONLY. It does not modify schema, data, permissions, or settings.
Run against the intended target database only after confirming connection context.

Expected outcome per procedure:
  PASS         — deployed definition already matches repository canonical markers
  NEEDS_PATCH  — procedure exists but is stale (missing params/body markers)
  FAIL         — procedure or required column missing; do not patch until resolved
================================================================================
*/

SET NOCOUNT ON;

PRINT '=== ManageR2 SP redeploy pre-check (read-only) ===';
PRINT 'Run at: ' + CONVERT(VARCHAR(30), SYSUTCDATETIME(), 126) + ' UTC';
PRINT 'Server: ' + @@SERVERNAME;
PRINT 'Database: ' + DB_NAME();
PRINT '';

/* -------------------------------------------------------------------------- */
/* Required table columns (from migration 2026-06-11; not in baseline tables.sql) */
/* -------------------------------------------------------------------------- */
DECLARE @RequiredColumns TABLE (
    TableName SYSNAME NOT NULL,
    ColumnName SYSNAME NOT NULL,
    IsPresent BIT NOT NULL
);

INSERT INTO @RequiredColumns (TableName, ColumnName, IsPresent)
SELECT v.TableName, v.ColumnName,
       CASE WHEN COL_LENGTH(v.TableName, v.ColumnName) IS NOT NULL THEN 1 ELSE 0 END
FROM (VALUES
    ('dbo.ProjectBoqItems', 'InventoryItemId'),
    ('dbo.ProjectBoqItems', 'UnitPrice'),
    ('dbo.ProjectEquipmentItems', 'InventoryItemId'),
    ('dbo.ProjectDrawings', 'OriginalFileName'),
    ('dbo.ProjectDrawings', 'StoredFileName'),
    ('dbo.ProjectDrawings', 'FilePath'),
    ('dbo.ProjectDrawings', 'ContentType'),
    ('dbo.ProjectDrawings', 'FileSizeBytes')
) AS v(TableName, ColumnName);

PRINT '--- Required column presence ---';
SELECT
    TableName,
    ColumnName,
    CASE WHEN IsPresent = 1 THEN 'PASS' ELSE 'FAIL' END AS CheckResult
FROM @RequiredColumns
ORDER BY TableName, ColumnName;

IF EXISTS (SELECT 1 FROM @RequiredColumns WHERE IsPresent = 0)
BEGIN
    PRINT '';
    PRINT 'WARNING: One or more required columns are missing.';
    PRINT 'Apply migration database/migrations/2026-06-11_project_inventory_drawings_files.sql first.';
    PRINT 'Do NOT run the SP patch until columns exist.';
END;

PRINT '';

/* -------------------------------------------------------------------------- */
/* Procedure inventory + modify dates */
/* -------------------------------------------------------------------------- */
DECLARE @TargetProcedures TABLE (
    ProcedureName SYSNAME NOT NULL PRIMARY KEY,
    SortOrder INT NOT NULL
);

INSERT INTO @TargetProcedures (ProcedureName, SortOrder) VALUES
    (N'sp_ProjectBoq_Create', 10),
    (N'sp_ProjectBoq_Update', 20),
    (N'sp_ProjectBoq_GetByProject', 30),
    (N'sp_ProjectEquipment_Create', 40),
    (N'sp_ProjectEquipment_Update', 50),
    (N'sp_ProjectEquipment_GetByProject', 60),
    (N'sp_ProjectDrawings_Create', 70),
    (N'sp_ProjectDrawings_GetByProject', 80),
    (N'sp_WorkItems_DeleteTask', 90),
    (N'sp_WorkReports_Update', 100);

PRINT '--- Procedure existence and modify dates ---';
SELECT
    tp.ProcedureName,
    CASE WHEN p.object_id IS NULL THEN 'MISSING' ELSE 'EXISTS' END AS ObjectState,
    p.create_date,
    p.modify_date
FROM @TargetProcedures tp
LEFT JOIN sys.procedures p
    ON p.name = tp.ProcedureName
   AND p.schema_id = SCHEMA_ID(N'dbo')
ORDER BY tp.SortOrder;

PRINT '';

/* -------------------------------------------------------------------------- */
/* Parameter checks (canonical repository markers) */
/* -------------------------------------------------------------------------- */
DECLARE @ParamChecks TABLE (
    ProcedureName SYSNAME NOT NULL,
    ParameterName SYSNAME NOT NULL,
    IsPresent BIT NOT NULL
);

INSERT INTO @ParamChecks (ProcedureName, ParameterName, IsPresent)
SELECT v.ProcedureName, v.ParameterName,
       CASE WHEN pr.object_id IS NOT NULL THEN 1 ELSE 0 END
FROM (VALUES
    (N'sp_ProjectBoq_Create', N'@InventoryItemId'),
    (N'sp_ProjectBoq_Create', N'@UnitPrice'),
    (N'sp_ProjectBoq_Update', N'@InventoryItemId'),
    (N'sp_ProjectBoq_Update', N'@UnitPrice'),
    (N'sp_ProjectEquipment_Create', N'@InventoryItemId'),
    (N'sp_ProjectEquipment_Update', N'@InventoryItemId'),
    (N'sp_ProjectDrawings_Create', N'@OriginalFileName'),
    (N'sp_ProjectDrawings_Create', N'@StoredFileName'),
    (N'sp_ProjectDrawings_Create', N'@FilePath'),
    (N'sp_ProjectDrawings_Create', N'@ContentType'),
    (N'sp_ProjectDrawings_Create', N'@FileSizeBytes'),
    (N'sp_WorkReports_Update', N'@UpdatedByUserId')
) AS v(ProcedureName, ParameterName)
LEFT JOIN sys.procedures p
    ON p.name = v.ProcedureName
   AND p.schema_id = SCHEMA_ID(N'dbo')
LEFT JOIN sys.parameters pr
    ON pr.object_id = p.object_id
   AND pr.name = v.ParameterName;

PRINT '--- Canonical parameter markers ---';
SELECT
    ProcedureName,
    ParameterName,
    CASE
        WHEN IsPresent = 1 THEN 'PASS'
        WHEN EXISTS (
            SELECT 1 FROM sys.procedures sp
            WHERE sp.name = pc.ProcedureName AND sp.schema_id = SCHEMA_ID(N'dbo')
        ) THEN 'NEEDS_PATCH'
        ELSE 'FAIL'
    END AS CheckResult
FROM @ParamChecks pc
ORDER BY ProcedureName, ParameterName;

PRINT '';

/* -------------------------------------------------------------------------- */
/* Body/content markers (old vs new SP definitions) */
/* -------------------------------------------------------------------------- */
DECLARE @BodyChecks TABLE (
    ProcedureName SYSNAME NOT NULL PRIMARY KEY,
    HasCanonicalBody BIT NOT NULL,
    Notes NVARCHAR(400) NOT NULL
);

INSERT INTO @BodyChecks (ProcedureName, HasCanonicalBody, Notes)
SELECT tp.ProcedureName,
       CASE tp.ProcedureName
           WHEN N'sp_ProjectBoq_GetByProject' THEN
               CASE WHEN CHARINDEX(N'InventorySkuCode', m.definition) > 0
                         AND CHARINDEX(N'UnitPrice', m.definition) > 0 THEN 1 ELSE 0 END
           WHEN N'sp_ProjectEquipment_GetByProject' THEN
               CASE WHEN CHARINDEX(N'InventorySkuCode', m.definition) > 0 THEN 1 ELSE 0 END
           WHEN N'sp_ProjectDrawings_GetByProject' THEN
               CASE WHEN CHARINDEX(N'OriginalFileName', m.definition) > 0
                         AND CHARINDEX(N'FileSizeBytes', m.definition) > 0 THEN 1 ELSE 0 END
           WHEN N'sp_WorkItems_DeleteTask' THEN
               CASE WHEN CHARINDEX(N'המשימה לא נמצאה', m.definition) > 0 THEN 1 ELSE 0 END
           WHEN N'sp_WorkReports_Update' THEN
               CASE WHEN CHARINDEX(N'LifecycleStatus', m.definition) > 0
                         AND CHARINDEX(N'UpdatedByUserId', m.definition) > 0
                         AND CHARINDEX(N'טיוטה', m.definition) > 0 THEN 1 ELSE 0 END
           ELSE 1
       END,
       CASE tp.ProcedureName
           WHEN N'sp_ProjectBoq_GetByProject' THEN N'Expect InventoryItems join + UnitPrice in SELECT'
           WHEN N'sp_ProjectEquipment_GetByProject' THEN N'Expect InventoryItems join in SELECT'
           WHEN N'sp_ProjectDrawings_GetByProject' THEN N'Expect file metadata columns in SELECT'
           WHEN N'sp_WorkItems_DeleteTask' THEN N'Expect readable Hebrew user messages (not mojibake)'
           WHEN N'sp_WorkReports_Update' THEN N'Expect LifecycleStatus guard + UpdatedByUserId + Hebrew default status'
           ELSE N'Parameter markers are the primary body signal for Create/Update procedures'
       END
FROM @TargetProcedures tp
LEFT JOIN sys.procedures p
    ON p.name = tp.ProcedureName
   AND p.schema_id = SCHEMA_ID(N'dbo')
LEFT JOIN sys.sql_modules m
    ON m.object_id = p.object_id;

PRINT '--- Body/content markers ---';
SELECT
    bc.ProcedureName,
    CASE
        WHEN p.object_id IS NULL THEN 'FAIL'
        WHEN bc.ProcedureName IN (
            N'sp_ProjectBoq_Create', N'sp_ProjectBoq_Update',
            N'sp_ProjectEquipment_Create', N'sp_ProjectEquipment_Update',
            N'sp_ProjectDrawings_Create'
        ) THEN
            CASE WHEN EXISTS (
                SELECT 1 FROM @ParamChecks pc
                WHERE pc.ProcedureName = bc.ProcedureName AND pc.IsPresent = 0
            ) THEN 'NEEDS_PATCH' ELSE 'PASS' END
        WHEN bc.HasCanonicalBody = 1 THEN 'PASS'
        ELSE 'NEEDS_PATCH'
    END AS CheckResult,
    bc.Notes
FROM @BodyChecks bc
LEFT JOIN sys.procedures p
    ON p.name = bc.ProcedureName
   AND p.schema_id = SCHEMA_ID(N'dbo')
ORDER BY bc.ProcedureName;

PRINT '';

/* -------------------------------------------------------------------------- */
/* Mojibake detection (Hebrew corruption heuristic) */
/* -------------------------------------------------------------------------- */
PRINT '--- Mojibake heuristic (sp_WorkItems_DeleteTask, sp_WorkReports_Update) ---';
SELECT
    p.name AS ProcedureName,
    CASE
        WHEN p.object_id IS NULL THEN 'FAIL'
        WHEN CHARINDEX(N'×', m.definition) > 0
          OR CHARINDEX(N'Ã', m.definition) > 0
          OR CHARINDEX(N'Ø', m.definition) > 0 THEN 'NEEDS_PATCH'
        WHEN p.name = N'sp_WorkItems_DeleteTask'
             AND CHARINDEX(N'המשימה לא נמצאה', m.definition) = 0 THEN 'NEEDS_PATCH'
        WHEN p.name = N'sp_WorkReports_Update'
             AND CHARINDEX(N'טיוטה', m.definition) = 0 THEN 'NEEDS_PATCH'
        ELSE 'PASS'
    END AS MojibakeCheck
FROM sys.procedures p
INNER JOIN sys.sql_modules m ON m.object_id = p.object_id
WHERE p.name IN (N'sp_WorkItems_DeleteTask', N'sp_WorkReports_Update')
  AND p.schema_id = SCHEMA_ID(N'dbo');

PRINT '';

/* -------------------------------------------------------------------------- */
/* Per-procedure summary */
/* -------------------------------------------------------------------------- */
PRINT '--- Per-procedure deployment summary ---';
;WITH Summary AS (
    SELECT
        tp.ProcedureName,
        tp.SortOrder,
        CASE WHEN p.object_id IS NULL THEN 0 ELSE 1 END AS ProcedureExists,
        CASE WHEN EXISTS (
            SELECT 1 FROM @RequiredColumns rc WHERE rc.IsPresent = 0
        ) THEN 0 ELSE 1 END AS ColumnsReady,
        CASE WHEN EXISTS (
            SELECT 1 FROM @ParamChecks pc
            WHERE pc.ProcedureName = tp.ProcedureName AND pc.IsPresent = 0
        ) THEN 0 ELSE 1 END AS ParamsReady,
        bc.HasCanonicalBody,
        p.modify_date
    FROM @TargetProcedures tp
    LEFT JOIN sys.procedures p
        ON p.name = tp.ProcedureName
       AND p.schema_id = SCHEMA_ID(N'dbo')
    LEFT JOIN @BodyChecks bc ON bc.ProcedureName = tp.ProcedureName
)
SELECT
    s.ProcedureName,
    s.modify_date AS LastModifyDate,
    CASE
        WHEN s.ProcedureExists = 0 THEN 'FAIL'
        WHEN s.ColumnsReady = 0 AND s.ProcedureName LIKE 'sp_Project%' THEN 'FAIL'
        WHEN s.ProcedureName IN (
            N'sp_ProjectBoq_Create', N'sp_ProjectBoq_Update',
            N'sp_ProjectEquipment_Create', N'sp_ProjectEquipment_Update',
            N'sp_ProjectDrawings_Create'
        ) AND s.ParamsReady = 0 THEN 'NEEDS_PATCH'
        WHEN s.ProcedureName IN (
            N'sp_ProjectBoq_GetByProject', N'sp_ProjectEquipment_GetByProject',
            N'sp_ProjectDrawings_GetByProject', N'sp_WorkItems_DeleteTask', N'sp_WorkReports_Update'
        ) AND s.HasCanonicalBody = 0 THEN 'NEEDS_PATCH'
        ELSE 'PASS'
    END AS DeploymentStatus
FROM Summary s
ORDER BY s.SortOrder;

PRINT '';
PRINT 'Interpretation:';
PRINT '  PASS         = already matches repository canonical markers; patch optional for that SP';
PRINT '  NEEDS_PATCH  = stale definition; include in deployment patch';
PRINT '  FAIL         = missing object or prerequisite columns; resolve before patching';
PRINT '';
PRINT 'Optional deferred procedure (not in patch): sp_WorkItems_GetInternalContext';
SELECT
    N'sp_WorkItems_GetInternalContext' AS ProcedureName,
    CASE WHEN p.object_id IS NULL THEN 'NOT_DEPLOYED' ELSE 'EXISTS' END AS ObjectState,
    p.modify_date AS LastModifyDate,
    N'DEPRECATED endpoint (HTTP 410); patch optional/deferred' AS Note
FROM (SELECT 1 AS x) d
LEFT JOIN sys.procedures p
    ON p.name = N'sp_WorkItems_GetInternalContext'
   AND p.schema_id = SCHEMA_ID(N'dbo');

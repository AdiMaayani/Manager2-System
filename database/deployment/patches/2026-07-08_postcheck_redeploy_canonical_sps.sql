/*
================================================================================
ManageR2 — READ-ONLY post-deployment verification (2026-07-08)
================================================================================
Purpose: Confirm database/deployment/patches/2026-07-08_redeploy_current_canonical_sps.sql
         applied successfully.

This script is READ-ONLY. It does not modify schema, data, permissions, or settings.
Run immediately after the deployment patch on the same target database.

Expected outcome: PASS for all 10 patched procedures unless deployment was partial.
================================================================================
*/

SET NOCOUNT ON;

DECLARE @DeploymentUtc DATETIME2(7) = SYSUTCDATETIME();

PRINT '=== ManageR2 SP redeploy post-check (read-only) ===';
PRINT 'Run at: ' + CONVERT(VARCHAR(30), @DeploymentUtc, 126) + ' UTC';
PRINT 'Server: ' + @@SERVERNAME;
PRINT 'Database: ' + DB_NAME();
PRINT '';

DECLARE @Results TABLE (
    ProcedureName SYSNAME NOT NULL,
    SortOrder INT NOT NULL,
    CheckCategory NVARCHAR(60) NOT NULL,
    CheckResult NVARCHAR(20) NOT NULL,
    Detail NVARCHAR(400) NULL
);

/* --- 1. All 10 procedures exist --- */
INSERT INTO @Results (ProcedureName, SortOrder, CheckCategory, CheckResult, Detail)
SELECT
    v.ProcedureName,
    v.SortOrder,
    N'Object exists',
    CASE WHEN p.object_id IS NOT NULL THEN N'PASS' ELSE N'FAIL' END,
    CASE WHEN p.object_id IS NOT NULL
         THEN N'Procedure present in dbo schema'
         ELSE N'Procedure missing after patch' END
FROM (VALUES
    (N'sp_ProjectBoq_Create', 10),
    (N'sp_ProjectBoq_Update', 20),
    (N'sp_ProjectBoq_GetByProject', 30),
    (N'sp_ProjectEquipment_Create', 40),
    (N'sp_ProjectEquipment_Update', 50),
    (N'sp_ProjectEquipment_GetByProject', 60),
    (N'sp_ProjectDrawings_Create', 70),
    (N'sp_ProjectDrawings_GetByProject', 80),
    (N'sp_WorkItems_DeleteTask', 90),
    (N'sp_WorkReports_Update', 100)
) AS v(ProcedureName, SortOrder)
LEFT JOIN sys.procedures p
    ON p.name = v.ProcedureName
   AND p.schema_id = SCHEMA_ID(N'dbo');

/* --- 2. BOQ / Equipment / Drawings parameter markers --- */
INSERT INTO @Results (ProcedureName, SortOrder, CheckCategory, CheckResult, Detail)
SELECT
    v.ProcedureName,
    v.SortOrder,
    N'Parameter: ' + v.ParameterName,
    CASE WHEN pr.object_id IS NOT NULL THEN N'PASS' ELSE N'FAIL' END,
    CASE WHEN pr.object_id IS NOT NULL
         THEN N'Canonical parameter present'
         ELSE N'Expected parameter missing' END
FROM (VALUES
    (N'sp_ProjectBoq_Create', 10, N'@InventoryItemId'),
    (N'sp_ProjectBoq_Create', 10, N'@UnitPrice'),
    (N'sp_ProjectBoq_Update', 20, N'@InventoryItemId'),
    (N'sp_ProjectBoq_Update', 20, N'@UnitPrice'),
    (N'sp_ProjectEquipment_Create', 40, N'@InventoryItemId'),
    (N'sp_ProjectEquipment_Update', 50, N'@InventoryItemId'),
    (N'sp_ProjectDrawings_Create', 70, N'@OriginalFileName'),
    (N'sp_ProjectDrawings_Create', 70, N'@StoredFileName'),
    (N'sp_ProjectDrawings_Create', 70, N'@FilePath'),
    (N'sp_ProjectDrawings_Create', 70, N'@ContentType'),
    (N'sp_ProjectDrawings_Create', 70, N'@FileSizeBytes'),
    (N'sp_WorkReports_Update', 100, N'@UpdatedByUserId')
) AS v(ProcedureName, SortOrder, ParameterName)
LEFT JOIN sys.procedures p
    ON p.name = v.ProcedureName
   AND p.schema_id = SCHEMA_ID(N'dbo')
LEFT JOIN sys.parameters pr
    ON pr.object_id = p.object_id
   AND pr.name = v.ParameterName;

/* --- 3. GetByProject body markers --- */
INSERT INTO @Results (ProcedureName, SortOrder, CheckCategory, CheckResult, Detail)
SELECT
    v.ProcedureName,
    v.SortOrder,
    N'Body marker',
    CASE
        WHEN p.object_id IS NULL THEN N'FAIL'
        WHEN v.ProcedureName = N'sp_ProjectBoq_GetByProject'
             AND CHARINDEX(N'InventorySkuCode', m.definition) > 0
             AND CHARINDEX(N'UnitPrice', m.definition) > 0 THEN N'PASS'
        WHEN v.ProcedureName = N'sp_ProjectEquipment_GetByProject'
             AND CHARINDEX(N'InventorySkuCode', m.definition) > 0 THEN N'PASS'
        WHEN v.ProcedureName = N'sp_ProjectDrawings_GetByProject'
             AND CHARINDEX(N'OriginalFileName', m.definition) > 0
             AND CHARINDEX(N'FileSizeBytes', m.definition) > 0 THEN N'PASS'
        ELSE N'FAIL'
    END,
    N'Canonical SELECT/join markers in procedure body'
FROM (VALUES
    (N'sp_ProjectBoq_GetByProject', 30),
    (N'sp_ProjectEquipment_GetByProject', 60),
    (N'sp_ProjectDrawings_GetByProject', 80)
) AS v(ProcedureName, SortOrder)
LEFT JOIN sys.procedures p
    ON p.name = v.ProcedureName
   AND p.schema_id = SCHEMA_ID(N'dbo')
LEFT JOIN sys.sql_modules m ON m.object_id = p.object_id;

/* --- 4. Mojibake / Hebrew readability --- */
INSERT INTO @Results (ProcedureName, SortOrder, CheckCategory, CheckResult, Detail)
SELECT
    p.name,
    CASE p.name WHEN N'sp_WorkItems_DeleteTask' THEN 90 ELSE 100 END,
    N'Hebrew readability',
    CASE
        WHEN CHARINDEX(N'×', m.definition) > 0
          OR CHARINDEX(N'Ã', m.definition) > 0 THEN N'FAIL'
        WHEN p.name = N'sp_WorkItems_DeleteTask'
             AND CHARINDEX(N'המשימה לא נמצאה', m.definition) > 0
             AND CHARINDEX(N'המשימה נמחקה בהצלחה', m.definition) > 0 THEN N'PASS'
        WHEN p.name = N'sp_WorkReports_Update'
             AND CHARINDEX(N'טיוטה', m.definition) > 0
             AND CHARINDEX(N'LifecycleStatus', m.definition) > 0 THEN N'PASS'
        ELSE N'FAIL'
    END,
    N'No mojibake markers; expected Hebrew literals present'
FROM sys.procedures p
INNER JOIN sys.sql_modules m ON m.object_id = p.object_id
WHERE p.name IN (N'sp_WorkItems_DeleteTask', N'sp_WorkReports_Update')
  AND p.schema_id = SCHEMA_ID(N'dbo');

/* --- 5. Modify dates (informational) --- */
PRINT '--- Procedure modify dates (should be near deployment time) ---';
SELECT
    p.name AS ProcedureName,
    p.modify_date AS LastModifyDate,
    DATEDIFF(MINUTE, p.modify_date, @DeploymentUtc) AS MinutesBeforePostCheck
FROM sys.procedures p
WHERE p.name IN (
    N'sp_ProjectBoq_Create', N'sp_ProjectBoq_Update', N'sp_ProjectBoq_GetByProject',
    N'sp_ProjectEquipment_Create', N'sp_ProjectEquipment_Update', N'sp_ProjectEquipment_GetByProject',
    N'sp_ProjectDrawings_Create', N'sp_ProjectDrawings_GetByProject',
    N'sp_WorkItems_DeleteTask', N'sp_WorkReports_Update'
)
AND p.schema_id = SCHEMA_ID(N'dbo')
ORDER BY p.name;

PRINT '';
PRINT '--- Detailed check results ---';
SELECT ProcedureName, CheckCategory, CheckResult, Detail
FROM @Results
ORDER BY SortOrder, CheckCategory;

PRINT '';
PRINT '--- Per-procedure rollup ---';
;WITH Rollup AS (
    SELECT
        ProcedureName,
        MIN(SortOrder) AS SortOrder,
        SUM(CASE WHEN CheckResult = N'FAIL' THEN 1 ELSE 0 END) AS FailCount,
        SUM(CASE WHEN CheckResult = N'PASS' THEN 1 ELSE 0 END) AS PassCount
    FROM @Results
    GROUP BY ProcedureName
)
SELECT
    ProcedureName,
    CASE WHEN FailCount > 0 THEN N'FAIL' ELSE N'PASS' END AS OverallResult,
    PassCount,
    FailCount
FROM Rollup
ORDER BY SortOrder;

DECLARE @TotalFail INT = (SELECT COUNT(*) FROM @Results WHERE CheckResult = N'FAIL');
PRINT '';
IF @TotalFail = 0
    PRINT 'OVERALL: PASS — all post-deployment checks succeeded.';
ELSE
    PRINT 'OVERALL: FAIL — ' + CAST(@TotalFail AS VARCHAR(10)) + ' check(s) failed. Review results above.';

/* --- 6. Sanity: unrelated procedures unchanged count (informational only) --- */
PRINT '';
PRINT '--- Informational: total dbo procedures (unexpected mass change indicator) ---';
SELECT COUNT(*) AS TotalDboProcedures
FROM sys.procedures
WHERE schema_id = SCHEMA_ID(N'dbo');

PRINT '';
PRINT 'Note: This patch should only alter the 10 listed procedures.';
PRINT 'If Overall=FAIL, re-run the specific canonical file from database/SP/ for the failing procedure.';

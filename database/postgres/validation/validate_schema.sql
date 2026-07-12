-- =====================================================================
-- ManageR2 PostgreSQL schema validation (Phase 2)
-- Run after applying the schema scripts. Asserts the translated tables and
-- key constraints exist. Extend as more waves are translated.
-- Usage: psql -d manager2_dev -f validate_schema.sql
-- =====================================================================

\echo 'Translated baseline tables present (expect one row per table):'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    -- 01 core identity
    'Employees','Roles','Departments','Users','UserRoles','UserDepartments','CompanySettings',
    -- 02 customers/sites/contacts
    'Customers','Sites','Contacts',
    -- 03 workitems/projects/quotes
    'Contractors','WorkItems','ProjectMilestones','ProjectEquipmentItems','ProjectBoqItems','ProjectDrawings',
    'Quotes','QuoteLineItems','WorkEmployeeAssignments','WorkContractorAssignments',
    -- 04 inventory/workreports
    'InventoryItems','WorkReports','WorkReportEmployeeAssignments','WorkReportSystems',
    'WorkReportInventoryItems','WorkReportAttachments','InventoryStockMovements',
    -- 05 smartassignment
    'Rec_WorkZones','Rec_Skills','Rec_EmployeeAvailability','Rec_EmployeeBaseAddress',
    'Rec_EmployeeCapacity','Rec_EmployeeLocationEvents','Rec_EmployeePlannedStops',
    'Rec_EmployeeSkills','Rec_EmployeeWorkZones','Rec_RecommendationRuns','Rec_RouteEstimates',
    'Rec_SiteAddressProfile','Rec_TaskAssignmentRecommendations','Rec_WorkItemAlgorithmProfile',
    'Rec_WorkItemRequiredSkills'
  )
ORDER BY table_name;

\echo 'Expected: 42 rows above. Missing tables indicate an incomplete apply.'

\echo ''
\echo 'WorkReports lifecycle objects (expect 3 CHECKs + 4 FKs = 7 rows):'
SELECT conname FROM pg_constraint
WHERE conname IN ('CK_WorkReports_LifecycleStatus','CK_WorkReports_LifecycleMetadata','CK_WorkReports_NotSelfAmend',
                  'FK_WorkReports_FinalizedByUser','FK_WorkReports_ReversedByUser','FK_WorkReports_UpdatedByUser',
                  'FK_WorkReports_AmendsWorkReport')
ORDER BY conname;

\echo ''
\echo 'Inventory ledger idempotency guard (expect UX_InventoryStockMovements_Line_Type):'
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND indexname = 'UX_InventoryStockMovements_Line_Type';

\echo ''
\echo 'WorkReportInventoryItems upsert key (expect UQ_WorkReportInventoryItems_Report_Item_Usage):'
SELECT conname FROM pg_constraint
WHERE conname = 'UQ_WorkReportInventoryItems_Report_Item_Usage';

\echo ''
\echo 'WorkItems schedulable-category + milestone FK objects (expect 4 rows):'
SELECT conname FROM pg_constraint
WHERE conname IN ('CK_WorkItems_TypeCategory','CK_WorkItems_RegularNoProject',
                  'CK_WorkItems_ArchiveMetadata','FK_WorkItems_Milestone')
ORDER BY conname;

\echo ''
\echo 'Non-negative inventory guarantee present (expect CK_InventoryItems_QuantityOnHand_NonNegative):'
SELECT conname FROM pg_constraint
WHERE conrelid = '"InventoryItems"'::regclass AND contype = 'c'
  AND conname = 'CK_InventoryItems_QuantityOnHand_NonNegative';

\echo ''
\echo 'WorkReports Hebrew draft status default preserved (expect a default containing the Hebrew draft value):'
SELECT column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'WorkReports' AND column_name = 'Status';

\echo ''
\echo 'Key uniqueness constraints (expect Users email/username, Roles code, Departments name):'
SELECT conname
FROM pg_constraint
WHERE conname IN (
    'UQ_Users_Email','UQ_Users_Username','UQ_Roles_RoleCode','UQ_Departments_DepartmentName',
    'UQ_UserRoles_UserId_RoleId','UQ_UserDepartments_UserId_DepartmentId'
)
ORDER BY conname;

\echo ''
\echo 'Contacts CHECK constraints (expect 3):'
SELECT conname
FROM pg_constraint
WHERE conrelid = '"Contacts"'::regclass
  AND contype = 'c'
ORDER BY conname;

\echo ''
\echo 'CompanySettings single-row guard (expect CK_CompanySettings_SingleRow):'
SELECT conname
FROM pg_constraint
WHERE conrelid = '"CompanySettings"'::regclass
  AND contype = 'c';

\echo ''
\echo '=== Wave 5: SmartAssignment (Rec_*) ==='
\echo 'RecommendationRuns scope/status guards + FKs (expect 5 rows):'
SELECT conname FROM pg_constraint
WHERE conname IN ('CK_Rec_RecommendationRuns_ScopeType','CK_Rec_RecommendationRuns_RunStatus',
                  'FK_Rec_RecommendationRuns_Project_WorkItems','FK_Rec_RecommendationRuns_Task_WorkItems',
                  'FK_Rec_RecommendationRuns_Users')
ORDER BY conname;

\echo ''
\echo 'TaskAssignmentRecommendations write-path guards (expect uniqueness + rank/score/enum checks, 5 rows):'
SELECT conname FROM pg_constraint
WHERE conname IN ('UQ_Rec_TaskAssignmentRecommendations_Run_Task_Employee',
                  'CK_Rec_TaskAssignmentRecommendations_RankOrder',
                  'CK_Rec_TaskAssignmentRecommendations_TotalScore',
                  'CK_Rec_TaskAssignmentRecommendations_OriginTypeUsed',
                  'CK_Rec_TaskAssignmentRecommendations_UrgencyClass')
ORDER BY conname;

\echo ''
\echo 'Rec_* natural keys used by the algorithm input (expect 4 unique constraints):'
SELECT conname FROM pg_constraint
WHERE conname IN ('UQ_Rec_EmployeeSkills_EmployeeId_SkillId','UQ_Rec_WorkItemRequiredSkills_WorkItemId_SkillId',
                  'UQ_Rec_EmployeeBaseAddress_EmployeeId','UQ_Rec_SiteAddressProfile_SiteId')
ORDER BY conname;

\echo ''
\echo 'Recommendation ranking read index (expect IX_Rec_TaskAssignmentRecommendations_Run_Task_Rank):'
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND indexname = 'IX_Rec_TaskAssignmentRecommendations_Run_Task_Rank';

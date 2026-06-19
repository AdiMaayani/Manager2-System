/*
    Corrective migration (2026-06-19): replace WorkItems type/category CHECK constraints
    with NULL-safe CASE expressions.

    Rerunnable. Drops and recreates only CK_WorkItems_TypeCategory and
    CK_WorkItems_RegularNoProject. Does not mutate WorkItems data. Recreates both
    constraints WITH NOCHECK so they remain untrusted until legacy verification
    enables WITH CHECK.

    Run after the foundation migration and before the guarded INTERNAL migration.
    See database/RUNBOOK.md for execution order.
*/
SET NOCOUNT ON;
IF OBJECT_ID(N'dbo.WorkItems', N'U') IS NULL
    THROW 51450, 'WorkItems table missing; run the 2026-06-19 foundation migration first.', 1;
GO

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.WorkItems') AND name = N'CK_WorkItems_TypeCategory'
)
    ALTER TABLE dbo.WorkItems DROP CONSTRAINT CK_WorkItems_TypeCategory;
IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.WorkItems') AND name = N'CK_WorkItems_RegularNoProject'
)
    ALTER TABLE dbo.WorkItems DROP CONSTRAINT CK_WorkItems_RegularNoProject;
GO

ALTER TABLE dbo.WorkItems WITH NOCHECK ADD CONSTRAINT CK_WorkItems_TypeCategory CHECK (
    CASE
        WHEN IsArchived = 1 THEN 1
        WHEN WorkType = N'Project' AND TaskCategory IS NULL AND ParentWorkItemId IS NULL AND MilestoneId IS NULL THEN 1
        WHEN WorkType = N'Task' AND TaskCategory = N'Regular' AND ParentWorkItemId IS NULL AND MilestoneId IS NULL THEN 1
        WHEN WorkType = N'Task' AND TaskCategory = N'Project' AND ParentWorkItemId IS NOT NULL THEN 1
        WHEN WorkType = N'ServiceCall' AND TaskCategory = N'ServiceCall' AND ParentWorkItemId IS NULL AND MilestoneId IS NULL THEN 1
        ELSE 0
    END = 1
);

ALTER TABLE dbo.WorkItems WITH NOCHECK ADD CONSTRAINT CK_WorkItems_RegularNoProject CHECK (
    CASE
        WHEN IsArchived = 1 THEN 1
        WHEN WorkType <> N'Task' THEN 1
        WHEN TaskCategory IS NULL THEN 0
        WHEN TaskCategory <> N'Regular' THEN 1
        WHEN ParentWorkItemId IS NULL AND MilestoneId IS NULL THEN 1
        ELSE 0
    END = 1
);
GO

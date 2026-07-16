/*
================================================================================
ManageR2 — PostgreSQL: allow same-day project milestones (2026-07-16)
================================================================================

WARNING: Run only against the intended development/test PostgreSQL database.
This patch updates only "CK_ProjectMilestones_PlannedRange" on "ProjectMilestones".
It does not change data, ActualRange rules, or other constraints.

Parity target: PlannedEnd >= PlannedStart (same-day allowed), matching SQL Server
patch 2026-07-12_allow_same_day_project_milestones.sql and the API validators.

Idempotent: safe to re-run. Skips recreation when the constraint already allows >=.
================================================================================
*/

DO $$
DECLARE
    planned_range_definition text;
BEGIN
    IF to_regclass('public."ProjectMilestones"') IS NULL THEN
        RAISE EXCEPTION '"ProjectMilestones" does not exist in the selected database.';
    END IF;

    SELECT pg_get_constraintdef(c.oid)
    INTO planned_range_definition
    FROM pg_constraint c
    WHERE c.conname = 'CK_ProjectMilestones_PlannedRange'
      AND c.conrelid = '"ProjectMilestones"'::regclass
      AND c.contype = 'c';

    -- Already at the intended contract: both-null OR both-set with PlannedEnd >= PlannedStart.
    IF planned_range_definition IS NOT NULL
       AND position('"PlannedEnd" >= "PlannedStart"' IN planned_range_definition) > 0 THEN
        RAISE NOTICE 'CK_ProjectMilestones_PlannedRange already allows same-day planned milestones.';
        RETURN;
    END IF;

    IF planned_range_definition IS NOT NULL THEN
        ALTER TABLE "ProjectMilestones"
            DROP CONSTRAINT "CK_ProjectMilestones_PlannedRange";
    END IF;

    -- ADD CONSTRAINT validates existing rows against the new CHECK; failures surface clearly.
    ALTER TABLE "ProjectMilestones"
        ADD CONSTRAINT "CK_ProjectMilestones_PlannedRange" CHECK (
            ("PlannedStart" IS NULL AND "PlannedEnd" IS NULL) OR
            ("PlannedStart" IS NOT NULL AND "PlannedEnd" IS NOT NULL AND "PlannedEnd" >= "PlannedStart")
        );
END $$;

/*
READ-ONLY post-check
*/
SELECT
    c.conname AS constraint_name,
    pg_get_constraintdef(c.oid) AS planned_range_definition,
    CASE
        WHEN position('"PlannedEnd" >= "PlannedStart"' IN pg_get_constraintdef(c.oid)) > 0
            THEN 'PASS'
        ELSE 'FAIL'
    END AS same_day_planned_range
FROM pg_constraint c
WHERE c.conname = 'CK_ProjectMilestones_PlannedRange'
  AND c.conrelid = '"ProjectMilestones"'::regclass
  AND c.contype = 'c';

SELECT
    c.conname AS constraint_name,
    pg_get_constraintdef(c.oid) AS actual_range_definition,
    CASE
        WHEN position('"ActualEnd" > "ActualStart"' IN pg_get_constraintdef(c.oid)) > 0
             AND position('"ActualEnd" >= "ActualStart"' IN pg_get_constraintdef(c.oid)) = 0
            THEN 'PASS'
        ELSE 'FAIL'
    END AS actual_range_unchanged
FROM pg_constraint c
WHERE c.conname = 'CK_ProjectMilestones_ActualRange'
  AND c.conrelid = '"ProjectMilestones"'::regclass
  AND c.contype = 'c';

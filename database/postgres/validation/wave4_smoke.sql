-- =====================================================================
-- ManageR2 PostgreSQL Wave 4 smoke test (Reports + Inventory)
-- Exercises the schema and the exact SQL the C# transactional inventory
-- finalize/reverse orchestration issues (service-refactor of
-- sp_InventoryStockMovements_ApplyForReport): stock deltas, the immutable
-- movement ledger, per-line idempotency, and the insufficient-stock and
-- duplicate-movement guards. Everything runs inside one transaction that is
-- rolled back at the end, so the database is left untouched.
-- Usage: psql -d manager2_dev -f wave4_smoke.sql
-- =====================================================================

BEGIN;

DO $$
DECLARE
    v_item_a int;
    v_item_b int;
    v_report int;
    v_line_a_sold int;
    v_line_a_installed int;
    v_line_b_used int;
    v_qty_a numeric(18,3);
    v_qty_b numeric(18,3);
    v_count int;
    v_rows int;
BEGIN
    -- ---- Seed ----------------------------------------------------------
    INSERT INTO "InventoryItems" ("SkuCode","ItemName","QuantityOnHand","Unit","IsActive")
    VALUES ('W4-A','Wave4 Item A',100,'unit',true) RETURNING "InventoryItemId" INTO v_item_a;
    INSERT INTO "InventoryItems" ("SkuCode","ItemName","QuantityOnHand","Unit","IsActive")
    VALUES ('W4-B','Wave4 Item B',50,'unit',true) RETURNING "InventoryItemId" INTO v_item_b;

    INSERT INTO "WorkReports" ("ReportType","ProjectName","Status","LifecycleStatus")
    VALUES ('project','Wave4 Report','טיוטה','Draft') RETURNING "WorkReportId" INTO v_report;

    -- Two usage types on item A (aggregates to 14) plus item B (5).
    INSERT INTO "WorkReportInventoryItems" ("WorkReportId","InventoryItemId","Quantity","UsageType","SkuSnapshot","ItemNameSnapshot")
    VALUES (v_report,v_item_a,10,'Sold','W4-A','Wave4 Item A') RETURNING "WorkReportInventoryItemId" INTO v_line_a_sold;
    INSERT INTO "WorkReportInventoryItems" ("WorkReportId","InventoryItemId","Quantity","UsageType","SkuSnapshot","ItemNameSnapshot")
    VALUES (v_report,v_item_a,4,'Installed','W4-A','Wave4 Item A') RETURNING "WorkReportInventoryItemId" INTO v_line_a_installed;
    INSERT INTO "WorkReportInventoryItems" ("WorkReportId","InventoryItemId","Quantity","UsageType","SkuSnapshot","ItemNameSnapshot")
    VALUES (v_report,v_item_b,5,'Used','W4-B','Wave4 Item B') RETURNING "WorkReportInventoryItemId" INTO v_line_b_used;

    -- ---- FINALIZE (ReportUsage) ---------------------------------------
    -- Per-item aggregated decrement with the insufficient/inactive protection.
    UPDATE "InventoryItems" SET "QuantityOnHand" = "QuantityOnHand" - 14
    WHERE "InventoryItemId" = v_item_a AND "IsActive" = true AND "QuantityOnHand" >= 14;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'FINALIZE: expected item A decrement rowcount 1, got %', v_rows; END IF;

    UPDATE "InventoryItems" SET "QuantityOnHand" = "QuantityOnHand" - 5
    WHERE "InventoryItemId" = v_item_b AND "IsActive" = true AND "QuantityOnHand" >= 5;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'FINALIZE: expected item B decrement rowcount 1, got %', v_rows; END IF;

    INSERT INTO "InventoryStockMovements"
        ("InventoryItemId","WorkReportInventoryItemId","QuantityDelta","MovementType","SourceType","SourceId","UsageType")
    SELECT l."InventoryItemId", l."WorkReportInventoryItemId", -l."Quantity", 'ReportUsage', 'WorkReport', v_report, l."UsageType"
    FROM "WorkReportInventoryItems" l
    WHERE l."WorkReportId" = v_report
      AND NOT EXISTS (SELECT 1 FROM "InventoryStockMovements" m
                      WHERE m."WorkReportInventoryItemId" = l."WorkReportInventoryItemId" AND m."MovementType" = 'ReportUsage');

    UPDATE "WorkReports"
    SET "LifecycleStatus" = 'Finalized', "FinalizedAt" = (now() at time zone 'utc')
    WHERE "WorkReportId" = v_report;

    SELECT "QuantityOnHand" INTO v_qty_a FROM "InventoryItems" WHERE "InventoryItemId" = v_item_a;
    SELECT "QuantityOnHand" INTO v_qty_b FROM "InventoryItems" WHERE "InventoryItemId" = v_item_b;
    IF v_qty_a <> 86 THEN RAISE EXCEPTION 'FINALIZE: item A expected 86, got %', v_qty_a; END IF;
    IF v_qty_b <> 45 THEN RAISE EXCEPTION 'FINALIZE: item B expected 45, got %', v_qty_b; END IF;

    SELECT count(*) INTO v_count FROM "InventoryStockMovements"
    WHERE "SourceId" = v_report AND "MovementType" = 'ReportUsage';
    IF v_count <> 3 THEN RAISE EXCEPTION 'FINALIZE: expected 3 usage movements, got %', v_count; END IF;
    RAISE NOTICE 'FINALIZE ok: A=86 B=45, 3 usage movements written.';

    -- ---- IDEMPOTENCY: re-running the usage insert must add nothing -----
    INSERT INTO "InventoryStockMovements"
        ("InventoryItemId","WorkReportInventoryItemId","QuantityDelta","MovementType","SourceType","SourceId","UsageType")
    SELECT l."InventoryItemId", l."WorkReportInventoryItemId", -l."Quantity", 'ReportUsage', 'WorkReport', v_report, l."UsageType"
    FROM "WorkReportInventoryItems" l
    WHERE l."WorkReportId" = v_report
      AND NOT EXISTS (SELECT 1 FROM "InventoryStockMovements" m
                      WHERE m."WorkReportInventoryItemId" = l."WorkReportInventoryItemId" AND m."MovementType" = 'ReportUsage');
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 0 THEN RAISE EXCEPTION 'IDEMPOTENCY: re-run inserted % usage rows, expected 0', v_rows; END IF;
    RAISE NOTICE 'IDEMPOTENCY ok: repeat usage insert added 0 rows.';

    -- ---- REVERSE (ReportReversal) -------------------------------------
    UPDATE "InventoryItems" SET "QuantityOnHand" = "QuantityOnHand" + 14 WHERE "InventoryItemId" = v_item_a;
    UPDATE "InventoryItems" SET "QuantityOnHand" = "QuantityOnHand" + 5 WHERE "InventoryItemId" = v_item_b;

    INSERT INTO "InventoryStockMovements"
        ("InventoryItemId","WorkReportInventoryItemId","QuantityDelta","MovementType","SourceType","SourceId","UsageType")
    SELECT l."InventoryItemId", l."WorkReportInventoryItemId", l."Quantity", 'ReportReversal', 'WorkReport', v_report, l."UsageType"
    FROM "WorkReportInventoryItems" l
    WHERE l."WorkReportId" = v_report
      AND NOT EXISTS (SELECT 1 FROM "InventoryStockMovements" m
                      WHERE m."WorkReportInventoryItemId" = l."WorkReportInventoryItemId" AND m."MovementType" = 'ReportReversal');

    UPDATE "WorkReports"
    SET "LifecycleStatus" = 'Reversed', "ReversedAt" = (now() at time zone 'utc'), "ReversalReason" = 'smoke reverse'
    WHERE "WorkReportId" = v_report;

    SELECT "QuantityOnHand" INTO v_qty_a FROM "InventoryItems" WHERE "InventoryItemId" = v_item_a;
    SELECT "QuantityOnHand" INTO v_qty_b FROM "InventoryItems" WHERE "InventoryItemId" = v_item_b;
    IF v_qty_a <> 100 THEN RAISE EXCEPTION 'REVERSE: item A expected restored 100, got %', v_qty_a; END IF;
    IF v_qty_b <> 50 THEN RAISE EXCEPTION 'REVERSE: item B expected restored 50, got %', v_qty_b; END IF;
    SELECT count(*) INTO v_count FROM "InventoryStockMovements"
    WHERE "SourceId" = v_report AND "MovementType" = 'ReportReversal';
    IF v_count <> 3 THEN RAISE EXCEPTION 'REVERSE: expected 3 reversal movements, got %', v_count; END IF;
    RAISE NOTICE 'REVERSE ok: stock restored to 100/50, 3 reversal movements written.';

    -- ---- GUARD: insufficient stock decrement affects 0 rows -----------
    UPDATE "InventoryItems" SET "QuantityOnHand" = "QuantityOnHand" - 999
    WHERE "InventoryItemId" = v_item_a AND "IsActive" = true AND "QuantityOnHand" >= 999;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 0 THEN RAISE EXCEPTION 'GUARD: insufficient decrement should affect 0 rows, got %', v_rows; END IF;
    RAISE NOTICE 'GUARD ok: insufficient-stock decrement affected 0 rows (C# raises 51332).';

    -- ---- GUARD: duplicate (line, ReportUsage) movement is rejected -----
    BEGIN
        INSERT INTO "InventoryStockMovements"
            ("InventoryItemId","WorkReportInventoryItemId","QuantityDelta","MovementType","SourceType","SourceId","UsageType")
        VALUES (v_item_a, v_line_a_sold, -10, 'ReportUsage', 'WorkReport', v_report, 'Sold');
        RAISE EXCEPTION 'GUARD: duplicate usage movement was NOT rejected by the unique index';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'GUARD ok: duplicate (line, ReportUsage) movement rejected by UX index.';
    END;

    RAISE NOTICE 'WAVE 4 SMOKE: all assertions passed.';
END $$;

ROLLBACK;

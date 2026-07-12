-- Wave 3 functional smoke test (WorkItems / Milestones / Assignments / Quotes).
-- Exercises the Postgres SQL the Wave 3 repositories run: category-constrained inserts, the
-- work-plan assignment UNION, the schedule duration expression, the ROW_NUMBER PM projection,
-- Q-YYYY-#### numbering, ROUND line totals + totals recalculation, and the task-delete cascade.
-- Runs inside a DO block; asserts with RAISE EXCEPTION on any mismatch.
DO $$
DECLARE
    v_emp int; v_user int; v_cust int; v_site int; v_contractor int;
    v_project int; v_task int; v_milestone int; v_quote int;
    v_qnum text; v_prefix text; v_seq int;
    v_subtotal numeric; v_vat numeric; v_total numeric;
    v_dur int; v_service boolean; v_pm text; v_assignments int; v_remaining int;
BEGIN
    INSERT INTO "Employees" ("FullName", "PrimaryRole") VALUES ('W3 Emp', 'Technician') RETURNING "EmployeeId" INTO v_emp;
    INSERT INTO "Users" ("EmployeeId", "Username", "Email", "PasswordHash", "PasswordSalt", "IsActive", "CreatedAt")
        VALUES (v_emp, 'w3user', 'w3@example.com', 'hash', 'salt', true, now() at time zone 'utc') RETURNING "UserId" INTO v_user;
    INSERT INTO "Customers" ("CustomerName", "CustomerType", "IsActive", "CreatedAt", "CreatedByUserId")
        VALUES ('W3 Cust', 'Business', true, now() at time zone 'utc', v_user) RETURNING "CustomerId" INTO v_cust;
    INSERT INTO "Sites" ("CustomerId", "SiteName") VALUES (v_cust, 'W3 Site') RETURNING "SiteId" INTO v_site;
    INSERT INTO "Contractors" ("FullName") VALUES ('W3 Contractor') RETURNING "ContractorId" INTO v_contractor;

    -- Project container: WorkType='Project', TaskCategory NULL, no parent/milestone (CK_WorkItems_TypeCategory).
    INSERT INTO "WorkItems" ("Title", "WorkType", "TaskCategory", "Status", "CustomerId", "SiteId", "CreatedAt", "IsLocked")
        VALUES ('W3 Project', 'Project', NULL, 'Open', v_cust, v_site, now() at time zone 'utc', false)
        RETURNING "WorkItemId" INTO v_project;

    INSERT INTO "ProjectMilestones" ("ProjectId", "Title") VALUES (v_project, 'MS1') RETURNING "ProjectMilestoneId" INTO v_milestone;

    -- Project task: WorkType='Task', TaskCategory='Project', parent + milestone, planned 08:00->12:30 (270 min).
    INSERT INTO "WorkItems" ("Title", "WorkType", "TaskCategory", "Status", "CustomerId", "SiteId", "CreatedAt",
                             "ParentWorkItemId", "MilestoneId", "PlannedStart", "PlannedEnd", "EstimatedHours", "IsLocked")
        VALUES ('W3 Task', 'Task', 'Project', 'Open', v_cust, v_site, now() at time zone 'utc', v_project, v_milestone,
                timestamp '2026-07-10 08:00:00', timestamp '2026-07-10 12:30:00', 4.50, false)
        RETURNING "WorkItemId" INTO v_task;

    -- Assignments: manual employee (project) + task employee + task contractor.
    INSERT INTO "WorkEmployeeAssignments" ("WorkItemId", "EmployeeId", "AssignmentRole", "IsManualAssignment")
        VALUES (v_project, v_emp, 'Project Manager', true);
    INSERT INTO "WorkEmployeeAssignments" ("WorkItemId", "EmployeeId", "AssignmentRole", "AssignedHours", "IsManualAssignment")
        VALUES (v_task, v_emp, 'Technician', NULL, true);
    INSERT INTO "WorkContractorAssignments" ("WorkItemId", "ContractorId", "AssignmentRole")
        VALUES (v_task, v_contractor, 'Electrician');

    -- Schedule duration expression + IsServiceCall boolean (from ScheduledTasksSql).
    SELECT (EXTRACT(EPOCH FROM ("PlannedEnd" - "PlannedStart")) / 60)::int, ("WorkType" = 'ServiceCall')
    INTO v_dur, v_service FROM "WorkItems" WHERE "WorkItemId" = v_task;
    IF v_dur <> 270 THEN RAISE EXCEPTION 'FAIL: derived duration % expected 270', v_dur; END IF;
    IF v_service THEN RAISE EXCEPTION 'FAIL: IsServiceCall should be false'; END IF;

    -- ROW_NUMBER PM projection (sp_GetProjectsList): role match is case-insensitive + trimmed.
    SELECT COALESCE(pm."FullName", '-') INTO v_pm
    FROM "WorkItems" wi
    LEFT JOIN (
        SELECT wea."WorkItemId", e."FullName",
               ROW_NUMBER() OVER (PARTITION BY wea."WorkItemId"
                   ORDER BY wea."AssignedAt" DESC, wea."WorkEmployeeAssignmentId" DESC) AS "RowNum"
        FROM "WorkEmployeeAssignments" wea
        INNER JOIN "Employees" e ON wea."EmployeeId" = e."EmployeeId"
        WHERE btrim(lower(wea."AssignmentRole")) IN ('project manager', 'מנהל פרויקט', 'team leader')
    ) pm ON wi."WorkItemId" = pm."WorkItemId" AND pm."RowNum" = 1
    WHERE wi."WorkItemId" = v_project;
    IF v_pm <> 'W3 Emp' THEN RAISE EXCEPTION 'FAIL: project manager name % expected W3 Emp', v_pm; END IF;

    -- Work-plan assignments UNION (project + children): 2 employees + 1 contractor.
    WITH "RelevantWorkItems" AS (
        SELECT "WorkItemId" FROM "WorkItems" WHERE "WorkItemId" = v_project
        UNION SELECT "WorkItemId" FROM "WorkItems" WHERE "ParentWorkItemId" = v_project
    )
    SELECT count(*) INTO v_assignments FROM (
        SELECT wea."WorkItemId" FROM "WorkEmployeeAssignments" wea
        INNER JOIN "RelevantWorkItems" rwi ON wea."WorkItemId" = rwi."WorkItemId"
        UNION ALL
        SELECT wca."WorkItemId" FROM "WorkContractorAssignments" wca
        INNER JOIN "RelevantWorkItems" rwi ON wca."WorkItemId" = rwi."WorkItemId"
    ) x;
    IF v_assignments <> 3 THEN RAISE EXCEPTION 'FAIL: work plan assignments % expected 3', v_assignments; END IF;

    -- Quote number generation (Q-YYYY-#### via regex + RIGHT sequence) then header insert.
    v_prefix := 'Q-' || (EXTRACT(YEAR FROM (now() at time zone 'utc'))::int)::text || '-';
    SELECT COALESCE(MAX(CAST(RIGHT("QuoteNumber", 4) AS integer)), 0) + 1 INTO v_seq
    FROM "Quotes" WHERE "QuoteNumber" ~ ('^' || replace(v_prefix, '-', '\-') || '[0-9]{4}$');
    v_qnum := v_prefix || lpad(v_seq::text, 4, '0');

    INSERT INTO "Quotes" ("QuoteNumber", "CustomerId", "ProjectId", "QuoteDate", "Status", "VatRate",
                          "Subtotal", "VatAmount", "Total", "IsActive", "CreatedAt", "CreatedByUserId")
        VALUES (v_qnum, v_cust, v_project, date '2026-07-08', 'Draft', 17.00, 0, 0, 0, true, now() at time zone 'utc', v_user)
        RETURNING "QuoteId" INTO v_quote;

    -- Two lines: LineTotal = ROUND(Quantity * UnitPrice, 2).
    INSERT INTO "QuoteLineItems" ("QuoteId", "Description", "Quantity", "Unit", "UnitPrice", "LineTotal", "SortOrder", "CreatedAt")
        VALUES (v_quote, 'Item A', 2, 'unit', 100.00, ROUND(2 * 100.00, 2), 1, now() at time zone 'utc');
    INSERT INTO "QuoteLineItems" ("QuoteId", "Description", "Quantity", "Unit", "UnitPrice", "LineTotal", "SortOrder", "CreatedAt")
        VALUES (v_quote, 'Item B', 1.5, 'unit', 50.00, ROUND(1.5 * 50.00, 2), 2, now() at time zone 'utc');

    -- Totals recalculation (mirrors RecalculateTotalsAsync FROM-subquery UPDATE).
    UPDATE "Quotes" q
    SET "Subtotal" = t."Subtotal",
        "VatAmount" = ROUND(t."Subtotal" * q."VatRate" / 100.0, 2),
        "Total" = t."Subtotal" + ROUND(t."Subtotal" * q."VatRate" / 100.0, 2),
        "UpdatedAt" = (now() at time zone 'utc')
    FROM (SELECT COALESCE(SUM("LineTotal"), 0) AS "Subtotal" FROM "QuoteLineItems" WHERE "QuoteId" = v_quote) t
    WHERE q."QuoteId" = v_quote;

    SELECT "Subtotal", "VatAmount", "Total" INTO v_subtotal, v_vat, v_total FROM "Quotes" WHERE "QuoteId" = v_quote;
    IF v_subtotal <> 275.00 THEN RAISE EXCEPTION 'FAIL: subtotal % expected 275.00', v_subtotal; END IF;
    IF v_vat <> 46.75 THEN RAISE EXCEPTION 'FAIL: vat % expected 46.75', v_vat; END IF;
    IF v_total <> 321.75 THEN RAISE EXCEPTION 'FAIL: total % expected 321.75', v_total; END IF;
    RAISE NOTICE 'Quote % totals: subtotal=% vat=% total=%', v_qnum, v_subtotal, v_vat, v_total;

    -- Task delete cascade (sp_WorkItems_DeleteTask happy path): assignments removed, task gone.
    DELETE FROM "WorkEmployeeAssignments" WHERE "WorkItemId" = v_task;
    DELETE FROM "WorkContractorAssignments" WHERE "WorkItemId" = v_task;
    DELETE FROM "WorkItems" WHERE "WorkItemId" = v_task AND "WorkType" = 'Task';
    GET DIAGNOSTICS v_remaining = ROW_COUNT;
    IF v_remaining <> 1 THEN RAISE EXCEPTION 'FAIL: task delete affected % rows expected 1', v_remaining; END IF;

    -- Category CHECK enforcement: a Regular task must not carry a parent.
    BEGIN
        INSERT INTO "WorkItems" ("Title", "WorkType", "TaskCategory", "Status", "CustomerId", "CreatedAt", "ParentWorkItemId", "IsLocked")
            VALUES ('Bad Regular', 'Task', 'Regular', 'Open', v_cust, now() at time zone 'utc', v_project, false);
        RAISE EXCEPTION 'FAIL: Regular task with parent should violate CHECK';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'CHECK correctly rejected Regular task with parent.';
    END;

    RAISE NOTICE 'WAVE3_SMOKE_OK';
    RAISE EXCEPTION 'ROLLBACK_SENTINEL';
EXCEPTION
    WHEN raise_exception THEN
        IF SQLERRM = 'ROLLBACK_SENTINEL' THEN
            RAISE NOTICE 'Rolled back smoke data (expected).';
        ELSE
            RAISE;
        END IF;
END $$;

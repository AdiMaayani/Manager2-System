-- =====================================================================
-- ManageR2 PostgreSQL Wave 5 smoke test (SmartAssignment / Rec_*)
-- Exercises the exact SQL that PostgresSmartAssignmentRepository issues for
-- the recommendation-input result sets (RS3 eligibility, RS5 availability
-- window, RS8 site address, RS12 route estimates, RS13 current load with
-- current-task exclusion, RS14 project/customer/site continuity) and the two
-- write paths (Rec_CreateRecommendationRun RETURNING id +
-- Rec_SaveTaskAssignmentRecommendation) including the unique-key and
-- rank/score CHECK guards. Scoring itself stays in C# (SmartAssignmentService,
-- covered by unit tests) and is intentionally out of scope here.
-- Everything runs inside one transaction that is rolled back, so the database
-- is left untouched.
-- Usage: psql -d manager2_dev -f wave5_smoke.sql
-- =====================================================================

BEGIN;

DO $$
DECLARE
    v_emp_eligible  int;
    v_emp_wrongrole int;
    v_emp_inactive  int;
    v_user          int;
    v_customer      int;
    v_site          int;
    v_project       int;
    v_task          int;
    v_task_prior    int;
    v_skill         int;
    v_run           int;
    v_count         int;
    v_bool          boolean;
    v_hours         numeric(10,2);
    v_open          int;
    -- Task algorithm window (matches PostgresSmartAssignmentRepository params).
    v_start         timestamp := timestamp '2026-03-10 09:00:00';
    v_end           timestamp := timestamp '2026-03-10 12:00:00';
BEGIN
    -- ---- Seed employees (RS3 eligibility: active AND assignable only) ----
    INSERT INTO "Employees" ("FullName","PrimaryRole","IsActive","IsAssignable","DailyCapacityHours")
    VALUES ('דנה כהן','טכנאי',true,true,8) RETURNING "EmployeeId" INTO v_emp_eligible;
    INSERT INTO "Employees" ("FullName","PrimaryRole","IsActive","IsAssignable","DailyCapacityHours")
    VALUES ('רון לוי','חשמלאי',true,true,8) RETURNING "EmployeeId" INTO v_emp_wrongrole;
    INSERT INTO "Employees" ("FullName","PrimaryRole","IsActive","IsAssignable","DailyCapacityHours")
    VALUES ('עובד לא פעיל','טכנאי',false,true,8) RETURNING "EmployeeId" INTO v_emp_inactive;

    INSERT INTO "Users" ("EmployeeId","Username","Email","PasswordHash")
    VALUES (v_emp_eligible,'w5_smoke','w5_smoke@example.com','x') RETURNING "UserId" INTO v_user;

    INSERT INTO "Customers" ("CustomerName","CustomerType","CreatedByUserId")
    VALUES ('לקוח מבחן','Business',v_user) RETURNING "CustomerId" INTO v_customer;
    INSERT INTO "Sites" ("CustomerId","SiteName","City")
    VALUES (v_customer,'אתר מרכזי','תל אביב') RETURNING "SiteId" INTO v_site;

    INSERT INTO "Rec_SiteAddressProfile" ("SiteId","FormattedAddress","City")
    VALUES (v_site,'רחוב הרצל 1, תל אביב','תל אביב');

    -- ---- Work items: project + current task + prior task (continuity/load) ----
    INSERT INTO "WorkItems" ("Title","WorkType","Status","CustomerId","SiteId")
    VALUES ('פרויקט מבחן','Project','Open',v_customer,v_site) RETURNING "WorkItemId" INTO v_project;

    INSERT INTO "WorkItems"
        ("Title","WorkType","Status","TaskCategory","ParentWorkItemId","CustomerId","SiteId",
         "PlannedStart","PlannedEnd","EstimatedHours","RequiredRole")
    VALUES ('משימה נוכחית','Task','Open','Project',v_project,v_customer,v_site,
            v_start,v_end,3,'טכנאי') RETURNING "WorkItemId" INTO v_task;

    -- Same project/customer/site, SAME day → feeds RS13 load and RS14 continuity.
    INSERT INTO "WorkItems"
        ("Title","WorkType","Status","TaskCategory","ParentWorkItemId","CustomerId","SiteId",
         "PlannedStart","PlannedEnd","EstimatedHours")
    VALUES ('משימה קודמת','Task','Open','Project',v_project,v_customer,v_site,
            timestamp '2026-03-10 13:00:00', timestamp '2026-03-10 16:00:00',4)
    RETURNING "WorkItemId" INTO v_task_prior;

    INSERT INTO "WorkEmployeeAssignments" ("WorkItemId","EmployeeId","AssignmentRole")
    VALUES (v_task_prior, v_emp_eligible, 'טכנאי');

    -- ---- Skills, availability, geography for the eligible employee ----
    INSERT INTO "Rec_Skills" ("SkillName","SkillCategory") VALUES ('רשתות','IT')
    RETURNING "SkillId" INTO v_skill;
    INSERT INTO "Rec_WorkItemRequiredSkills" ("WorkItemId","SkillId","RequiredLevel","ImportanceLevel")
    VALUES (v_task, v_skill, 3, 'Important');
    INSERT INTO "Rec_EmployeeSkills" ("EmployeeId","SkillId","SkillLevel","YearsExperience","IsCertified")
    VALUES (v_emp_eligible, v_skill, 4, 5, true);

    INSERT INTO "Rec_EmployeeAvailability" ("EmployeeId","AvailableFrom","AvailableTo","AvailabilityType")
    VALUES (v_emp_eligible, timestamp '2026-03-10 08:00:00', timestamp '2026-03-10 18:00:00','Available');
    -- Non-overlapping window (previous day) must be filtered out by RS5.
    INSERT INTO "Rec_EmployeeAvailability" ("EmployeeId","AvailableFrom","AvailableTo","AvailabilityType")
    VALUES (v_emp_eligible, timestamp '2026-03-09 08:00:00', timestamp '2026-03-09 18:00:00','Available');

    INSERT INTO "Rec_EmployeeBaseAddress" ("EmployeeId","InputAddress","FormattedAddress","City")
    VALUES (v_emp_eligible,'רחוב דיזנגוף 10','רחוב דיזנגוף 10, תל אביב','תל אביב');

    INSERT INTO "Rec_RouteEstimates"
        ("EmployeeId","TargetSiteId","OriginType","EstimatedDistanceKm","EstimatedTravelMinutes","IsCurrent")
    VALUES (v_emp_eligible, v_site, 'HomeBase', 4.20, 12, true);
    -- Stale estimate must be filtered by IsCurrent = true.
    INSERT INTO "Rec_RouteEstimates"
        ("EmployeeId","TargetSiteId","OriginType","EstimatedDistanceKm","EstimatedTravelMinutes","IsCurrent")
    VALUES (v_emp_eligible, v_site, 'HomeBase', 99.00, 200, false);

    -- =================================================================
    -- READ PARITY: exercise the repository's result-set queries
    -- =================================================================

    -- RS3: active AND assignable employees (inactive excluded; role filtering is C#).
    SELECT count(*) INTO v_count FROM "Employees"
    WHERE "IsActive" = true AND "IsAssignable" = true
      AND "EmployeeId" IN (v_emp_eligible, v_emp_wrongrole, v_emp_inactive);
    IF v_count <> 2 THEN RAISE EXCEPTION 'RS3: expected 2 eligible employees, got %', v_count; END IF;

    -- RS5: only availability overlapping the task window is returned.
    SELECT count(*) INTO v_count FROM "Rec_EmployeeAvailability" a
    WHERE a."EmployeeId" = v_emp_eligible
      AND a."AvailableFrom" < v_end AND a."AvailableTo" > v_start;
    IF v_count <> 1 THEN RAISE EXCEPTION 'RS5: expected 1 overlapping availability row, got %', v_count; END IF;

    -- RS8: site address resolves for the task site.
    SELECT count(*) INTO v_count FROM "Rec_SiteAddressProfile" WHERE "SiteId" = v_site;
    IF v_count <> 1 THEN RAISE EXCEPTION 'RS8: expected 1 site address, got %', v_count; END IF;

    -- RS12: only current route estimates to the task site.
    SELECT count(*) INTO v_count FROM "Rec_RouteEstimates"
    WHERE "IsCurrent" = true AND "TargetSiteId" = v_site AND "EmployeeId" = v_emp_eligible;
    IF v_count <> 1 THEN RAISE EXCEPTION 'RS12: expected 1 current route estimate, got %', v_count; END IF;

    -- RS13: same-day load for the eligible employee EXCLUDING the current task.
    SELECT COALESCE(load.open_count,0), CAST(COALESCE(load.assigned_hours,0) AS numeric(10,2))
    INTO v_open, v_hours
    FROM (SELECT COUNT(DISTINCT wi."WorkItemId") AS open_count,
                 SUM(COALESCE(wi."EstimatedHours",0)) AS assigned_hours
          FROM "WorkEmployeeAssignments" wea
          INNER JOIN "WorkItems" wi ON wi."WorkItemId" = wea."WorkItemId"
          WHERE wea."EmployeeId" = v_emp_eligible
            AND wi."WorkItemId" <> v_task
            AND wi."PlannedStart"::date = v_start::date
            AND COALESCE(wi."Status",'') NOT IN ('Closed','Cancelled','Canceled','Deleted')) load;
    IF v_open <> 1 THEN RAISE EXCEPTION 'RS13: expected 1 open same-day assignment, got %', v_open; END IF;
    IF v_hours <> 4 THEN RAISE EXCEPTION 'RS13: expected 4 committed hours, got %', v_hours; END IF;

    -- RS14: continuity flags vs the task's project (parent) / customer / site.
    SELECT COALESCE(bool_or(wi."ParentWorkItemId" = v_project), false)
       AND COALESCE(bool_or(wi."CustomerId" = v_customer), false)
       AND COALESCE(bool_or(wi."SiteId" = v_site), false)
    INTO v_bool
    FROM "WorkEmployeeAssignments" wea
    INNER JOIN "WorkItems" wi ON wi."WorkItemId" = wea."WorkItemId"
    WHERE wea."EmployeeId" = v_emp_eligible AND wi."WorkItemId" <> v_task;
    IF NOT v_bool THEN RAISE EXCEPTION 'RS14: expected project/customer/site continuity to be TRUE'; END IF;
    RAISE NOTICE 'READ ok: RS3/RS5/RS8/RS12/RS13/RS14 parity queries returned expected shapes.';

    -- =================================================================
    -- WRITE PATH: create run (RETURNING) + save recommendation
    -- =================================================================
    INSERT INTO "Rec_RecommendationRuns"
        ("ScopeType","ProjectId","TaskId","RequestedByUserId","AlgorithmVersion","RunStatus","CreatedAt")
    VALUES ('Task', v_project, v_task, v_user, '1.0', 'Completed', (now() at time zone 'utc'))
    RETURNING "RecommendationRunId" INTO v_run;
    IF v_run IS NULL OR v_run <= 0 THEN RAISE EXCEPTION 'WRITE: run id not returned'; END IF;

    INSERT INTO "Rec_TaskAssignmentRecommendations"
        ("RecommendationRunId","TaskId","EmployeeId","RankOrder","TotalScore",
         "ProfessionalScore","AvailabilityScore","WorkloadScore","GeographicScore","ExperienceScore")
    VALUES (v_run, v_task, v_emp_eligible, 1, 87.50, 100, 100, 60, 80, 50);

    SELECT count(*) INTO v_count FROM "Rec_TaskAssignmentRecommendations"
    WHERE "RecommendationRunId" = v_run AND "TaskId" = v_task;
    IF v_count <> 1 THEN RAISE EXCEPTION 'WRITE: expected 1 recommendation row, got %', v_count; END IF;
    RAISE NOTICE 'WRITE ok: run % created and 1 recommendation persisted.', v_run;

    -- ---- GUARD: duplicate (run, task, employee) rejected ----
    BEGIN
        INSERT INTO "Rec_TaskAssignmentRecommendations"
            ("RecommendationRunId","TaskId","EmployeeId","RankOrder","TotalScore")
        VALUES (v_run, v_task, v_emp_eligible, 2, 50);
        RAISE EXCEPTION 'GUARD: duplicate (run,task,employee) recommendation was NOT rejected';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'GUARD ok: duplicate recommendation rejected by unique key.';
    END;

    -- ---- GUARD: RankOrder < 1 rejected ----
    BEGIN
        INSERT INTO "Rec_TaskAssignmentRecommendations"
            ("RecommendationRunId","TaskId","EmployeeId","RankOrder","TotalScore")
        VALUES (v_run, v_task, v_emp_wrongrole, 0, 10);
        RAISE EXCEPTION 'GUARD: RankOrder 0 was NOT rejected';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'GUARD ok: RankOrder < 1 rejected by CHECK.';
    END;

    -- ---- GUARD: negative TotalScore rejected ----
    BEGIN
        INSERT INTO "Rec_TaskAssignmentRecommendations"
            ("RecommendationRunId","TaskId","EmployeeId","RankOrder","TotalScore")
        VALUES (v_run, v_task, v_emp_wrongrole, 2, -1);
        RAISE EXCEPTION 'GUARD: negative TotalScore was NOT rejected';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'GUARD ok: negative TotalScore rejected by CHECK.';
    END;

    -- ---- GUARD: invalid ScopeType rejected ----
    BEGIN
        INSERT INTO "Rec_RecommendationRuns" ("ScopeType","RunStatus") VALUES ('Nonsense','Completed');
        RAISE EXCEPTION 'GUARD: invalid ScopeType was NOT rejected';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'GUARD ok: invalid ScopeType rejected by CHECK.';
    END;

    RAISE NOTICE 'WAVE 5 SMOKE: all assertions passed.';
END $$;

ROLLBACK;

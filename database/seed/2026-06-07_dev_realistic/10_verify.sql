/* =====================================================================
   ManageR2 - Dev Realistic Seed
   10_verify.sql

   READ-ONLY verification. Runs no DML and opens no transaction. Run after
   01..09 to confirm the cleanup + seed produced coherent data and that the
   Smart Assignment inputs are ready. Every check prints a PASS/CHECK flag.

   Safe to run repeatedly.
   ===================================================================== */

SET NOCOUNT ON;

IF DB_NAME() IN (N'master', N'model', N'msdb', N'tempdb')
    THROW 60010, N'Refusing to run against a system database. Select your ManageR2 dev database first.', 1;

RAISERROR(N'== 10_verify: read-only verification ==', 0, 1) WITH NOWAIT;

/* ---- 1. Required admins: User <-> Employee mapping ----------------
   Confirms each named admin is active, has the Admin role, and is linked
   to the CORRECT employee (employee email = user email, or employee name =
   the canonical admin name). Fixed by 02b_ensure_admin_employee_links.sql. */
DECLARE @AdminMap TABLE (Name NVARCHAR(50) PRIMARY KEY, Rank INT, FullNameHe NVARCHAR(100));
INSERT INTO @AdminMap (Name, Rank, FullNameHe) VALUES
    (N'adi', 1, N'עדי מעיני'), (N'klil', 2, N'כליל כהן'), (N'almog', 3, N'אלמוג שלף'),
    (N'raviv', 4, N'רביב מעיני'), (N'ronen', 5, N'רונן כץ');

SELECT
    m.Name AS ExpectedAdmin,
    u.UserId,
    u.Username,
    u.EmployeeId,
    e.FullName AS EmployeeName,
    u.IsActive AS IsUserActive,
    e.IsActive AS IsEmployeeActive,
    CAST(CASE WHEN EXISTS (
        SELECT 1 FROM dbo.UserRoles ur
        INNER JOIN dbo.Roles r ON r.RoleId = ur.RoleId
        WHERE ur.UserId = u.UserId AND ur.IsActive = 1 AND r.RoleName = N'Admin'
    ) THEN 1 ELSE 0 END AS BIT) AS HasActiveAdminRole,
    CASE
        WHEN u.UserId IS NULL THEN N'MISSING (report only - not created)'
        WHEN e.EmployeeId IS NULL THEN N'CHECK - no employee linked'
        WHEN u.IsActive = 1 AND e.IsActive = 1
             AND (e.Email = u.Email OR e.FullName = m.FullNameHe)
             AND EXISTS (SELECT 1 FROM dbo.UserRoles ur
                         INNER JOIN dbo.Roles r ON r.RoleId = ur.RoleId
                         WHERE ur.UserId = u.UserId AND ur.IsActive = 1 AND r.RoleName = N'Admin')
             THEN N'PASS'
        ELSE N'CHECK'
    END AS Result
FROM @AdminMap m
LEFT JOIN dbo.Users u
    ON LOWER(REPLACE(u.Username, N' ', N'')) IN (m.Name, N'admin-' + m.Name)
       OR LOWER(u.Email) LIKE m.Name + N'@%'
       OR LOWER(u.Email) LIKE N'admin' + m.Name + N'@%'
       OR (m.Name = N'almog' AND LOWER(u.Email) = N'algom@gmail.com')
LEFT JOIN dbo.Employees e ON e.EmployeeId = u.EmployeeId
ORDER BY m.Rank;

SELECT
    N'1b. Active admin total' AS Check_Name,
    COUNT(*) AS ActiveAdminCount,
    CASE WHEN COUNT(*) >= 1 THEN N'PASS' ELSE N'FAIL - seed scripts will THROW' END AS Result
FROM dbo.Users u
INNER JOIN dbo.UserRoles ur ON ur.UserId = u.UserId AND ur.IsActive = 1
INNER JOIN dbo.Roles r ON r.RoleId = ur.RoleId AND r.RoleName = N'Admin'
WHERE u.IsActive = 1;

/* ---- 1c. Admin / project-team employees may exist (Users.EmployeeId is
   required) but must NOT be Smart-Assignment candidates (IsAssignable=0). --- */
SELECT
    N'1c. Admin employees not assignable' AS Check_Name,
    e.EmployeeId,
    e.FullName,
    e.PrimaryRole,
    e.IsAssignable,
    CASE WHEN e.IsAssignable = 0 THEN N'PASS' ELSE N'CHECK - admin must be IsAssignable=0' END AS Result
FROM dbo.Users u
INNER JOIN dbo.Employees e ON e.EmployeeId = u.EmployeeId
WHERE EXISTS (
    SELECT 1 FROM dbo.UserRoles ur
    INNER JOIN dbo.Roles r ON r.RoleId = ur.RoleId
    WHERE ur.UserId = u.UserId AND ur.IsActive = 1 AND r.RoleName = N'Admin')
ORDER BY e.FullName;

/* ---- 2. Core entity counts ---------------------------------------- */
SELECT
    N'2. Core entities' AS Check_Name,
    (SELECT COUNT(*) FROM dbo.Employees WHERE IsActive = 1)                     AS Employees_active,
    (SELECT COUNT(*) FROM dbo.Customers WHERE CustomerType <> N'Internal')      AS Customers_seeded,
    (SELECT COUNT(*) FROM dbo.Sites)                                            AS Sites,
    (SELECT COUNT(*) FROM dbo.Contacts)                                         AS Contacts,
    (SELECT COUNT(*) FROM dbo.Contractors)                                      AS Contractors,
    (SELECT COUNT(*) FROM dbo.InventoryItems WHERE IsActive = 1)                AS Inventory_active;

/* ---- 2a. Active roster: PrimaryRole + IsAssignable split.
   Assignable (=1): רותם, יובל, איתן, עופר, ליאור. Non-assignable (=0):
   the three sales/domain managers + the five admin/project-team users. ---- */
SELECT
    N'2a. Roster' AS Check_Name,
    e.EmployeeId,
    e.FullName,
    e.PrimaryRole,
    e.IsAssignable,
    e.DailyCapacityHours
FROM dbo.Employees e
WHERE e.IsActive = 1
ORDER BY e.IsAssignable DESC, e.FullName;

/* ---- 2b. Customer type domain = {עסקי, מוסד, פרטי} (Internal excluded). --- */
SELECT
    N'2b. Customer type domain' AS Check_Name,
    SUM(CASE WHEN c.CustomerType IN (N'עסקי', N'מוסד', N'פרטי') THEN 1 ELSE 0 END)     AS Valid_types,
    SUM(CASE WHEN c.CustomerType NOT IN (N'עסקי', N'מוסד', N'פרטי') THEN 1 ELSE 0 END) AS Invalid_types,
    CASE WHEN SUM(CASE WHEN c.CustomerType NOT IN (N'עסקי', N'מוסד', N'פרטי') THEN 1 ELSE 0 END) = 0
         THEN N'PASS' ELSE N'CHECK - unexpected customer type' END AS Result
FROM dbo.Customers c
WHERE c.CustomerType <> N'Internal';

/* ---- 2c. Customer business status = {פרויקט בביצוע, בשירות תחת חוזה, בתשלום}. --- */
SELECT
    N'2c. Customer status domain' AS Check_Name,
    SUM(CASE WHEN c.Status IN (N'פרויקט בביצוע', N'בשירות תחת חוזה', N'בתשלום') THEN 1 ELSE 0 END)     AS Valid_status,
    SUM(CASE WHEN c.Status NOT IN (N'פרויקט בביצוע', N'בשירות תחת חוזה', N'בתשלום') OR c.Status IS NULL THEN 1 ELSE 0 END) AS Invalid_status,
    CASE WHEN SUM(CASE WHEN c.Status NOT IN (N'פרויקט בביצוע', N'בשירות תחת חוזה', N'בתשלום') OR c.Status IS NULL THEN 1 ELSE 0 END) = 0
         THEN N'PASS' ELSE N'CHECK - unexpected customer status' END AS Result
FROM dbo.Customers c
WHERE c.CustomerType <> N'Internal';

/* ---- 2d. Inventory category domain = the eight business categories. ---- */
SELECT
    N'2d. Inventory category domain' AS Check_Name,
    SUM(CASE WHEN i.Category IN (N'חשמל חכם', N'מולטימדיה', N'שו"ב', N'רשת מחשבים',
                                 N'מצלמות אבטחה', N'מערכות אזעקה', N'טלפוניה ואינטרקום', N'כבילה ותשתיות')
             THEN 1 ELSE 0 END) AS Valid_categories,
    SUM(CASE WHEN i.Category NOT IN (N'חשמל חכם', N'מולטימדיה', N'שו"ב', N'רשת מחשבים',
                                     N'מצלמות אבטחה', N'מערכות אזעקה', N'טלפוניה ואינטרקום', N'כבילה ותשתיות')
             THEN 1 ELSE 0 END) AS Invalid_categories,
    CASE WHEN SUM(CASE WHEN i.Category NOT IN (N'חשמל חכם', N'מולטימדיה', N'שו"ב', N'רשת מחשבים',
                                               N'מצלמות אבטחה', N'מערכות אזעקה', N'טלפוניה ואינטרקום', N'כבילה ותשתיות')
                       THEN 1 ELSE 0 END) = 0
         THEN N'PASS' ELSE N'CHECK - unexpected inventory category' END AS Result
FROM dbo.InventoryItems i
WHERE i.IsActive = 1;

/* ---- 3. Work items by type ---------------------------------------- */
SELECT
    N'3. Work items' AS Check_Name,
    (SELECT COUNT(*) FROM dbo.WorkItems WHERE WorkType = N'Project' AND FinanceProjectNumber LIKE N'SEED-P%') AS Projects,
    (SELECT COUNT(*) FROM dbo.WorkItems t WHERE t.WorkType = N'Task'
        AND EXISTS (SELECT 1 FROM dbo.WorkItems p WHERE p.WorkItemId = t.ParentWorkItemId AND p.FinanceProjectNumber LIKE N'SEED-P%')) AS Project_tasks,
    (SELECT COUNT(*) FROM dbo.WorkItems WHERE WorkType = N'ServiceCall')         AS Service_calls,
    (SELECT COUNT(*) FROM dbo.WorkItems t INNER JOIN dbo.WorkItems p ON p.WorkItemId = t.ParentWorkItemId
        WHERE t.WorkType = N'Task' AND p.FinanceProjectNumber = N'INTERNAL')     AS Internal_tasks,
    (SELECT COUNT(*) FROM dbo.WorkEmployeeAssignments)                           AS Employee_assignments,
    (SELECT COUNT(*) FROM dbo.WorkContractorAssignments)                         AS Contractor_assignments;

/* ---- 4. Project details ------------------------------------------- */
SELECT
    N'4. Project details' AS Check_Name,
    (SELECT COUNT(*) FROM dbo.ProjectBoqItems)        AS BOQ_items,
    (SELECT COUNT(*) FROM dbo.ProjectDrawings)        AS Drawings,
    (SELECT COUNT(*) FROM dbo.ProjectEquipmentItems)  AS Equipment_items;

/* ---- 5. Quotes + VAT 17% sanity ----------------------------------- */
SELECT
    N'5. Quotes' AS Check_Name,
    COUNT(*) AS Quotes,
    SUM(CASE WHEN q.VatRate = 17 THEN 1 ELSE 0 END) AS Quotes_vat17,
    SUM(CASE WHEN ABS(ISNULL(q.Total,0) - (ISNULL(q.Subtotal,0) + ISNULL(q.VatAmount,0))) <= 0.05 THEN 1 ELSE 0 END) AS Quotes_totals_ok,
    CASE WHEN COUNT(*) = 0 THEN N'CHECK - no quotes'
         WHEN COUNT(*) = SUM(CASE WHEN q.VatRate = 17 THEN 1 ELSE 0 END) THEN N'PASS' ELSE N'CHECK' END AS Result
FROM dbo.Quotes q
WHERE q.Notes LIKE N'%SEED::%';

SELECT N'5b. Quote lines' AS Check_Name, COUNT(*) AS QuoteLines
FROM dbo.QuoteLineItems li
INNER JOIN dbo.Quotes q ON q.QuoteId = li.QuoteId
WHERE q.Notes LIKE N'%SEED::%';

/* ---- 6. Reports --------------------------------------------------- */
SELECT
    N'6. Reports' AS Check_Name,
    (SELECT COUNT(*) FROM dbo.WorkReports)                   AS Reports,
    (SELECT COUNT(*) FROM dbo.WorkReports WHERE Status = N'הוגש')  AS Submitted,
    (SELECT COUNT(*) FROM dbo.WorkReports WHERE Status = N'טיוטה') AS Draft,
    (SELECT COUNT(*) FROM dbo.WorkReportSystems)             AS Systems,
    (SELECT COUNT(*) FROM dbo.WorkReportEmployeeAssignments) AS Report_assignments;

/* ---- 7. Smart Assignment INPUT readiness -------------------------- */
SELECT
    N'7. Smart Assignment inputs' AS Check_Name,
    (SELECT COUNT(*) FROM dbo.Rec_Skills)                   AS Skills,
    (SELECT COUNT(*) FROM dbo.Rec_WorkZones)                AS Zones,
    (SELECT COUNT(*) FROM dbo.Rec_EmployeeSkills)           AS Emp_skills,
    (SELECT COUNT(*) FROM dbo.Rec_EmployeeWorkZones)        AS Emp_zones,
    (SELECT COUNT(*) FROM dbo.Rec_EmployeeCapacity)         AS Emp_capacity,
    (SELECT COUNT(*) FROM dbo.Rec_EmployeeBaseAddress)      AS Emp_base_addr,
    (SELECT COUNT(*) FROM dbo.Rec_EmployeeAvailability)     AS Emp_availability,
    (SELECT COUNT(*) FROM dbo.Rec_SiteAddressProfile)       AS Site_profiles,
    (SELECT COUNT(*) FROM dbo.Rec_WorkItemRequiredSkills)   AS WI_required_skills,
    (SELECT COUNT(*) FROM dbo.Rec_WorkItemAlgorithmProfile) AS WI_algo_profiles;

/* Per-assignable-employee input completeness (each should be fully covered). */
SELECT
    N'7b. Employee input coverage' AS Check_Name,
    e.EmployeeId, e.FullName, e.PrimaryRole,
    CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.Rec_EmployeeSkills s WHERE s.EmployeeId = e.EmployeeId) THEN 1 ELSE 0 END AS BIT) AS HasSkills,
    CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.Rec_EmployeeWorkZones z WHERE z.EmployeeId = e.EmployeeId) THEN 1 ELSE 0 END AS BIT) AS HasZone,
    CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.Rec_EmployeeCapacity c WHERE c.EmployeeId = e.EmployeeId) THEN 1 ELSE 0 END AS BIT) AS HasCapacity,
    CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.Rec_EmployeeBaseAddress b WHERE b.EmployeeId = e.EmployeeId) THEN 1 ELSE 0 END AS BIT) AS HasBaseAddr,
    CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.Rec_EmployeeAvailability a WHERE a.EmployeeId = e.EmployeeId AND a.AvailabilityType = N'Available') THEN 1 ELSE 0 END AS BIT) AS HasAvailability
FROM dbo.Employees e
WHERE e.IsActive = 1 AND e.IsAssignable = 1
ORDER BY e.EmployeeId;

/* ---- 7c. Non-assignable employees (admins + sales/domain managers) must
   NOT appear in any Smart Assignment candidate input table. ---- */
SELECT
    N'7c. Non-assignable excluded from SA' AS Check_Name,
    (SELECT COUNT(*) FROM dbo.Rec_EmployeeSkills s       INNER JOIN dbo.Employees e ON e.EmployeeId = s.EmployeeId WHERE e.IsAssignable = 0) AS NonAssignable_skills,
    (SELECT COUNT(*) FROM dbo.Rec_EmployeeWorkZones z    INNER JOIN dbo.Employees e ON e.EmployeeId = z.EmployeeId WHERE e.IsAssignable = 0) AS NonAssignable_zones,
    (SELECT COUNT(*) FROM dbo.Rec_EmployeeCapacity c     INNER JOIN dbo.Employees e ON e.EmployeeId = c.EmployeeId WHERE e.IsAssignable = 0) AS NonAssignable_capacity,
    (SELECT COUNT(*) FROM dbo.Rec_EmployeeBaseAddress b  INNER JOIN dbo.Employees e ON e.EmployeeId = b.EmployeeId WHERE e.IsAssignable = 0) AS NonAssignable_base,
    (SELECT COUNT(*) FROM dbo.Rec_EmployeeAvailability a INNER JOIN dbo.Employees e ON e.EmployeeId = a.EmployeeId WHERE e.IsAssignable = 0) AS NonAssignable_avail,
    CASE WHEN (SELECT COUNT(*) FROM dbo.Rec_EmployeeSkills s       INNER JOIN dbo.Employees e ON e.EmployeeId = s.EmployeeId WHERE e.IsAssignable = 0)
            + (SELECT COUNT(*) FROM dbo.Rec_EmployeeWorkZones z    INNER JOIN dbo.Employees e ON e.EmployeeId = z.EmployeeId WHERE e.IsAssignable = 0)
            + (SELECT COUNT(*) FROM dbo.Rec_EmployeeCapacity c     INNER JOIN dbo.Employees e ON e.EmployeeId = c.EmployeeId WHERE e.IsAssignable = 0)
            + (SELECT COUNT(*) FROM dbo.Rec_EmployeeBaseAddress b  INNER JOIN dbo.Employees e ON e.EmployeeId = b.EmployeeId WHERE e.IsAssignable = 0)
            + (SELECT COUNT(*) FROM dbo.Rec_EmployeeAvailability a INNER JOIN dbo.Employees e ON e.EmployeeId = a.EmployeeId WHERE e.IsAssignable = 0) = 0
         THEN N'PASS' ELSE N'CHECK - a non-assignable employee has SA inputs' END AS Result;

/* ---- 8. Runtime/computed recommendation tables must be EMPTY ------- */
SELECT
    N'8. Runtime rec tables empty' AS Check_Name,
    (SELECT COUNT(*) FROM dbo.Rec_RecommendationRuns)            AS Runs,
    (SELECT COUNT(*) FROM dbo.Rec_TaskAssignmentRecommendations) AS Recommendations,
    (SELECT COUNT(*) FROM dbo.Rec_EmployeePlannedStops)          AS PlannedStops,
    (SELECT COUNT(*) FROM dbo.Rec_EmployeeLocationEvents)        AS LocationEvents,
    (SELECT COUNT(*) FROM dbo.Rec_RouteEstimates)                AS RouteEstimates,
    CASE WHEN (SELECT COUNT(*) FROM dbo.Rec_RecommendationRuns)
            + (SELECT COUNT(*) FROM dbo.Rec_TaskAssignmentRecommendations)
            + (SELECT COUNT(*) FROM dbo.Rec_EmployeePlannedStops)
            + (SELECT COUNT(*) FROM dbo.Rec_EmployeeLocationEvents)
            + (SELECT COUNT(*) FROM dbo.Rec_RouteEstimates) = 0
         THEN N'PASS' ELSE N'CHECK - expected empty' END AS Result;

/* ---- 9. RequiredRole skill coverage. RequiredRole is now a skill-domain
   name (aligned with 08), so a work item is "coverable" when >=1 assignable
   employee holds that skill. (Explicit by-name assignment is done in 04/07;
   this confirms the Smart Assignment algorithm also has candidates.) ---- */
SELECT
    N'9. RequiredRole skill coverage' AS Check_Name,
    wi.RequiredRole,
    COUNT(*) AS WorkItems_needing_role,
    (SELECT COUNT(DISTINCT e.EmployeeId)
       FROM dbo.Employees e
       INNER JOIN dbo.Rec_EmployeeSkills es ON es.EmployeeId = e.EmployeeId
       INNER JOIN dbo.Rec_Skills s ON s.SkillId = es.SkillId
       WHERE e.IsActive = 1 AND e.IsAssignable = 1 AND s.SkillName = wi.RequiredRole) AS SkilledCandidates,
    CASE WHEN (SELECT COUNT(DISTINCT e.EmployeeId)
       FROM dbo.Employees e
       INNER JOIN dbo.Rec_EmployeeSkills es ON es.EmployeeId = e.EmployeeId
       INNER JOIN dbo.Rec_Skills s ON s.SkillId = es.SkillId
       WHERE e.IsActive = 1 AND e.IsAssignable = 1 AND s.SkillName = wi.RequiredRole) > 0
         THEN N'PASS' ELSE N'CHECK - no skilled candidate' END AS Result
FROM dbo.WorkItems wi
WHERE wi.RequiredRole IS NOT NULL
  AND (wi.WorkType = N'ServiceCall'
       OR EXISTS (SELECT 1 FROM dbo.WorkItems p WHERE p.WorkItemId = wi.ParentWorkItemId AND p.FinanceProjectNumber LIKE N'SEED-P%'))
GROUP BY wi.RequiredRole
ORDER BY wi.RequiredRole;

/* ---- 10. Referential integrity / orphan checks -------------------- */
SELECT
    N'10. Integrity checks' AS Check_Name,
    (SELECT COUNT(*) FROM dbo.WorkItems wi LEFT JOIN dbo.Customers c ON c.CustomerId = wi.CustomerId WHERE c.CustomerId IS NULL) AS WorkItems_missing_customer,
    (SELECT COUNT(*) FROM dbo.WorkItems wi WHERE wi.SiteId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Sites s WHERE s.SiteId = wi.SiteId)) AS WorkItems_bad_site,
    (SELECT COUNT(*) FROM dbo.WorkItems t WHERE t.WorkType = N'Task' AND (t.ParentWorkItemId IS NULL
         OR NOT EXISTS (SELECT 1 FROM dbo.WorkItems p WHERE p.WorkItemId = t.ParentWorkItemId))) AS Tasks_without_parent,
    (SELECT COUNT(*) FROM dbo.WorkEmployeeAssignments wa WHERE NOT EXISTS (SELECT 1 FROM dbo.Employees e WHERE e.EmployeeId = wa.EmployeeId)) AS Assignments_bad_employee,
    (SELECT COUNT(*) FROM dbo.Sites s LEFT JOIN dbo.Customers c ON c.CustomerId = s.CustomerId WHERE c.CustomerId IS NULL) AS Sites_missing_customer;

/* ---- 11. Project stage vs computed progress consistency.
   Recomputes the same ratio sp_GetProjectLifecycle uses
   (ClosedTasks / (Total - Cancelled)) and surfaces the Hebrew business stage
   embedded in the project Description ("שלב נוכחי: ..."). A closed/סיום project
   must be >=95%; an open project must stay <95%. ---- */
SELECT
    N'11. Stage vs progress' AS Check_Name,
    p.FinanceProjectNumber,
    p.Status,
    CASE WHEN CHARINDEX(N'שלב נוכחי:', p.Description) > 0
         THEN LTRIM(REPLACE(SUBSTRING(p.Description, CHARINDEX(N'שלב נוכחי:', p.Description) + 10, 60), N'.', N''))
         ELSE NULL END AS StageHe,
    tc.TotalTasks,
    tc.ClosedTasks,
    tc.CancelledTasks,
    CAST(CASE WHEN (tc.TotalTasks - tc.CancelledTasks) > 0
              THEN 100.0 * tc.ClosedTasks / (tc.TotalTasks - tc.CancelledTasks)
              ELSE 0 END AS DECIMAL(5,1)) AS ProgressPct,
    CASE
        WHEN p.Status = N'Closed'
             AND NOT ((tc.TotalTasks - tc.CancelledTasks) > 0
                      AND (100.0 * tc.ClosedTasks / (tc.TotalTasks - tc.CancelledTasks)) >= 95)
            THEN N'CHECK - closed/סיום but progress < 95%'
        WHEN p.Status <> N'Closed'
             AND (tc.TotalTasks - tc.CancelledTasks) > 0
             AND (100.0 * tc.ClosedTasks / (tc.TotalTasks - tc.CancelledTasks)) >= 95
            THEN N'CHECK - open project but progress >= 95%'
        ELSE N'PASS'
    END AS Result
FROM dbo.WorkItems p
CROSS APPLY (
    SELECT
        COUNT(*) AS TotalTasks,
        SUM(CASE WHEN t.Status = N'Closed'    THEN 1 ELSE 0 END) AS ClosedTasks,
        SUM(CASE WHEN t.Status = N'Cancelled' THEN 1 ELSE 0 END) AS CancelledTasks
    FROM dbo.WorkItems t
    WHERE t.ParentWorkItemId = p.WorkItemId AND t.WorkType = N'Task'
) tc
WHERE p.WorkType = N'Project' AND p.FinanceProjectNumber LIKE N'SEED-P%'
ORDER BY p.FinanceProjectNumber;

RAISERROR(N'== 10_verify: done. Review the result grids above. ==', 0, 1) WITH NOWAIT;

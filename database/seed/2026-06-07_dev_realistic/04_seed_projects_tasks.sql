/* =====================================================================
   ManageR2 - Dev Realistic Seed
   04_seed_projects_tasks.sql

   Seeds:
     - Projects (WorkType='Project') with stable FinanceProjectNumber
       natural keys SEED-P01..SEED-P08.
     - Tasks/milestones (WorkType='Task', parented to their project).
     - Project team assignments (PM + members) on the project row.
     - Per-task employee assignments (RequiredRole -> matching employee).
     - A couple of contractor assignments.

   Status / Priority / BillingType use the canonical codes the React app
   understands (Open/Planned/Design/Wiring/Execution/Closed/Cancelled,
   Planned/Execution/Done/Closed/Blocked, Low/Medium/High/Urgent,
   Fixed/Internal/Hourly).

   Dates are deterministic offsets from the run date (@Today) so the work
   plan and Smart Assignment have a meaningful "now" horizon.

   Depends on 03_seed_core.sql. Idempotent (natural-key guards).
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ---- Context / sentinel guards ------------------------------------ */
IF DB_NAME() IN (N'master', N'model', N'msdb', N'tempdb')
    THROW 60010, N'Refusing to run against a system database. Select your ManageR2 dev database first.', 1;
IF OBJECT_ID(N'dbo.WorkItems', N'U') IS NULL
    THROW 60011, N'Current database does not look like a ManageR2 database. Aborting.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerType <> N'Internal')
    THROW 60012, N'No seeded customers found. Run 03_seed_core.sql before 04.', 1;

RAISERROR(N'== 04_seed_projects_tasks: starting ==', 0, 1) WITH NOWAIT;

DECLARE @Today DATE = CAST(SYSUTCDATETIME() AS DATE);
DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();

BEGIN TRY
    BEGIN TRAN;

    /* ================================================================
       PROJECTS - natural key FinanceProjectNumber = 'SEED-Pnn'.
       ================================================================ */
    DECLARE @Projects TABLE (
        Fin NVARCHAR(20),
        Title NVARCHAR(150),
        CustomerName NVARCHAR(200),
        SiteName NVARCHAR(100),
        Status NVARCHAR(50),
        BillingType NVARCHAR(50),
        Priority NVARCHAR(20),
        EstimatedHours DECIMAL(5,2),
        PmRole NVARCHAR(100),
        StartOffset INT,
        EndOffset INT,
        IsClosed BIT,
        Description NVARCHAR(1000)
    );
    INSERT INTO @Projects (Fin, Title, CustomerName, SiteName, Status, BillingType, Priority, EstimatedHours, PmRole, StartOffset, EndOffset, IsClosed, Description) VALUES
        (N'SEED-P01', N'מערכת מצלמות אבטחה - קניון רננים',          N'קניון רננים - חברת ניהול',          N'קניון רננים - מתחם ראשי',        N'Execution', N'Fixed',  N'High',   180.00, N'מנהל פרויקטים',  -40, 25,  0, N'אספקה והתקנה של מערך מצלמות IP, NVR והקלטה מרכזית במתחם המסחרי.'),
        (N'SEED-P02', N'בקרת כניסה ומחסומי חניון - עיריית כפר סבא', N'עיריית כפר סבא',                    N'חניון עירוני מרכזי',             N'Wiring',    N'Fixed',  N'Medium', 140.00, N'מנהל פרויקטים',  -28, 20,  0, N'מערכת בקרת כניסה, מחסומים וזיהוי לוחית רישוי בחניון העירוני.'),
        (N'SEED-P03', N'תשתית תקשורת ומדף תקשורת - קמפוס אפקה',     N'מכללת אפקה להנדסה',                 N'קמפוס אפקה - בניין הנדסה',        N'Design',    N'Hourly', N'Medium', 160.00, N'מנהל פרויקטים',  -22, 28,  0, N'תכנון והקמת תשתית CAT6 וסיב אופטי, ארון תקשורת ומיתוג למעבדות.'),
        (N'SEED-P04', N'מערכת כריזה ומולטימדיה - אולם כנסים ישרוטל',N'רשת מלונות ישרוטל',                 N'מלון ישרוטל תל אביב - אגף כנסים', N'Planned',   N'Fixed',  N'Medium', 120.00, N'מנהלת פרויקטים', 5,   32,  0, N'מערכת כריזה, רמקולים, מקרנים ומסכים לאולמות הכנסים.'),
        (N'SEED-P05', N'בקרת מבנה חכמה (BMS) - מגדלי הים התיכון',   N'מגדלי הים התיכון - ניהול ואחזקה',   N'מגדל מגורים A',                  N'Open',      N'Fixed',  N'Low',    200.00, N'מנהל פרויקטים',  8,   40,  0, N'בקרת מבנה לתאורה, מיזוג ומעליות בלובי ובשטחים הציבוריים.'),
        (N'SEED-P06', N'שדרוג מערכת מצלמות ואזעקה - בנק הפועלים רעננה',N'בנק הפועלים סניף רעננה',          N'סניף רעננה מרכז',                N'Closed',    N'Fixed',  N'High',   90.00,  N'מנהל פרויקטים',  -60, -34, 1, N'שדרוג מצלמות, מערכת אזעקה ולחצני מצוקה באזור הקופות.'),
        (N'SEED-P07', N'מערכת גילוי וכיבוי אש - מרכז רפואי מאיר',   N'מרכז רפואי מאיר',                   N'אגף אשפוז חדש',                  N'Execution', N'Fixed',  N'Urgent', 150.00, N'מנהל פרויקטים',  -18, 12,  0, N'מערכת גילוי אש כתובתית וכריזת חירום באגף האשפוז החדש.'),
        (N'SEED-P08', N'מערכת בית חכם - וילה משפחת לוי',            N'משפחת לוי - הרצליה פיתוח',          N'וילה פרטית הרצליה פיתוח',         N'Execution', N'Fixed',  N'Medium', 110.00, N'מנהל פרויקטים',  -22, 10,  0, N'אינטגרציית בית חכם: תאורה, מצלמות, מולטירום ובקרת אקלים.');

    INSERT INTO dbo.WorkItems (Title, WorkType, Status, BillingType, Description, CustomerId, SiteId, CreatedAt, ClosedAt, ParentWorkItemId, DealCloseDate, FinanceProjectNumber, EstimatedHours, Priority, PlannedStart, PlannedEnd, IsLocked)
    SELECT
        p.Title, N'Project', p.Status, p.BillingType, p.Description, c.CustomerId, s.SiteId,
        DATEADD(DAY, p.StartOffset - 7, @Now),
        CASE WHEN p.IsClosed = 1 THEN DATEADD(DAY, p.EndOffset, @Now) END,
        NULL,
        CASE WHEN p.Status IN (N'Execution', N'Closed', N'Wiring') THEN DATEADD(DAY, p.StartOffset - 14, @Now) END,
        p.Fin, p.EstimatedHours, p.Priority,
        DATEADD(DAY, p.StartOffset, @Today),
        DATEADD(DAY, p.EndOffset, @Today),
        0
    FROM @Projects p
    INNER JOIN dbo.Customers c ON c.CustomerName = p.CustomerName
    INNER JOIN dbo.Sites s ON s.CustomerId = c.CustomerId AND s.SiteName = p.SiteName
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.WorkItems x WHERE x.WorkType = N'Project' AND x.FinanceProjectNumber = p.Fin
    );
    RAISERROR(N'Projects upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRAN;
    RAISERROR(N'== 04_seed_projects_tasks (projects) FAILED and was rolled back. ==', 16, 1) WITH NOWAIT;
    THROW;
END CATCH;

RAISERROR(N'-- 04: projects section done. --', 0, 1) WITH NOWAIT;

BEGIN TRY
    BEGIN TRAN;

    /* ================================================================
       TASKS / MILESTONES - parented to their project.
       RequiredRole values are EXACTLY the employee PrimaryRole strings
       seeded in 03, so 08 can align required-skills and assignments work.
       Natural key: (ParentWorkItemId, Title).
       ================================================================ */
    DECLARE @Tasks TABLE (
        Fin NVARCHAR(20),
        Title NVARCHAR(150),
        Status NVARCHAR(50),
        Priority NVARCHAR(20),
        BillingType NVARCHAR(50),
        RequiredRole NVARCHAR(100),
        EstHours DECIMAL(5,2),
        StartOffset INT,
        DurDays INT
    );
    INSERT INTO @Tasks (Fin, Title, Status, Priority, BillingType, RequiredRole, EstHours, StartOffset, DurDays) VALUES
        -- P01 camera (Execution)
        (N'SEED-P01', N'סקר אתר ותכנון מערכת',          N'Done',      N'Medium', N'Hourly', N'מנהל פרויקטים',          8.00,  -38, 3),
        (N'SEED-P01', N'אספקת מצלמות ו-NVR',            N'Done',      N'Low',    N'Fixed',  N'מנהל פרויקטים',          6.00,  -33, 2),
        (N'SEED-P01', N'השחלת תשתית תקשורת',            N'Execution', N'Medium', N'Fixed',  N'טכנאי תקשורת',           40.00, -12, 6),
        (N'SEED-P01', N'התקנת מצלמות וכבילה',           N'Planned',   N'High',   N'Fixed',  N'מתקין מצלמות',           48.00, 3,   7),
        (N'SEED-P01', N'הגדרת הקלטה ובדיקות מסירה',     N'Planned',   N'Medium', N'Fixed',  N'טכנאי בכיר',             16.00, 14,  3),
        -- P02 access (Wiring)
        (N'SEED-P02', N'סקר אתר ותכנון בקרה',           N'Done',      N'Medium', N'Hourly', N'מנהל פרויקטים',          8.00,  -26, 2),
        (N'SEED-P02', N'השחלת תשתיות וחיווט',           N'Execution', N'Medium', N'Fixed',  N'טכנאי מערכות מתח נמוך',  36.00, -6,  7),
        (N'SEED-P02', N'התקנת בקרים וקוראים',           N'Planned',   N'High',   N'Fixed',  N'מתקין בקרת כניסה',       40.00, 4,   5),
        (N'SEED-P02', N'הגדרת בקרת כניסה ומסירה',       N'Planned',   N'Medium', N'Fixed',  N'מתקין בקרת כניסה',       16.00, 12,  3),
        -- P03 comms (Design)
        (N'SEED-P03', N'סקר ותכנון תשתית תקשורת',       N'Done',      N'Medium', N'Hourly', N'מנהל פרויקטים',          12.00, -20, 3),
        (N'SEED-P03', N'תכנון מפורט ומדף תקשורת',       N'Execution', N'Medium', N'Hourly', N'טכנאי בכיר',             24.00, -2,  8),
        (N'SEED-P03', N'השחלת CAT6 וסיב אופטי',         N'Planned',   N'Medium', N'Hourly', N'טכנאי תקשורת',           44.00, 10,  6),
        (N'SEED-P03', N'התקנת ארון תקשורת ומיתוג',      N'Planned',   N'Medium', N'Hourly', N'טכנאי תקשורת',           28.00, 18,  4),
        -- P04 AV (Planned)
        (N'SEED-P04', N'סקר אקוסטי ותכנון',             N'Planned',   N'Medium', N'Fixed',  N'מנהלת פרויקטים',         12.00, 6,   3),
        (N'SEED-P04', N'אספקת ציוד מולטימדיה',          N'Planned',   N'Low',    N'Fixed',  N'מנהלת פרויקטים',         6.00,  12,  2),
        (N'SEED-P04', N'התקנת רמקולים ומגברים',         N'Planned',   N'Medium', N'Fixed',  N'טכנאי שירות',            40.00, 18,  5),
        (N'SEED-P04', N'כיול והרצת מערכת',              N'Planned',   N'Medium', N'Fixed',  N'טכנאי תקשורת',           18.00, 26,  3),
        -- P05 BMS (Open)
        (N'SEED-P05', N'סקר ותכנון בקרת מבנה',          N'Planned',   N'Low',    N'Fixed',  N'מנהל פרויקטים',          16.00, 9,   4),
        (N'SEED-P05', N'חיווט בקרים וחיישנים',          N'Planned',   N'Medium', N'Fixed',  N'חשמלאי מוסמך',           48.00, 16,  6),
        (N'SEED-P05', N'התקנת בקרי DDC',                N'Planned',   N'Medium', N'Fixed',  N'טכנאי מערכות מתח נמוך',  36.00, 24,  5),
        (N'SEED-P05', N'תכנות והרצת מערכת',             N'Planned',   N'Medium', N'Fixed',  N'חשמלאי מוסמך',           24.00, 33,  4),
        -- P06 camera upgrade (Closed - all done in the past)
        (N'SEED-P06', N'סקר אתר ותכנון שדרוג',          N'Done',      N'Medium', N'Fixed',  N'מנהל פרויקטים',          8.00,  -60, 2),
        (N'SEED-P06', N'אספקת מצלמות ורכזת אזעקה',      N'Done',      N'Low',    N'Fixed',  N'מנהל פרויקטים',          6.00,  -56, 2),
        (N'SEED-P06', N'החלפת מצלמות וכבילה',           N'Done',      N'High',   N'Fixed',  N'מתקין מצלמות',           32.00, -52, 5),
        (N'SEED-P06', N'התקנת מערכת אזעקה ולחצני מצוקה',N'Done',      N'High',   N'Fixed',  N'טכנאי בכיר',             24.00, -44, 4),
        (N'SEED-P06', N'בדיקות מסירה ואחריות',          N'Closed',    N'Medium', N'Fixed',  N'טכנאי בכיר',             12.00, -38, 2),
        -- P07 fire (Execution - urgent)
        (N'SEED-P07', N'תכנון מערכת גילוי אש',          N'Done',      N'High',   N'Fixed',  N'מנהל פרויקטים',          12.00, -18, 3),
        (N'SEED-P07', N'אספקת גלאים ורכזת',             N'Done',      N'Medium', N'Fixed',  N'מנהל פרויקטים',          6.00,  -14, 2),
        (N'SEED-P07', N'חיווט והתקנת גלאים',            N'Execution', N'Urgent', N'Fixed',  N'חשמלאי מוסמך',           44.00, -2,  6),
        (N'SEED-P07', N'בדיקות תקן ואישור כבאות',       N'Planned',   N'High',   N'Fixed',  N'טכנאי בכיר',             16.00, 7,   3),
        -- P08 smart home (Execution)
        (N'SEED-P08', N'תכנון בית חכם',                 N'Done',      N'Medium', N'Fixed',  N'מנהל פרויקטים',          10.00, -22, 4),
        (N'SEED-P08', N'השחלה וחיווט',                  N'Done',      N'Medium', N'Fixed',  N'חשמלאי מוסמך',           40.00, -15, 5),
        (N'SEED-P08', N'התקנת מצלמות ובקרה',            N'Execution', N'Medium', N'Fixed',  N'מתקין מצלמות',           32.00, -3,  6),
        (N'SEED-P08', N'אינטגרציה והדרכת לקוח',         N'Planned',   N'Medium', N'Fixed',  N'מנהל פרויקטים',          12.00, 6,   3);

    INSERT INTO dbo.WorkItems (Title, WorkType, Status, BillingType, Description, CustomerId, SiteId, CreatedAt, ClosedAt, ParentWorkItemId, EstimatedHours, Priority, PlannedStart, PlannedEnd, RequiredRole, IsLocked, ActualStart, ActualEnd, ActualHours)
    SELECT
        t.Title, N'Task', t.Status, t.BillingType, NULL, p.CustomerId, p.SiteId,
        DATEADD(DAY, t.StartOffset - 3, @Now),
        CASE WHEN t.Status IN (N'Done', N'Closed') THEN DATEADD(DAY, t.StartOffset + t.DurDays, @Now) END,
        p.WorkItemId,
        t.EstHours, t.Priority,
        DATEADD(DAY, t.StartOffset, @Today),
        DATEADD(DAY, t.StartOffset + t.DurDays, @Today),
        t.RequiredRole, 0,
        CASE WHEN t.Status IN (N'Done', N'Closed') THEN CAST(DATEADD(DAY, t.StartOffset, @Today) AS DATETIME) END,
        CASE WHEN t.Status IN (N'Done', N'Closed') THEN CAST(DATEADD(DAY, t.StartOffset + t.DurDays, @Today) AS DATETIME) END,
        CASE WHEN t.Status IN (N'Done', N'Closed') THEN t.EstHours END
    FROM @Tasks t
    INNER JOIN dbo.WorkItems p ON p.WorkType = N'Project' AND p.FinanceProjectNumber = t.Fin
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.WorkItems x
        WHERE x.WorkType = N'Task' AND x.ParentWorkItemId = p.WorkItemId AND x.Title = t.Title
    );
    RAISERROR(N'Tasks upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRAN;
    RAISERROR(N'== 04_seed_projects_tasks (tasks) FAILED and was rolled back. ==', 16, 1) WITH NOWAIT;
    THROW;
END CATCH;

RAISERROR(N'-- 04: tasks section done. --', 0, 1) WITH NOWAIT;

BEGIN TRY
    BEGIN TRAN;

    /* ================================================================
       TASK ASSIGNMENTS - one matching executor per task
       (employee PrimaryRole = task RequiredRole).
       ================================================================ */
    INSERT INTO dbo.WorkEmployeeAssignments (WorkItemId, EmployeeId, AssignmentRole, AssignedAt, AssignedHours, IsManualAssignment)
    SELECT t.WorkItemId, e.EmployeeId, N'מבצע ראשי', @Now, t.EstimatedHours, 1
    FROM dbo.WorkItems t
    INNER JOIN dbo.WorkItems p ON p.WorkItemId = t.ParentWorkItemId
        AND p.WorkType = N'Project' AND p.FinanceProjectNumber LIKE N'SEED-P%'
    CROSS APPLY (
        SELECT TOP (1) e.EmployeeId
        FROM dbo.Employees e
        WHERE e.IsActive = 1 AND e.IsAssignable = 1 AND e.PrimaryRole = t.RequiredRole
        ORDER BY e.EmployeeId
    ) e
    WHERE t.WorkType = N'Task' AND t.RequiredRole IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM dbo.WorkEmployeeAssignments wa
          WHERE wa.WorkItemId = t.WorkItemId AND wa.EmployeeId = e.EmployeeId
      );
    RAISERROR(N'Task executor assignments upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* ================================================================
       PROJECT TEAM - project manager (role recognised by the app as a
       manager) + team members (employees working on the project tasks).
       ================================================================ */
    INSERT INTO dbo.WorkEmployeeAssignments (WorkItemId, EmployeeId, AssignmentRole, AssignedAt, AssignedHours, IsManualAssignment)
    SELECT p.WorkItemId, e.EmployeeId, N'מנהל פרויקט', @Now, NULL, 1
    FROM @Projects pr
    INNER JOIN dbo.WorkItems p ON p.WorkType = N'Project' AND p.FinanceProjectNumber = pr.Fin
    CROSS APPLY (
        SELECT TOP (1) e.EmployeeId
        FROM dbo.Employees e
        WHERE e.IsActive = 1 AND e.PrimaryRole = pr.PmRole
        ORDER BY e.EmployeeId
    ) e
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.WorkEmployeeAssignments wa
        WHERE wa.WorkItemId = p.WorkItemId AND wa.EmployeeId = e.EmployeeId
    );
    RAISERROR(N'Project manager assignments upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    INSERT INTO dbo.WorkEmployeeAssignments (WorkItemId, EmployeeId, AssignmentRole, AssignedAt, AssignedHours, IsManualAssignment)
    SELECT DISTINCT p.WorkItemId, ta.EmployeeId, N'חבר צוות', @Now, NULL, 1
    FROM dbo.WorkItems p
    INNER JOIN dbo.WorkItems t ON t.ParentWorkItemId = p.WorkItemId AND t.WorkType = N'Task'
    INNER JOIN dbo.WorkEmployeeAssignments ta ON ta.WorkItemId = t.WorkItemId
    WHERE p.WorkType = N'Project' AND p.FinanceProjectNumber LIKE N'SEED-P%'
      AND NOT EXISTS (
          SELECT 1 FROM dbo.WorkEmployeeAssignments wa
          WHERE wa.WorkItemId = p.WorkItemId AND wa.EmployeeId = ta.EmployeeId
      );
    RAISERROR(N'Project team-member assignments upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* ================================================================
       CONTRACTOR ASSIGNMENTS - a few subcontracted scopes.
       ================================================================ */
    DECLARE @ContractorWork TABLE (Fin NVARCHAR(20), CompanyName NVARCHAR(100), Role NVARCHAR(100));
    INSERT INTO @ContractorWork (Fin, CompanyName, Role) VALUES
        (N'SEED-P01', N'כבלים ותקשורת מרכז',       N'קבלן השחלות תקשורת'),
        (N'SEED-P03', N'חשמל ותקשורת א.ב. בע״מ',   N'קבלן תשתיות חשמל'),
        (N'SEED-P07', N'עבודות גובה ותורן בע״מ',   N'עבודות גובה');

    INSERT INTO dbo.WorkContractorAssignments (WorkItemId, ContractorId, AssignmentRole, AssignedAt)
    SELECT p.WorkItemId, k.ContractorId, cw.Role, @Now
    FROM @ContractorWork cw
    INNER JOIN dbo.WorkItems p ON p.WorkType = N'Project' AND p.FinanceProjectNumber = cw.Fin
    INNER JOIN dbo.Contractors k ON k.CompanyName = cw.CompanyName
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.WorkContractorAssignments wca
        WHERE wca.WorkItemId = p.WorkItemId AND wca.ContractorId = k.ContractorId
    );
    RAISERROR(N'Contractor assignments upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRAN;
    RAISERROR(N'== 04_seed_projects_tasks (assignments) FAILED and was rolled back. ==', 16, 1) WITH NOWAIT;
    THROW;
END CATCH;

/* ---- Summary ------------------------------------------------------- */
SELECT
    (SELECT COUNT(*) FROM dbo.WorkItems WHERE WorkType = N'Project' AND FinanceProjectNumber LIKE N'SEED-P%') AS Projects_seeded,
    (SELECT COUNT(*) FROM dbo.WorkItems t WHERE t.WorkType = N'Task'
        AND EXISTS (SELECT 1 FROM dbo.WorkItems p WHERE p.WorkItemId = t.ParentWorkItemId AND p.FinanceProjectNumber LIKE N'SEED-P%')) AS Tasks_seeded,
    (SELECT COUNT(*) FROM dbo.WorkEmployeeAssignments) AS EmployeeAssignments_total,
    (SELECT COUNT(*) FROM dbo.WorkContractorAssignments) AS ContractorAssignments_total;

RAISERROR(N'== 04_seed_projects_tasks: done. ==', 0, 1) WITH NOWAIT;

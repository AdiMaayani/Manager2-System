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

   Project Status uses the canonical codes the React app understands and
   maps to Hebrew stages: Planned=בתכנון, Design=תוכניות, Wiring=השחלה,
   Execution=ביצוע, Closed=סיום (plus Open/Cancelled).

   DB LIMITATION: the app's project-status enum has no dedicated code for
   the business stages "סימון" and "ביקורת בטרם ביצוע". They are mapped to
   the nearest code (Design / Execution) and the precise business stage is
   recorded in the project Description ("שלב נוכחי: ..."). See 00_README.md.

   Milestone (Task) Status uses Planned/Execution/Closed/Cancelled. NOTE:
   sp_GetProjectLifecycle computes ProgressPercent = ClosedTasks /
   (Total - Cancelled); only Status='Closed' counts as done (NOT 'Done').
   Each project's closed/open task mix is tuned so the computed progress,
   risk and health are internally consistent with its stage:
     בתכנון 0-15% | תוכניות 10-25% | סימון 25-40% | השחלה 45-65%
     ביקורת בטרם ביצוע 70-85% | סיום 95-100% (healthy, low risk).
   Open tasks keep PlannedEnd in the future so healthy projects are not
   flagged delayed; only P07 (urgent) is intentionally At Risk (follow-up).

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
        PmName NVARCHAR(100),
        StartOffset INT,
        EndOffset INT,
        IsClosed BIT,
        Description NVARCHAR(1000)
    );
    /* PmName / task ExecutorName reference the assignable team leads + crew
       seeded in 03 (רותם, יובל, איתן, עופר, ליאור). Field work is never
       assigned to admin / management users. */
    INSERT INTO @Projects (Fin, Title, CustomerName, SiteName, Status, BillingType, Priority, EstimatedHours, PmName, StartOffset, EndOffset, IsClosed, Description) VALUES
        (N'SEED-P01', N'מערכת מצלמות אבטחה - קניון רננים',          N'קניון רננים - חברת ניהול',          N'קניון רננים - מתחם ראשי',        N'Execution', N'Fixed',  N'High',   180.00, N'יובל', -40, 25,  0, N'אספקה והתקנה של מערך מצלמות IP, NVR והקלטה מרכזית במתחם המסחרי. שלב נוכחי: ביקורת בטרם ביצוע.'),
        (N'SEED-P02', N'בקרת כניסה ומחסומי חניון - עיריית כפר סבא', N'עיריית כפר סבא',                    N'חניון עירוני מרכזי',             N'Wiring',    N'Fixed',  N'Medium', 140.00, N'יובל', -28, 20,  0, N'מערכת בקרת כניסה, מחסומים וזיהוי לוחית רישוי בחניון העירוני. שלב נוכחי: השחלה.'),
        (N'SEED-P03', N'תשתית תקשורת ומדף תקשורת - קמפוס אפקה',     N'מכללת אפקה להנדסה',                 N'קמפוס אפקה - בניין הנדסה',        N'Design',    N'Hourly', N'Medium', 160.00, N'רותם', -22, 28,  0, N'תכנון והקמת תשתית CAT6 וסיב אופטי, ארון תקשורת ומיתוג למעבדות. שלב נוכחי: סימון.'),
        (N'SEED-P04', N'מערכת כריזה ומולטימדיה - אולם כנסים ישרוטל',N'רשת מלונות ישרוטל',                 N'מלון ישרוטל תל אביב - אגף כנסים', N'Design',    N'Fixed',  N'Medium', 120.00, N'רותם', -6,  32,  0, N'מערכת כריזה, רמקולים, מקרנים ומסכים לאולמות הכנסים. שלב נוכחי: תוכניות.'),
        (N'SEED-P05', N'בקרת מבנה חכמה (BMS) - מגדלי הים התיכון',   N'מגדלי הים התיכון - ניהול ואחזקה',   N'מגדל מגורים A',                  N'Planned',   N'Fixed',  N'Low',    200.00, N'רותם', 8,   40,  0, N'בקרת מבנה לתאורה, מיזוג ומעליות בלובי ובשטחים הציבוריים. שלב נוכחי: בתכנון.'),
        (N'SEED-P06', N'שדרוג מערכת מצלמות ואזעקה - בנק הפועלים רעננה',N'בנק הפועלים סניף רעננה',          N'סניף רעננה מרכז',                N'Closed',    N'Fixed',  N'High',   90.00,  N'יובל', -60, -34, 1, N'שדרוג מצלמות, מערכת אזעקה ולחצני מצוקה באזור הקופות. שלב נוכחי: סיום.'),
        (N'SEED-P07', N'מערכת גילוי וכיבוי אש - מרכז רפואי מאיר',   N'מרכז רפואי מאיר',                   N'אגף אשפוז חדש',                  N'Wiring',    N'Fixed',  N'Urgent', 150.00, N'רותם', -18, 12,  0, N'מערכת גילוי אש כתובתית וכריזת חירום באגף האשפוז החדש. שלב נוכחי: השחלה (בסיכון - דורש מעקב כבאות).'),
        (N'SEED-P08', N'מערכת בית חכם - וילה משפחת לוי',            N'משפחת לוי - הרצליה פיתוח',          N'וילה פרטית הרצליה פיתוח',         N'Execution', N'Fixed',  N'Medium', 110.00, N'רותם', -22, 10,  0, N'אינטגרציית בית חכם: תאורה, מצלמות, מולטירום ובקרת אקלים. שלב נוכחי: ביקורת בטרם ביצוע.');

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
        ExecutorName NVARCHAR(100),
        EstHours DECIMAL(5,2),
        StartOffset INT,
        DurDays INT,
        StartHour INT
    );
    /* Status in {Closed, Execution, Planned}. Closed/Total drives the project
       progress band; open (Execution/Planned) tasks keep a FUTURE PlannedEnd
       so healthy projects are not flagged delayed. ExecutorName = assignable
       team lead / crew. RequiredRole = skill domain (aligned with 08). */
    INSERT INTO @Tasks (Fin, Title, Status, Priority, BillingType, RequiredRole, ExecutorName, EstHours, StartOffset, DurDays, StartHour) VALUES
        -- P01 cameras Renanim -> ביקורת בטרם ביצוע (~80%): 4 Closed / 5
        (N'SEED-P01', N'סקר אתר ותכנון מערכת',          N'Closed',    N'Medium', N'Hourly', N'ניהול פרויקטים',  N'יובל', 8.00,  -38, 3, 8),
        (N'SEED-P01', N'אספקת מצלמות ו-NVR',            N'Closed',    N'Low',    N'Fixed',  N'מצלמות אבטחה',    N'יובל', 6.00,  -33, 2, 9),
        (N'SEED-P01', N'השחלת תשתית תקשורת',            N'Closed',    N'Medium', N'Fixed',  N'כבילה ותשתיות',   N'איתן', 40.00, -26, 6, 8),
        (N'SEED-P01', N'התקנת מצלמות וכבילה',           N'Closed',    N'High',   N'Fixed',  N'מצלמות אבטחה',    N'עופר', 48.00, -14, 7, 8),
        (N'SEED-P01', N'הגדרת הקלטה ובדיקות מסירה',     N'Execution', N'Medium', N'Fixed',  N'מצלמות אבטחה',    N'יובל', 16.00, 1,   3, 9),
        -- P02 access KS -> השחלה (~50%): 2 Closed / 4
        (N'SEED-P02', N'סקר אתר ותכנון בקרה',           N'Closed',    N'Medium', N'Hourly', N'ניהול פרויקטים',  N'יובל', 8.00,  -26, 2, 8),
        (N'SEED-P02', N'אספקת בקרים וקוראים',           N'Closed',    N'Low',    N'Fixed',  N'שו"ב',            N'יובל', 6.00,  -20, 2, 9),
        (N'SEED-P02', N'השחלת תשתיות וחיווט',           N'Execution', N'Medium', N'Fixed',  N'כבילה ותשתיות',   N'איתן', 36.00, -3,  7, 8),
        (N'SEED-P02', N'הגדרת בקרת כניסה ומסירה',       N'Planned',   N'Medium', N'Fixed',  N'שו"ב',            N'ליאור',16.00, 10,  3, 9),
        -- P03 comms Afeka -> סימון (~33%): 1 Closed / 3
        (N'SEED-P03', N'סקר ותכנון תשתית תקשורת',       N'Closed',    N'Medium', N'Hourly', N'ניהול פרויקטים',  N'רותם', 12.00, -20, 3, 8),
        (N'SEED-P03', N'סימון נקודות ומסלולי כבילה',    N'Execution', N'Medium', N'Hourly', N'כבילה ותשתיות',   N'עופר', 24.00, -2,  8, 8),
        (N'SEED-P03', N'השחלת CAT6 וסיב אופטי',         N'Planned',   N'Medium', N'Hourly', N'כבילה ותשתיות',   N'איתן', 44.00, 12,  6, 8),
        -- P04 AV Isrotel -> תוכניות (~20%): 1 Closed / 5
        (N'SEED-P04', N'סקר אקוסטי ותכנון',             N'Closed',    N'Medium', N'Fixed',  N'ניהול פרויקטים',  N'רותם', 12.00, -6,  3, 8),
        (N'SEED-P04', N'תכנון מערכת מולטימדיה',         N'Execution', N'Medium', N'Fixed',  N'מולטימדיה',       N'רותם', 18.00, 0,   5, 9),
        (N'SEED-P04', N'אספקת ציוד מולטימדיה',          N'Planned',   N'Low',    N'Fixed',  N'מולטימדיה',       N'רותם', 6.00,  12,  2, 9),
        (N'SEED-P04', N'התקנת רמקולים ומגברים',         N'Planned',   N'Medium', N'Fixed',  N'מולטימדיה',       N'ליאור',40.00, 16,  5, 8),
        (N'SEED-P04', N'כיול והרצת מערכת',              N'Planned',   N'Medium', N'Fixed',  N'מולטימדיה',       N'רותם', 18.00, 23,  3, 9),
        -- P05 BMS MedTowers -> בתכנון (0%): 0 Closed / 4 (all future Planned)
        (N'SEED-P05', N'סקר ותכנון בקרת מבנה',          N'Planned',   N'Low',    N'Fixed',  N'ניהול פרויקטים',  N'רותם', 16.00, 9,   4, 8),
        (N'SEED-P05', N'חיווט בקרים וחיישנים',          N'Planned',   N'Medium', N'Fixed',  N'חשמל חכם',        N'איתן', 48.00, 16,  6, 8),
        (N'SEED-P05', N'התקנת בקרי DDC',                N'Planned',   N'Medium', N'Fixed',  N'שו"ב',            N'עופר', 36.00, 24,  5, 8),
        (N'SEED-P05', N'תכנות והרצת מערכת',             N'Planned',   N'Medium', N'Fixed',  N'חשמל חכם',        N'רותם', 24.00, 33,  4, 9),
        -- P06 bank -> סיום (100%): all Closed in the past
        (N'SEED-P06', N'סקר אתר ותכנון שדרוג',          N'Closed',    N'Medium', N'Fixed',  N'ניהול פרויקטים',  N'יובל', 8.00,  -60, 2, 8),
        (N'SEED-P06', N'אספקת מצלמות ורכזת אזעקה',      N'Closed',    N'Low',    N'Fixed',  N'מצלמות אבטחה',    N'יובל', 6.00,  -56, 2, 9),
        (N'SEED-P06', N'החלפת מצלמות וכבילה',           N'Closed',    N'High',   N'Fixed',  N'מצלמות אבטחה',    N'עופר', 32.00, -52, 5, 8),
        (N'SEED-P06', N'התקנת מערכת אזעקה ולחצני מצוקה',N'Closed',    N'High',   N'Fixed',  N'מערכות אזעקה',    N'איתן', 24.00, -44, 4, 8),
        (N'SEED-P06', N'בדיקות מסירה ואחריות',          N'Closed',    N'Medium', N'Fixed',  N'אבחון ותיקון תקלות', N'יובל',12.00, -38, 2, 9),
        -- P07 fire Meir -> השחלה (~50%, urgent, AT RISK via follow-up report): 2 Closed / 4
        (N'SEED-P07', N'תכנון מערכת גילוי אש',          N'Closed',    N'High',   N'Fixed',  N'ניהול פרויקטים',  N'רותם', 12.00, -18, 3, 8),
        (N'SEED-P07', N'אספקת גלאים ורכזת',             N'Closed',    N'Medium', N'Fixed',  N'מערכות אזעקה',    N'רותם', 6.00,  -14, 2, 9),
        (N'SEED-P07', N'חיווט והתקנת גלאים',            N'Execution', N'Urgent', N'Fixed',  N'מערכות אזעקה',    N'איתן', 44.00, -2,  6, 8),
        (N'SEED-P07', N'בדיקות תקן ואישור כבאות',       N'Planned',   N'High',   N'Fixed',  N'אבחון ותיקון תקלות', N'יובל',16.00, 7,   3, 9),
        -- P08 smart home Levi -> ביקורת בטרם ביצוע (~75%): 3 Closed / 4
        (N'SEED-P08', N'תכנון בית חכם',                 N'Closed',    N'Medium', N'Fixed',  N'ניהול פרויקטים',  N'רותם', 10.00, -22, 4, 8),
        (N'SEED-P08', N'השחלה וחיווט',                  N'Closed',    N'Medium', N'Fixed',  N'כבילה ותשתיות',   N'עופר', 40.00, -15, 5, 8),
        (N'SEED-P08', N'התקנת מצלמות ובקרה',            N'Closed',    N'Medium', N'Fixed',  N'חשמל חכם',        N'רותם', 32.00, -6,  6, 8),
        (N'SEED-P08', N'אינטגרציה והדרכת לקוח',         N'Execution', N'Medium', N'Fixed',  N'חשמל חכם',        N'רותם', 12.00, 1,   3, 9);

    INSERT INTO dbo.WorkItems (Title, WorkType, Status, BillingType, Description, CustomerId, SiteId, CreatedAt, ClosedAt, ParentWorkItemId, EstimatedHours, Priority, PlannedStart, PlannedEnd, RequiredRole, IsLocked, ActualStart, ActualEnd, ActualHours)
    SELECT
        t.Title, N'Task', t.Status, t.BillingType, NULL, p.CustomerId, p.SiteId,
        DATEADD(DAY, t.StartOffset - 3, @Now),
        CASE WHEN t.Status = N'Closed' THEN DATEADD(DAY, t.StartOffset + t.DurDays, @Now) END,
        p.WorkItemId,
        t.EstHours, t.Priority,
        DATEADD(HOUR, t.StartHour, CAST(DATEADD(DAY, t.StartOffset, @Today) AS DATETIME2(0))),
        DATEADD(HOUR, 16, CAST(DATEADD(DAY, t.StartOffset + t.DurDays, @Today) AS DATETIME2(0))),
        t.RequiredRole, 0,
        CASE WHEN t.Status = N'Closed' THEN CAST(DATEADD(HOUR, t.StartHour, CAST(DATEADD(DAY, t.StartOffset, @Today) AS DATETIME)) AS DATETIME) END,
        CASE WHEN t.Status = N'Closed' THEN CAST(DATEADD(HOUR, 16, CAST(DATEADD(DAY, t.StartOffset + t.DurDays, @Today) AS DATETIME)) AS DATETIME) END,
        CASE WHEN t.Status = N'Closed' THEN t.EstHours END
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
       TASK ASSIGNMENTS - explicit executor per task (ExecutorName), so the
       WorkPlan / Gantt is populated by the intended operational employee.
       Field work is never assigned to admin / management users.
       ================================================================ */
    INSERT INTO dbo.WorkEmployeeAssignments (WorkItemId, EmployeeId, AssignmentRole, AssignedAt, AssignedHours, IsManualAssignment)
    SELECT wi.WorkItemId, e.EmployeeId, N'מבצע ראשי', @Now, wi.EstimatedHours, 1
    FROM @Tasks t
    INNER JOIN dbo.WorkItems p ON p.WorkType = N'Project' AND p.FinanceProjectNumber = t.Fin
    INNER JOIN dbo.WorkItems wi ON wi.WorkType = N'Task' AND wi.ParentWorkItemId = p.WorkItemId AND wi.Title = t.Title
    INNER JOIN dbo.Employees e ON e.FullName = t.ExecutorName AND e.IsActive = 1
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.WorkEmployeeAssignments wa
        WHERE wa.WorkItemId = wi.WorkItemId AND wa.EmployeeId = e.EmployeeId
    );
    RAISERROR(N'Task executor assignments upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* ================================================================
       PROJECT TEAM - project manager (role recognised by the app as a
       manager: 'מנהל פרויקט') + team members (employees working on tasks).
       PM is the named team lead (רותם / יובל) from @Projects.PmName.
       ================================================================ */
    INSERT INTO dbo.WorkEmployeeAssignments (WorkItemId, EmployeeId, AssignmentRole, AssignedAt, AssignedHours, IsManualAssignment)
    SELECT p.WorkItemId, e.EmployeeId, N'מנהל פרויקט', @Now, NULL, 1
    FROM @Projects pr
    INNER JOIN dbo.WorkItems p ON p.WorkType = N'Project' AND p.FinanceProjectNumber = pr.Fin
    INNER JOIN dbo.Employees e ON e.FullName = pr.PmName AND e.IsActive = 1
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

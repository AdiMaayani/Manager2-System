/* =====================================================================
   ManageR2 - Dev Realistic Seed
   07_seed_service_calls_internal.sql

   Seeds:
     - Service calls (WorkType='ServiceCall') across the lifecycle
       (Open / InProgress / Done / Cancelled), tied to customers + sites,
       with realistic fault descriptions, priorities and billing types
       ({Hourly, Fixed, Warranty}). RequiredRole = skill domain.
     - Internal / office tasks (WorkType='Task') parented to the reserved
       internal container (FinanceProjectNumber='INTERNAL', BillingType
       'Internal'), provisioned by sp_WorkItems_GetInternalContext.
     - A DENSE daily WorkPlan field schedule (also parented to the internal
       container) so the WorkPlan daily/weekly/monthly views are populated
       across the demo horizon. Tasks are spread over the operational crew
       (רותם / יובל / איתן / עופר / ליאור) with realistic 08:00-17:00
       morning / noon / afternoon windows. Admin / management users get NO
       field tasks.
     - One explicit employee assignment per service call / task (by name).

   NOTE: Service calls have ParentWorkItemId = NULL, so they appear on the
   Service Calls page (not the WorkPlan Gantt, which only lists children of
   a Project). The WorkPlan field schedule below is parented to the internal
   container precisely so it shows on the WorkPlan without skewing the
   staged SEED-P% project progress.

   Natural keys: service call Title (table emptied in cleanup, so all
   ServiceCall rows here are seeded); internal task (ParentWorkItemId, Title).
   Depends on 03 (customers/sites/employees). Idempotent.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() IN (N'master', N'model', N'msdb', N'tempdb')
    THROW 60010, N'Refusing to run against a system database. Select your ManageR2 dev database first.', 1;
IF OBJECT_ID(N'dbo.WorkItems', N'U') IS NULL OR OBJECT_ID(N'dbo.sp_WorkItems_GetInternalContext', N'P') IS NULL
    THROW 60011, N'WorkItems / sp_WorkItems_GetInternalContext not found. Aborting.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerType <> N'Internal')
    THROW 60012, N'No seeded customers found. Run 03_seed_core.sql before 07.', 1;

RAISERROR(N'== 07_seed_service_calls_internal: starting ==', 0, 1) WITH NOWAIT;

DECLARE @Today DATE = CAST(SYSUTCDATETIME() AS DATE);
DECLARE @Now DATETIME2(7) = SYSUTCDATETIME();

/* ================================================================
   SERVICE CALLS
   ================================================================ */
BEGIN TRY
    BEGIN TRAN;

    DECLARE @ServiceCalls TABLE (
        Title NVARCHAR(150),
        CustomerName NVARCHAR(200),
        SiteName NVARCHAR(100),
        Status NVARCHAR(50),
        Priority NVARCHAR(20),
        BillingType NVARCHAR(50),
        RequiredRole NVARCHAR(100),
        ExecutorName NVARCHAR(100),
        EstHours DECIMAL(5,2),
        StartOffset INT,
        Description NVARCHAR(1000)
    );
    INSERT INTO @ServiceCalls (Title, CustomerName, SiteName, Status, Priority, BillingType, RequiredRole, ExecutorName, EstHours, StartOffset, Description) VALUES
        (N'תקלה במצלמת כניסה ראשית',          N'קניון רננים - חברת ניהול',        N'קניון רננים - מתחם ראשי',  N'InProgress', N'High',   N'Hourly',   N'מצלמות אבטחה',        N'עופר', 3.0, -1, N'מצלמת הכיפה בכניסה הראשית אינה משדרת תמונה; נדרש בירור הזנה וחיבור רשת.'),
        (N'דלת כניסה ראשית אינה משחררת',      N'עיריית כפר סבא',                  N'בניין העירייה הראשי',      N'Open',       N'High',   N'Hourly',   N'שו"ב',                N'יובל', 2.5, 0,  N'מנעול מגנטי בדלת הכניסה הראשית נשאר נעול גם לאחר העברת כרטיס מורשה.'),
        (N'גלאי עשן בתקלה במסדרון C',         N'מרכז רפואי מאיר',                 N'אגף אשפוז חדש',            N'Open',       N'Urgent', N'Warranty', N'מערכות אזעקה',        N'איתן', 4.0, 0,  N'התראת תקלה חוזרת מגלאי עשן במסדרון C; נדרשת בדיקה דחופה ודיווח לכבאות.'),
        (N'מצלמת כספת אינה מקליטה',           N'בנק הפועלים סניף רעננה',          N'סניף רעננה מרכז',          N'Done',       N'Medium', N'Warranty', N'מצלמות אבטחה',        N'עופר', 2.0, -8, N'מצלמת אזור הכספת לא נשמרה בהקלטה; הוחלף כבל וקונפיגורציית ערוץ ב-NVR.'),
        (N'אינטרקום לובי תקול',               N'מגדלי הים התיכון - ניהול ואחזקה', N'מגדל מגורים A',            N'InProgress', N'Medium', N'Hourly',   N'טלפוניה ואינטרקום',   N'ליאור',3.0, -2, N'לוח האינטרקום בלובי אינו מצלצל בחלק מהדירות; נבדקת יחידת הבקרה.'),
        (N'נקודת רשת מעבדה 3 אינה עובדת',     N'מכללת אפקה להנדסה',               N'קמפוס אפקה - בניין הנדסה', N'Done',       N'Low',    N'Hourly',   N'רשת מחשבים',          N'איתן', 2.0, -6, N'נקודת רשת במעבדה 3 ללא קישוריות; אותרה תקלה בפאנל ובוצע תיקון וסימון.'),
        (N'רעש במערכת הכריזה באולם 2',        N'רשת מלונות ישרוטל',               N'מלון ישרוטל תל אביב - אגף כנסים', N'Open', N'Medium', N'Hourly',  N'מולטימדיה',           N'רותם', 3.0, 1,  N'רעש רקע במגבר הכריזה באולם 2 בעת הפעלה; נדרשת בדיקת הארקה וכבילה.'),
        (N'תקלה בבקרת תאורה בקומה 2',         N'משפחת לוי - הרצליה פיתוח',        N'וילה פרטית הרצליה פיתוח',  N'Cancelled',  N'Low',    N'Fixed',    N'חשמל חכם',            N'רותם', 2.0, -4, N'הלקוח דיווח על בקרת תאורה לא מגיבה; הקריאה בוטלה לאחר שהתברר כתקלת רשת זמנית.'),
        (N'מחסום כניסה לחניון תקוע',          N'קניון רננים - חברת ניהול',        N'חניון קניון רננים',        N'Done',       N'High',   N'Hourly',   N'שו"ב',                N'יובל', 3.5, -10,N'זרוע המחסום נתקעה במצב פתוח; בוצע כיול מנוע והחלפת חיישן לולאה.'),
        (N'קורא כרטיסים בעמדה 2 אינו מגיב',   N'עיריית כפר סבא',                  N'חניון עירוני מרכזי',       N'InProgress', N'Medium', N'Hourly',   N'שו"ב',                N'יובל', 2.5, -1, N'קורא הכרטיסים בעמדה 2 אינו מגיב; נבדקים הזנה וכבל תקשורת לבקר.');

    INSERT INTO dbo.WorkItems (Title, WorkType, Status, BillingType, Description, CustomerId, SiteId, CreatedAt, ClosedAt, ParentWorkItemId, EstimatedHours, Priority, PlannedStart, PlannedEnd, RequiredRole, IsLocked, ActualStart, ActualEnd, ActualHours)
    SELECT
        sc.Title, N'ServiceCall', sc.Status, sc.BillingType, sc.Description, c.CustomerId, s.SiteId,
        DATEADD(DAY, sc.StartOffset - 1, @Now),
        CASE WHEN sc.Status IN (N'Done', N'Cancelled') THEN DATEADD(HOUR, 9 + sc.EstHours, CAST(DATEADD(DAY, sc.StartOffset, @Today) AS DATETIME2(7))) END,
        NULL,
        sc.EstHours, sc.Priority,
        DATEADD(HOUR, 9, CAST(DATEADD(DAY, sc.StartOffset, @Today) AS DATETIME2(7))),
        DATEADD(HOUR, 9 + sc.EstHours, CAST(DATEADD(DAY, sc.StartOffset, @Today) AS DATETIME2(7))),
        sc.RequiredRole, 0,
        CASE WHEN sc.Status = N'Done' THEN CAST(DATEADD(HOUR, 9, CAST(DATEADD(DAY, sc.StartOffset, @Today) AS DATETIME)) AS DATETIME) END,
        CASE WHEN sc.Status = N'Done' THEN CAST(DATEADD(HOUR, 9 + sc.EstHours, CAST(DATEADD(DAY, sc.StartOffset, @Today) AS DATETIME)) AS DATETIME) END,
        CASE WHEN sc.Status = N'Done' THEN sc.EstHours END
    FROM @ServiceCalls sc
    INNER JOIN dbo.Customers c ON c.CustomerName = sc.CustomerName
    INNER JOIN dbo.Sites s ON s.CustomerId = c.CustomerId AND s.SiteName = sc.SiteName
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.WorkItems x WHERE x.WorkType = N'ServiceCall' AND x.Title = sc.Title
    );
    RAISERROR(N'Service calls upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* Assign the named technician per service call (skip Cancelled). */
    INSERT INTO dbo.WorkEmployeeAssignments (WorkItemId, EmployeeId, AssignmentRole, AssignedAt, AssignedHours, IsManualAssignment)
    SELECT wi.WorkItemId, e.EmployeeId, N'טכנאי מטפל', @Now, sc.EstHours, 1
    FROM @ServiceCalls sc
    INNER JOIN dbo.WorkItems wi ON wi.WorkType = N'ServiceCall' AND wi.Title = sc.Title
    INNER JOIN dbo.Employees e ON e.FullName = sc.ExecutorName AND e.IsActive = 1
    WHERE sc.Status <> N'Cancelled'
      AND NOT EXISTS (SELECT 1 FROM dbo.WorkEmployeeAssignments wa WHERE wa.WorkItemId = wi.WorkItemId AND wa.EmployeeId = e.EmployeeId);
    RAISERROR(N'Service-call technician assignments upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRAN;
    RAISERROR(N'== 07 (service calls) FAILED and was rolled back. ==', 16, 1) WITH NOWAIT;
    THROW;
END CATCH;

RAISERROR(N'-- 07: service calls section done. --', 0, 1) WITH NOWAIT;

/* ================================================================
   INTERNAL / OFFICE TASKS - parented to the reserved container.
   ================================================================ */
BEGIN TRY
    /* Ensure the reserved internal context exists (idempotent). */
    EXEC dbo.sp_WorkItems_GetInternalContext;

    DECLARE @intCustomerId INT, @intSiteId INT, @container INT;
    SELECT TOP (1) @intCustomerId = CustomerId FROM dbo.Customers WHERE CustomerType = N'Internal' ORDER BY CustomerId;
    SELECT TOP (1) @container = WorkItemId FROM dbo.WorkItems WHERE WorkType = N'Project' AND FinanceProjectNumber = N'INTERNAL' ORDER BY WorkItemId;
    SELECT TOP (1) @intSiteId = SiteId FROM dbo.Sites WHERE CustomerId = @intCustomerId ORDER BY IsPrimary DESC, SiteId;

    IF @container IS NULL OR @intCustomerId IS NULL
        THROW 60013, N'Internal work context missing after provisioning. Aborting internal tasks.', 1;

    BEGIN TRAN;

    DECLARE @InternalTasks TABLE (
        Title NVARCHAR(150),
        Status NVARCHAR(50),
        Priority NVARCHAR(20),
        RequiredRole NVARCHAR(100),
        ExecutorName NVARCHAR(100),
        EstHours DECIMAL(5,2),
        StartOffset INT,
        DurDays INT,
        StartHour INT,
        Description NVARCHAR(1000)
    );
    INSERT INTO @InternalTasks (Title, Status, Priority, RequiredRole, ExecutorName, EstHours, StartOffset, DurDays, StartHour, Description) VALUES
        (N'הזמנת ציוד למלאי - מצלמות ו-NVR',  N'Execution', N'Medium', N'ניהול פרויקטים',     N'רותם', 4.0, -3, 2, 8,  N'ריכוז דרישות והזמנת ציוד מצלמות ו-NVR מהספקים לחידוש המלאי.'),
        (N'ספירת מלאי רבעונית במחסן',          N'Planned',   N'Low',    N'אבחון ותיקון תקלות', N'איתן', 8.0, 7,  1, 8,  N'ספירת מלאי תקופתית במחסן הראשי והשוואה למערכת.'),
        (N'הכנת הצעת מחיר ללקוח חדש',          N'Planned',   N'Medium', N'ניהול פרויקטים',     N'יובל', 6.0, 2,  1, 9,  N'איסוף דרישות והכנת הצעת מחיר ללקוח פוטנציאלי חדש.'),
        (N'תחזוקת רכב שירות מספר 3',           N'Closed',    N'Low',    N'אבחון ותיקון תקלות', N'עופר', 3.0, -10,1, 8,  N'טיפול תקופתי ובדיקת ציוד ברכב השירות מספר 3.'),
        (N'הדרכת בטיחות לצוות התקנה',          N'Planned',   N'Medium', N'ניהול פרויקטים',     N'רותם', 4.0, 12, 1, 9,  N'רענון נהלי בטיחות ועבודה בגובה לצוות ההתקנה.'),
        (N'עדכון תיק לקוח ומסמכי מסירה',       N'Execution', N'Low',    N'ניהול פרויקטים',     N'יובל', 5.0, -2, 3, 13, N'סריקה וארגון מסמכי מסירה ועדכון תיקי לקוח במערכת.');

    INSERT INTO dbo.WorkItems (Title, WorkType, Status, BillingType, Description, CustomerId, SiteId, CreatedAt, ClosedAt, ParentWorkItemId, EstimatedHours, Priority, PlannedStart, PlannedEnd, RequiredRole, IsLocked, ActualStart, ActualEnd, ActualHours)
    SELECT
        it.Title, N'Task', it.Status, N'Internal', it.Description, @intCustomerId, @intSiteId,
        DATEADD(DAY, it.StartOffset - 2, @Now),
        CASE WHEN it.Status = N'Closed' THEN DATEADD(DAY, it.StartOffset + it.DurDays, @Now) END,
        @container,
        it.EstHours, it.Priority,
        DATEADD(HOUR, it.StartHour, CAST(DATEADD(DAY, it.StartOffset, @Today) AS DATETIME2(7))),
        DATEADD(HOUR, it.StartHour + 4, CAST(DATEADD(DAY, it.StartOffset + it.DurDays, @Today) AS DATETIME2(7))),
        it.RequiredRole, 0,
        CASE WHEN it.Status = N'Closed' THEN CAST(DATEADD(HOUR, it.StartHour, CAST(DATEADD(DAY, it.StartOffset, @Today) AS DATETIME)) AS DATETIME) END,
        CASE WHEN it.Status = N'Closed' THEN CAST(DATEADD(HOUR, it.StartHour + 4, CAST(DATEADD(DAY, it.StartOffset + it.DurDays, @Today) AS DATETIME)) AS DATETIME) END,
        CASE WHEN it.Status = N'Closed' THEN it.EstHours END
    FROM @InternalTasks it
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.WorkItems x WHERE x.WorkType = N'Task' AND x.ParentWorkItemId = @container AND x.Title = it.Title
    );
    RAISERROR(N'Internal/office tasks upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* Assign the named owner per internal task. */
    INSERT INTO dbo.WorkEmployeeAssignments (WorkItemId, EmployeeId, AssignmentRole, AssignedAt, AssignedHours, IsManualAssignment)
    SELECT wi.WorkItemId, e.EmployeeId, N'אחראי משימה', @Now, it.EstHours, 1
    FROM @InternalTasks it
    INNER JOIN dbo.WorkItems wi ON wi.WorkType = N'Task' AND wi.ParentWorkItemId = @container AND wi.Title = it.Title
    INNER JOIN dbo.Employees e ON e.FullName = it.ExecutorName AND e.IsActive = 1
    WHERE NOT EXISTS (SELECT 1 FROM dbo.WorkEmployeeAssignments wa WHERE wa.WorkItemId = wi.WorkItemId AND wa.EmployeeId = e.EmployeeId);
    RAISERROR(N'Internal-task assignments upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRAN;
    RAISERROR(N'== 07 (internal tasks) FAILED and was rolled back. ==', 16, 1) WITH NOWAIT;
    THROW;
END CATCH;

RAISERROR(N'-- 07: internal tasks section done. --', 0, 1) WITH NOWAIT;

/* ================================================================
   DENSE WORKPLAN FIELD SCHEDULE - parented to the internal container so
   it appears on the WorkPlan (daily/weekly/monthly) without touching the
   staged SEED-P% project progress. One task per (employee, working day)
   across the demo horizon, with realistic 08:00-17:00 windows spread
   across morning / noon / afternoon. Operational crew only.
   Idempotent: natural key (ParentWorkItemId, Title) where Title encodes
   the employee + date. Status follows the date (past=Closed, today=
   Execution, future=Planned).
   ================================================================ */
BEGIN TRY
    BEGIN TRAN;

    DECLARE @HorizonStart DATE = DATEADD(DAY, -7, @Today);   -- one week back ...
    DECLARE @HorizonDays  INT  = 35;                          -- ... through ~4 weeks ahead

    /* Per-employee daily slot plan (morning / noon / afternoon). Cadence/Phase
       thin out the team leads so the board stays active but not chaotic. */
    DECLARE @Slots TABLE (SlotIndex INT, EmpName NVARCHAR(100), StartHour INT, EndHour INT, Cadence INT, Phase INT);
    INSERT INTO @Slots (SlotIndex, EmpName, StartHour, EndHour, Cadence, Phase) VALUES
        (0, N'איתן', 8,  12, 1, 0),   -- every day, morning
        (1, N'עופר', 13, 17, 1, 0),   -- every day, afternoon
        (2, N'ליאור',8,  12, 2, 0),   -- alternating mornings ...
        (3, N'ליאור',13, 17, 2, 1),   -- ... and afternoons
        (4, N'יובל', 9,  13, 2, 0),   -- every 2nd day, late morning
        (5, N'רותם', 10, 14, 3, 0);   -- every 3rd day, midday

    /* Activity pool (title + skill domain), rotated by day so titles vary. */
    DECLARE @Activities TABLE (Idx INT, Activity NVARCHAR(80), RequiredRole NVARCHAR(100));
    INSERT INTO @Activities (Idx, Activity, RequiredRole) VALUES
        (0, N'סבב התקנות מצלמות אבטחה',  N'מצלמות אבטחה'),
        (1, N'השלמת תשתיות וכבילה',      N'כבילה ותשתיות'),
        (2, N'בדיקת מערכת בקרת כניסה',   N'שו"ב'),
        (3, N'תחזוקת מערכת אזעקה',       N'מערכות אזעקה'),
        (4, N'התקנת עמדת מולטימדיה',     N'מולטימדיה'),
        (5, N'סבב שירות ותיקון תקלות',   N'אבחון ותיקון תקלות');

    IF OBJECT_ID(N'tempdb..#FieldSchedule') IS NOT NULL DROP TABLE #FieldSchedule;

    ;WITH Tally AS (
        SELECT TOP (@HorizonDays) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS d
        FROM sys.all_objects
    ),
    DayList AS (
        SELECT d, CAST(DATEADD(DAY, d, @HorizonStart) AS DATE) AS WorkDate FROM Tally
    )
    SELECT
        sl.EmpName,
        a.Activity + N' · ' + sl.EmpName + N' · ' + CONVERT(NVARCHAR(10), dl.WorkDate, 104) AS Title,
        a.RequiredRole,
        CASE WHEN dl.WorkDate < @Today THEN N'Closed'
             WHEN dl.WorkDate = @Today THEN N'Execution'
             ELSE N'Planned' END AS Status,
        DATEADD(HOUR, sl.StartHour, CAST(dl.WorkDate AS DATETIME2(7))) AS PlannedStart,
        DATEADD(HOUR, sl.EndHour,   CAST(dl.WorkDate AS DATETIME2(7))) AS PlannedEnd,
        CAST(sl.EndHour - sl.StartHour AS DECIMAL(5,2)) AS EstHours
    INTO #FieldSchedule
    FROM DayList dl
    INNER JOIN @Slots sl ON (dl.d % sl.Cadence) = sl.Phase
    INNER JOIN @Activities a ON a.Idx = (dl.d + sl.SlotIndex) % 6;

    INSERT INTO dbo.WorkItems (Title, WorkType, Status, BillingType, Description, CustomerId, SiteId, CreatedAt, ClosedAt, ParentWorkItemId, EstimatedHours, Priority, PlannedStart, PlannedEnd, RequiredRole, IsLocked, ActualStart, ActualEnd, ActualHours)
    SELECT
        fs.Title, N'Task', fs.Status, N'Internal', N'משימת לוח עבודה יומי (צוות שטח).', @intCustomerId, @intSiteId,
        DATEADD(DAY, -1, fs.PlannedStart),
        CASE WHEN fs.Status = N'Closed' THEN fs.PlannedEnd END,
        @container,
        fs.EstHours, N'Medium',
        fs.PlannedStart, fs.PlannedEnd,
        fs.RequiredRole, 0,
        CASE WHEN fs.Status = N'Closed' THEN CAST(fs.PlannedStart AS DATETIME) END,
        CASE WHEN fs.Status = N'Closed' THEN CAST(fs.PlannedEnd AS DATETIME) END,
        CASE WHEN fs.Status = N'Closed' THEN fs.EstHours END
    FROM #FieldSchedule fs
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.WorkItems x WHERE x.WorkType = N'Task' AND x.ParentWorkItemId = @container AND x.Title = fs.Title
    );
    RAISERROR(N'WorkPlan field-schedule tasks upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    INSERT INTO dbo.WorkEmployeeAssignments (WorkItemId, EmployeeId, AssignmentRole, AssignedAt, AssignedHours, IsManualAssignment)
    SELECT wi.WorkItemId, e.EmployeeId, N'מבצע ראשי', @Now, fs.EstHours, 1
    FROM #FieldSchedule fs
    INNER JOIN dbo.WorkItems wi ON wi.WorkType = N'Task' AND wi.ParentWorkItemId = @container AND wi.Title = fs.Title
    INNER JOIN dbo.Employees e ON e.FullName = fs.EmpName AND e.IsActive = 1
    WHERE NOT EXISTS (SELECT 1 FROM dbo.WorkEmployeeAssignments wa WHERE wa.WorkItemId = wi.WorkItemId AND wa.EmployeeId = e.EmployeeId);
    RAISERROR(N'WorkPlan field-schedule assignments upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* A light monthly maintenance round (-5 .. +6 months) so the WorkPlan
       yearly view is also populated. Alternates between the two team leads. */
    IF OBJECT_ID(N'tempdb..#MonthlyMaint') IS NOT NULL DROP TABLE #MonthlyMaint;
    ;WITH M AS (
        SELECT TOP (12) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 6 AS m
        FROM sys.all_objects
    )
    SELECT
        CASE WHEN m % 2 = 0 THEN N'רותם' ELSE N'יובל' END AS EmpName,
        N'סבב אחזקה חודשי · ' + CONVERT(NVARCHAR(7), DATEADD(MONTH, m, @Today), 126) AS Title,
        CAST(DATEADD(HOUR, 9, CAST(DATEADD(MONTH, m, @Today) AS DATETIME2(7))) AS DATETIME2(7)) AS PlannedStart,
        CAST(DATEADD(HOUR, 14, CAST(DATEADD(MONTH, m, @Today) AS DATETIME2(7))) AS DATETIME2(7)) AS PlannedEnd,
        CASE WHEN m < 0 THEN N'Closed' WHEN m = 0 THEN N'Execution' ELSE N'Planned' END AS Status
    INTO #MonthlyMaint
    FROM M;

    INSERT INTO dbo.WorkItems (Title, WorkType, Status, BillingType, Description, CustomerId, SiteId, CreatedAt, ClosedAt, ParentWorkItemId, EstimatedHours, Priority, PlannedStart, PlannedEnd, RequiredRole, IsLocked, ActualStart, ActualEnd, ActualHours)
    SELECT
        mm.Title, N'Task', mm.Status, N'Internal', N'סבב אחזקה תקופתי ללקוחות חוזה שירות.', @intCustomerId, @intSiteId,
        DATEADD(DAY, -2, mm.PlannedStart),
        CASE WHEN mm.Status = N'Closed' THEN mm.PlannedEnd END,
        @container,
        5.00, N'Low',
        mm.PlannedStart, mm.PlannedEnd,
        N'אבחון ותיקון תקלות', 0,
        CASE WHEN mm.Status = N'Closed' THEN CAST(mm.PlannedStart AS DATETIME) END,
        CASE WHEN mm.Status = N'Closed' THEN CAST(mm.PlannedEnd AS DATETIME) END,
        CASE WHEN mm.Status = N'Closed' THEN 5.00 END
    FROM #MonthlyMaint mm
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.WorkItems x WHERE x.WorkType = N'Task' AND x.ParentWorkItemId = @container AND x.Title = mm.Title
    );
    RAISERROR(N'Monthly maintenance tasks upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    INSERT INTO dbo.WorkEmployeeAssignments (WorkItemId, EmployeeId, AssignmentRole, AssignedAt, AssignedHours, IsManualAssignment)
    SELECT wi.WorkItemId, e.EmployeeId, N'מבצע ראשי', @Now, 5.00, 1
    FROM #MonthlyMaint mm
    INNER JOIN dbo.WorkItems wi ON wi.WorkType = N'Task' AND wi.ParentWorkItemId = @container AND wi.Title = mm.Title
    INNER JOIN dbo.Employees e ON e.FullName = mm.EmpName AND e.IsActive = 1
    WHERE NOT EXISTS (SELECT 1 FROM dbo.WorkEmployeeAssignments wa WHERE wa.WorkItemId = wi.WorkItemId AND wa.EmployeeId = e.EmployeeId);
    RAISERROR(N'Monthly maintenance assignments upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    IF OBJECT_ID(N'tempdb..#FieldSchedule') IS NOT NULL DROP TABLE #FieldSchedule;
    IF OBJECT_ID(N'tempdb..#MonthlyMaint') IS NOT NULL DROP TABLE #MonthlyMaint;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRAN;
    IF OBJECT_ID(N'tempdb..#FieldSchedule') IS NOT NULL DROP TABLE #FieldSchedule;
    IF OBJECT_ID(N'tempdb..#MonthlyMaint') IS NOT NULL DROP TABLE #MonthlyMaint;
    RAISERROR(N'== 07 (workplan schedule) FAILED and was rolled back. ==', 16, 1) WITH NOWAIT;
    THROW;
END CATCH;

/* ---- Summary ------------------------------------------------------- */
SELECT
    (SELECT COUNT(*) FROM dbo.WorkItems WHERE WorkType = N'ServiceCall')  AS ServiceCalls_total,
    (SELECT COUNT(*) FROM dbo.WorkItems t
        INNER JOIN dbo.WorkItems p ON p.WorkItemId = t.ParentWorkItemId
        WHERE t.WorkType = N'Task' AND p.FinanceProjectNumber = N'INTERNAL'
          AND t.Title NOT LIKE N'% · %') AS OfficeTasks_total,
    (SELECT COUNT(*) FROM dbo.WorkItems t
        INNER JOIN dbo.WorkItems p ON p.WorkItemId = t.ParentWorkItemId
        WHERE t.WorkType = N'Task' AND p.FinanceProjectNumber = N'INTERNAL'
          AND t.Title LIKE N'% · %') AS WorkPlanScheduleTasks_total,
    (SELECT COUNT(*) FROM dbo.WorkItems t
        INNER JOIN dbo.WorkItems p ON p.WorkItemId = t.ParentWorkItemId
        WHERE t.WorkType = N'Task' AND p.FinanceProjectNumber = N'INTERNAL') AS InternalContainerTasks_total;

RAISERROR(N'== 07_seed_service_calls_internal: done. ==', 0, 1) WITH NOWAIT;

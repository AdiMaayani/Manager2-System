/* =====================================================================
   ManageR2 - Dev Realistic Seed
   07_seed_service_calls_internal.sql

   Seeds:
     - Service calls (WorkType='ServiceCall') across the lifecycle
       (Open / InProgress / Done / Cancelled), tied to customers + sites,
       with realistic fault descriptions, priorities and billing types
       ({Hourly, Fixed, Warranty}). RequiredRole aligns with the roster.
     - Internal / office tasks (WorkType='Task') parented to the reserved
       internal container (FinanceProjectNumber='INTERNAL', BillingType
       'Internal'), provisioned by sp_WorkItems_GetInternalContext.
     - One matching employee assignment per service call / internal task.

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
        EstHours DECIMAL(5,2),
        StartOffset INT,
        Description NVARCHAR(1000)
    );
    INSERT INTO @ServiceCalls (Title, CustomerName, SiteName, Status, Priority, BillingType, RequiredRole, EstHours, StartOffset, Description) VALUES
        (N'תקלה במצלמת כניסה ראשית',          N'קניון רננים - חברת ניהול',        N'קניון רננים - מתחם ראשי',  N'InProgress', N'High',   N'Hourly',   N'מתקין מצלמות',          3.0, -1, N'מצלמת הכיפה בכניסה הראשית אינה משדרת תמונה; נדרש בירור הזנה וחיבור רשת.'),
        (N'דלת כניסה ראשית אינה משחררת',      N'עיריית כפר סבא',                  N'בניין העירייה הראשי',      N'Open',       N'High',   N'Hourly',   N'מתקין בקרת כניסה',      2.5, 0,  N'מנעול מגנטי בדלת הכניסה הראשית נשאר נעול גם לאחר העברת כרטיס מורשה.'),
        (N'גלאי עשן בתקלה במסדרון C',         N'מרכז רפואי מאיר',                 N'אגף אשפוז חדש',            N'Open',       N'Urgent', N'Warranty', N'חשמלאי מוסמך',          4.0, 0,  N'התראת תקלה חוזרת מגלאי עשן במסדרון C; נדרשת בדיקה דחופה ודיווח לכבאות.'),
        (N'מצלמת כספת אינה מקליטה',           N'בנק הפועלים סניף רעננה',          N'סניף רעננה מרכז',          N'Done',       N'Medium', N'Warranty', N'מתקין מצלמות',          2.0, -8, N'מצלמת אזור הכספת לא נשמרה בהקלטה; הוחלף כבל וקונפיגורציית ערוץ ב-NVR.'),
        (N'אינטרקום לובי תקול',               N'מגדלי הים התיכון - ניהול ואחזקה', N'מגדל מגורים A',            N'InProgress', N'Medium', N'Hourly',   N'טכנאי שירות',           3.0, -2, N'לוח האינטרקום בלובי אינו מצלצל בחלק מהדירות; נבדקת יחידת הבקרה.'),
        (N'נקודת רשת מעבדה 3 אינה עובדת',     N'מכללת אפקה להנדסה',               N'קמפוס אפקה - בניין הנדסה', N'Done',       N'Low',    N'Hourly',   N'טכנאי תקשורת',          2.0, -6, N'נקודת רשת במעבדה 3 ללא קישוריות; אותרה תקלה בפאנל ובוצע תיקון וסימון.'),
        (N'רעש במערכת הכריזה באולם 2',        N'רשת מלונות ישרוטל',               N'מלון ישרוטל תל אביב - אגף כנסים', N'Open', N'Medium', N'Hourly',  N'טכנאי שירות',           3.0, 1,  N'רעש רקע במגבר הכריזה באולם 2 בעת הפעלה; נדרשת בדיקת הארקה וכבילה.'),
        (N'תקלה בבקרת תאורה בקומה 2',         N'משפחת לוי - הרצליה פיתוח',        N'וילה פרטית הרצליה פיתוח',  N'Cancelled',  N'Low',    N'Fixed',    N'חשמלאי מוסמך',          2.0, -4, N'הלקוח דיווח על בקרת תאורה לא מגיבה; הקריאה בוטלה לאחר שהתברר כתקלת רשת זמנית.'),
        (N'מחסום כניסה לחניון תקוע',          N'קניון רננים - חברת ניהול',        N'חניון קניון רננים',        N'Done',       N'High',   N'Hourly',   N'מתקין בקרת כניסה',      3.5, -10,N'זרוע המחסום נתקעה במצב פתוח; בוצע כיול מנוע והחלפת חיישן לולאה.'),
        (N'קורא כרטיסים בעמדה 2 אינו מגיב',   N'עיריית כפר סבא',                  N'חניון עירוני מרכזי',       N'InProgress', N'Medium', N'Hourly',   N'מתקין בקרת כניסה',      2.5, -1, N'קורא הכרטיסים בעמדה 2 אינו מגיב; נבדקים הזנה וכבל תקשורת לבקר.');

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

    /* Assign one matching technician per service call (by RequiredRole). */
    INSERT INTO dbo.WorkEmployeeAssignments (WorkItemId, EmployeeId, AssignmentRole, AssignedAt, AssignedHours, IsManualAssignment)
    SELECT sc.WorkItemId, e.EmployeeId, N'טכנאי מטפל', @Now, sc.EstimatedHours, 1
    FROM dbo.WorkItems sc
    CROSS APPLY (
        SELECT TOP (1) e.EmployeeId FROM dbo.Employees e
        WHERE e.IsActive = 1 AND e.IsAssignable = 1 AND e.PrimaryRole = sc.RequiredRole
        ORDER BY e.EmployeeId
    ) e
    WHERE sc.WorkType = N'ServiceCall' AND sc.RequiredRole IS NOT NULL
      AND sc.Status <> N'Cancelled'
      AND NOT EXISTS (SELECT 1 FROM dbo.WorkEmployeeAssignments wa WHERE wa.WorkItemId = sc.WorkItemId AND wa.EmployeeId = e.EmployeeId);
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
        EstHours DECIMAL(5,2),
        StartOffset INT,
        DurDays INT,
        Description NVARCHAR(1000)
    );
    INSERT INTO @InternalTasks (Title, Status, Priority, RequiredRole, EstHours, StartOffset, DurDays, Description) VALUES
        (N'הזמנת ציוד למלאי - מצלמות ו-NVR',  N'Execution', N'Medium', N'מנהל פרויקטים',  4.0, -3, 2, N'ריכוז דרישות והזמנת ציוד מצלמות ו-NVR מהספקים לחידוש המלאי.'),
        (N'ספירת מלאי רבעונית במחסן',          N'Planned',   N'Low',    N'טכנאי שירות',    8.0, 7,  1, N'ספירת מלאי תקופתית במחסן הראשי והשוואה למערכת.'),
        (N'הכנת הצעת מחיר ללקוח חדש',          N'Planned',   N'Medium', N'מנהל פרויקטים',  6.0, 2,  1, N'איסוף דרישות והכנת הצעת מחיר ללקוח פוטנציאלי חדש.'),
        (N'תחזוקת רכב שירות מספר 3',           N'Done',      N'Low',    N'טכנאי שירות',    3.0, -10,1, N'טיפול תקופתי ובדיקת ציוד ברכב השירות מספר 3.'),
        (N'הדרכת בטיחות לצוות התקנה',          N'Planned',   N'Medium', N'מנהל פרויקטים',  4.0, 12, 1, N'רענון נהלי בטיחות ועבודה בגובה לצוות ההתקנה.'),
        (N'עדכון תיק לקוח ומסמכי מסירה',       N'Execution', N'Low',    N'מנהלת פרויקטים', 5.0, -2, 3, N'סריקה וארגון מסמכי מסירה ועדכון תיקי לקוח במערכת.');

    INSERT INTO dbo.WorkItems (Title, WorkType, Status, BillingType, Description, CustomerId, SiteId, CreatedAt, ClosedAt, ParentWorkItemId, EstimatedHours, Priority, PlannedStart, PlannedEnd, RequiredRole, IsLocked, ActualStart, ActualEnd, ActualHours)
    SELECT
        it.Title, N'Task', it.Status, N'Internal', it.Description, @intCustomerId, @intSiteId,
        DATEADD(DAY, it.StartOffset - 2, @Now),
        CASE WHEN it.Status IN (N'Done', N'Closed') THEN DATEADD(DAY, it.StartOffset + it.DurDays, @Now) END,
        @container,
        it.EstHours, it.Priority,
        DATEADD(DAY, it.StartOffset, @Today),
        DATEADD(DAY, it.StartOffset + it.DurDays, @Today),
        it.RequiredRole, 0,
        CASE WHEN it.Status IN (N'Done', N'Closed') THEN CAST(DATEADD(DAY, it.StartOffset, @Today) AS DATETIME) END,
        CASE WHEN it.Status IN (N'Done', N'Closed') THEN CAST(DATEADD(DAY, it.StartOffset + it.DurDays, @Today) AS DATETIME) END,
        CASE WHEN it.Status IN (N'Done', N'Closed') THEN it.EstHours END
    FROM @InternalTasks it
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.WorkItems x WHERE x.WorkType = N'Task' AND x.ParentWorkItemId = @container AND x.Title = it.Title
    );
    RAISERROR(N'Internal/office tasks upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* Assign one matching employee per internal task. */
    INSERT INTO dbo.WorkEmployeeAssignments (WorkItemId, EmployeeId, AssignmentRole, AssignedAt, AssignedHours, IsManualAssignment)
    SELECT t.WorkItemId, e.EmployeeId, N'אחראי משימה', @Now, t.EstimatedHours, 1
    FROM dbo.WorkItems t
    CROSS APPLY (
        SELECT TOP (1) e.EmployeeId FROM dbo.Employees e
        WHERE e.IsActive = 1 AND e.IsAssignable = 1 AND e.PrimaryRole = t.RequiredRole
        ORDER BY e.EmployeeId
    ) e
    WHERE t.WorkType = N'Task' AND t.ParentWorkItemId = @container AND t.RequiredRole IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM dbo.WorkEmployeeAssignments wa WHERE wa.WorkItemId = t.WorkItemId AND wa.EmployeeId = e.EmployeeId);
    RAISERROR(N'Internal-task assignments upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRAN;
    RAISERROR(N'== 07 (internal tasks) FAILED and was rolled back. ==', 16, 1) WITH NOWAIT;
    THROW;
END CATCH;

/* ---- Summary ------------------------------------------------------- */
SELECT
    (SELECT COUNT(*) FROM dbo.WorkItems WHERE WorkType = N'ServiceCall')  AS ServiceCalls_total,
    (SELECT COUNT(*) FROM dbo.WorkItems t
        INNER JOIN dbo.WorkItems p ON p.WorkItemId = t.ParentWorkItemId
        WHERE t.WorkType = N'Task' AND p.FinanceProjectNumber = N'INTERNAL') AS InternalTasks_total;

RAISERROR(N'== 07_seed_service_calls_internal: done. ==', 0, 1) WITH NOWAIT;

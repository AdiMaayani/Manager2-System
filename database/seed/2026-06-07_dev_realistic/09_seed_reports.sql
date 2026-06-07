/* =====================================================================
   ManageR2 - Dev Realistic Seed
   09_seed_reports.sql

   Seeds work reports (WorkReports) describing real field work, attached to
   existing Done/Execution work items from 04 (project tasks) and 07
   (service calls). For each report it also seeds:
     - WorkReportSystems            (the systems touched)
     - WorkReportEmployeeAssignments (the reporting technician)

   Status uses the app's canonical values: 'הוגש' (submitted) / 'טיוטה' (draft).

   Implementation notes:
     - Direct, set-based INSERTs guarded by natural-key NOT EXISTS
       (WorkItemId + Summary). Chosen over sp_CreateWorkReport /
       sp_AddWorkReportSystem / sp_AddWorkReportEmployeeAssignment because
       those are single-row, non-idempotent, and return result sets that are
       awkward to consume in a re-runnable set-based seed. (See 00_README.md.)
     - Each report resolves its WorkItem by natural key, and the reporter,
       customer and site from that work item, so nothing is hard-coded to
       unstable identity values.

   Depends on 04 (project tasks) and 07 (service calls). Idempotent.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ---- Context / sentinel guards ------------------------------------ */
IF DB_NAME() IN (N'master', N'model', N'msdb', N'tempdb')
    THROW 60010, N'Refusing to run against a system database. Select your ManageR2 dev database first.', 1;
IF OBJECT_ID(N'dbo.WorkReports', N'U') IS NULL OR OBJECT_ID(N'dbo.WorkItems', N'U') IS NULL
    THROW 60011, N'WorkReports / WorkItems not found. Aborting.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.WorkItems WHERE FinanceProjectNumber LIKE N'SEED-P%')
    THROW 60012, N'No seeded projects/tasks found. Run 04_seed_projects_tasks.sql before 09.', 1;

RAISERROR(N'== 09_seed_reports: starting ==', 0, 1) WITH NOWAIT;

DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();

/* ---- Curated reports (RefType: Task uses Fin+Title; ServiceCall uses Title). */
DECLARE @Reports TABLE (
    RefType NVARCHAR(20),
    Fin NVARCHAR(20) NULL,
    ItemTitle NVARCHAR(150),
    ReportType NVARCHAR(50),
    Status NVARCHAR(50),
    StartTime NVARCHAR(10),
    EndTime NVARCHAR(10),
    WorkersCount INT,
    FollowUpRequired BIT,
    FollowUpReason NVARCHAR(1000) NULL,
    Summary NVARCHAR(1000),
    Notes NVARCHAR(2000) NULL
);
INSERT INTO @Reports (RefType, Fin, ItemTitle, ReportType, Status, StartTime, EndTime, WorkersCount, FollowUpRequired, FollowUpReason, Summary, Notes) VALUES
    (N'Task', N'SEED-P01', N'סקר אתר ותכנון מערכת', N'דוח ביקור', N'הוגש', N'08:30', N'12:00', 2, 0, NULL,
        N'בוצע סקר אתר במתחם הקניון, מיפוי נקודות מצלמה וקביעת מיקום ארון תקשורת ומוקד הקלטה.',
        N'סוכמו 24 נקודות מצלמה, נדרשת השלמת תשתית חשמל בשתי נקודות בכניסה הצפונית.'),
    (N'Task', N'SEED-P01', N'השחלת תשתית תקשורת', N'דוח התקדמות', N'טיוטה', N'07:30', N'16:30', 2, 1,
        N'ממתינים לאספקת תוספת כבל CAT6 וסולמות כבלים להמשך ההשחלה באגף המערבי.',
        N'הושחלו כ-70% מקווי התקשורת, בוצעה כבילה לארון הראשי וסומנו הנקודות.',
        N'נותרה השחלה באגף המערבי, צפי השלמה בשבוע הקרוב בכפוף לאספקת חומרים.'),
    (N'Task', N'SEED-P06', N'החלפת מצלמות וכבילה', N'דוח עבודה', N'הוגש', N'08:00', N'17:00', 3, 0, NULL,
        N'הוחלפו 18 מצלמות ישנות במצלמות IP חדשות, חודשה כבילה ובוצעה הגדרה ב-NVR.',
        N'נבדקו זוויות צילום וכיסוי אזור הקופות, הוגדרה הקלטה רציפה לכל הערוצים.'),
    (N'Task', N'SEED-P06', N'התקנת מערכת אזעקה ולחצני מצוקה', N'דוח עבודה', N'הוגש', N'08:00', N'15:30', 2, 0, NULL,
        N'הותקנה רכזת אזעקה, גלאי נפח ולחצני מצוקה בעמדות הקופאים ובחדר המנהל.',
        N'בוצעה בדיקת תקשורת למוקד וסימולציית אירוע, כל הלחצנים תקינים.'),
    (N'Task', N'SEED-P06', N'בדיקות מסירה ואחריות', N'דוח מסירה', N'הוגש', N'09:00', N'12:30', 2, 0, NULL,
        N'בוצעו בדיקות מסירה למערכת המצלמות והאזעקה, נמסרה הדרכה והוחתם פרוטוקול מסירה.',
        N'נמסר תיק מתקן ותעודות אחריות, נקבע מועד ביקורת תקופתית בעוד שלושה חודשים.'),
    (N'Task', N'SEED-P08', N'השחלה וחיווט', N'דוח עבודה', N'הוגש', N'08:00', N'16:00', 2, 0, NULL,
        N'הושלמה השחלת תשתיות חשמל ותקשורת בשלושת המפלסים בווילה, כולל נקודות מולטירום.',
        N'בוצעה הפרדת מתחים, סומנו כל הקווים והוכן לוח תקשורת ביעודי בחדר השירות.'),
    (N'Task', N'SEED-P07', N'חיווט והתקנת גלאים', N'דוח התקדמות', N'טיוטה', N'07:00', N'15:00', 3, 1,
        N'נדרש תיאום מול נציג כבאות לאישור מיקום שני גלאים נוספים במסדרון C.',
        N'הותקנו גלאי עשן כתובתיים וחווטה רכזת גילוי האש באגף האשפוז, נותרו בדיקות תקן.',
        N'בדיקת תקן ואישור כבאות תבוצע לאחר השלמת ההתקנה והסדרת המיקומים החריגים.'),
    (N'ServiceCall', NULL, N'מצלמת כספת אינה מקליטה', N'דוח שירות', N'הוגש', N'09:30', N'11:30', 1, 0, NULL,
        N'אותרה תקלת כבילה במצלמת אזור הכספת, הוחלף כבל רשת והוגדר מחדש ערוץ ההקלטה ב-NVR.',
        N'בוצעה בדיקת הקלטה רציפה למשך שעה, התקלה נפתרה והמערכת תקינה.'),
    (N'ServiceCall', NULL, N'נקודת רשת מעבדה 3 אינה עובדת', N'דוח שירות', N'הוגש', N'13:00', N'15:00', 1, 0, NULL,
        N'אותרה נקודת רשת פגומה בפאנל, בוצע תיקון סימון וחיבור מחדש בפאנל הניתוק.',
        N'נבדקה קישוריות במהירות מלאה, סומנה הנקודה בהתאם לתקן הסימון של המכללה.'),
    (N'ServiceCall', NULL, N'מחסום כניסה לחניון תקוע', N'דוח שירות', N'הוגש', N'08:30', N'12:00', 2, 0, NULL,
        N'זרוע המחסום נתקעה במצב פתוח, בוצע כיול מנוע והוחלף חיישן לולאה מגנטי.',
        N'נבדקו מחזורי פתיחה וסגירה חוזרים, המחסום פועל תקין ומסונכרן עם בקרת הכניסה.');

/* ---- Resolve each report to its WorkItem + context (natural keys). ---- */
IF OBJECT_ID(N'tempdb..#ResolvedReports') IS NOT NULL DROP TABLE #ResolvedReports;

SELECT
    r.RefType, r.ItemTitle, r.ReportType, r.Status, r.StartTime, r.EndTime,
    r.WorkersCount, r.FollowUpRequired, r.FollowUpReason, r.Summary, r.Notes,
    wi.WorkItemId,
    CAST(COALESCE(wi.ActualEnd, wi.PlannedEnd, wi.PlannedStart, @Now) AS DATETIME) AS ReportDate,
    CASE WHEN r.RefType = N'ServiceCall' THEN N'קריאת שירות' ELSE p.Title END AS ProjectName,
    c.CustomerName,
    s.SiteName,
    rep.EmployeeId AS ReporterEmployeeId,
    rep.FullName   AS ReporterName,
    rep.PrimaryRole AS ReporterRole
INTO #ResolvedReports
FROM @Reports r
INNER JOIN dbo.WorkItems wi
    ON wi.Title = r.ItemTitle
   AND ((r.RefType = N'ServiceCall' AND wi.WorkType = N'ServiceCall')
        OR (r.RefType = N'Task' AND wi.WorkType = N'Task'))
LEFT JOIN dbo.WorkItems p
    ON p.WorkItemId = wi.ParentWorkItemId AND p.WorkType = N'Project'
INNER JOIN dbo.Customers c ON c.CustomerId = wi.CustomerId
LEFT JOIN dbo.Sites s ON s.SiteId = wi.SiteId
OUTER APPLY (
    SELECT TOP (1) e.EmployeeId, e.FullName, e.PrimaryRole
    FROM dbo.WorkEmployeeAssignments wa
    INNER JOIN dbo.Employees e ON e.EmployeeId = wa.EmployeeId
    WHERE wa.WorkItemId = wi.WorkItemId
    ORDER BY CASE WHEN wa.AssignmentRole IN (N'מבצע ראשי', N'טכנאי מטפל') THEN 0 ELSE 1 END, wa.WorkEmployeeAssignmentId
) rep
WHERE (r.RefType = N'ServiceCall')
   OR EXISTS (SELECT 1 FROM dbo.WorkItems p2 WHERE p2.WorkItemId = wi.ParentWorkItemId AND p2.FinanceProjectNumber = r.Fin);

BEGIN TRY
    BEGIN TRAN;

    /* ---- Reports ---- */
    INSERT INTO dbo.WorkReports
        (WorkItemId, ReportType, ReportDate, ProjectName, CustomerName, Site, StartTime, EndTime,
         Summary, Notes, ReporterEmployeeId, ReporterName, ReporterRole, WorkersCount,
         Status, FollowUpRequired, FollowUpReason, CreatedAt)
    SELECT
        rr.WorkItemId, rr.ReportType, rr.ReportDate, rr.ProjectName, rr.CustomerName, rr.SiteName,
        rr.StartTime, rr.EndTime, rr.Summary, rr.Notes, rr.ReporterEmployeeId, rr.ReporterName,
        rr.ReporterRole, rr.WorkersCount, rr.Status, rr.FollowUpRequired, rr.FollowUpReason, @Now
    FROM #ResolvedReports rr
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.WorkReports x WHERE x.WorkItemId = rr.WorkItemId AND x.Summary = rr.Summary
    );
    RAISERROR(N'WorkReports upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* ---- Reporter as a report employee assignment ---- */
    INSERT INTO dbo.WorkReportEmployeeAssignments (WorkReportId, EmployeeId, EmployeeName, AssignmentRole, AssignedAt)
    SELECT wr.WorkReportId, rr.ReporterEmployeeId, rr.ReporterName, N'מבצע מדווח', @Now
    FROM #ResolvedReports rr
    INNER JOIN dbo.WorkReports wr ON wr.WorkItemId = rr.WorkItemId AND wr.Summary = rr.Summary
    WHERE rr.ReporterEmployeeId IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM dbo.WorkReportEmployeeAssignments x
          WHERE x.WorkReportId = wr.WorkReportId AND x.EmployeeId = rr.ReporterEmployeeId
      );
    RAISERROR(N'WorkReport employee assignments upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* ---- Systems touched per report ---- */
    DECLARE @ReportSystems TABLE (ItemTitle NVARCHAR(150), SystemName NVARCHAR(100));
    INSERT INTO @ReportSystems (ItemTitle, SystemName) VALUES
        (N'סקר אתר ותכנון מערכת', N'מצלמות אבטחה'),
        (N'השחלת תשתית תקשורת', N'תשתית תקשורת'),
        (N'החלפת מצלמות וכבילה', N'מצלמות אבטחה'),
        (N'החלפת מצלמות וכבילה', N'מערכת הקלטה NVR'),
        (N'התקנת מערכת אזעקה ולחצני מצוקה', N'מערכת אזעקה'),
        (N'בדיקות מסירה ואחריות', N'מצלמות אבטחה'),
        (N'בדיקות מסירה ואחריות', N'מערכת אזעקה'),
        (N'השחלה וחיווט', N'תשתית חשמל ותקשורת'),
        (N'חיווט והתקנת גלאים', N'גילוי וכיבוי אש'),
        (N'מצלמת כספת אינה מקליטה', N'מצלמות אבטחה'),
        (N'נקודת רשת מעבדה 3 אינה עובדת', N'תשתית תקשורת'),
        (N'מחסום כניסה לחניון תקוע', N'בקרת כניסה');

    INSERT INTO dbo.WorkReportSystems (WorkReportId, SystemName, CreatedAt)
    SELECT wr.WorkReportId, rs.SystemName, @Now
    FROM @ReportSystems rs
    INNER JOIN #ResolvedReports rr ON rr.ItemTitle = rs.ItemTitle
    INNER JOIN dbo.WorkReports wr ON wr.WorkItemId = rr.WorkItemId AND wr.Summary = rr.Summary
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.WorkReportSystems x WHERE x.WorkReportId = wr.WorkReportId AND x.SystemName = rs.SystemName
    );
    RAISERROR(N'WorkReport systems upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRAN;
    RAISERROR(N'== 09_seed_reports FAILED and was rolled back. ==', 16, 1) WITH NOWAIT;
    THROW;
END CATCH;

IF OBJECT_ID(N'tempdb..#ResolvedReports') IS NOT NULL DROP TABLE #ResolvedReports;

/* ---- Summary ------------------------------------------------------- */
SELECT
    (SELECT COUNT(*) FROM dbo.WorkReports)                  AS WorkReports_total,
    (SELECT COUNT(*) FROM dbo.WorkReports WHERE Status = N'הוגש')   AS WorkReports_submitted,
    (SELECT COUNT(*) FROM dbo.WorkReports WHERE Status = N'טיוטה')  AS WorkReports_draft,
    (SELECT COUNT(*) FROM dbo.WorkReportSystems)            AS WorkReportSystems_total,
    (SELECT COUNT(*) FROM dbo.WorkReportEmployeeAssignments) AS WorkReportAssignments_total;

RAISERROR(N'== 09_seed_reports: done. ==', 0, 1) WITH NOWAIT;

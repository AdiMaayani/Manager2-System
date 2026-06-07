/* =====================================================================
   ManageR2 - Dev Realistic Seed
   05_seed_project_details.sql

   Seeds, for a subset of seeded projects (P01-P04, P07):
     - ProjectBoqItems  (bill of quantities)
     - ProjectDrawings  (Type in {PDF, DWG})
     - ProjectEquipmentItems (Status in {installed, installing, ordered, waiting})

   Implementation note:
     Uses guarded, set-based direct INSERTs (natural-key NOT EXISTS)
     rather than sp_ProjectBoq_Create / sp_ProjectDrawings_Create /
     sp_ProjectEquipment_Create. Those SPs only wrap a single-row insert
     + the same CHECK validation the DB already enforces; set-based
     inserts keep this script idempotent and avoid the per-row result
     sets the SPs emit. (Documented in 00_README.md.)

   Depends on 04_seed_projects_tasks.sql. Idempotent.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() IN (N'master', N'model', N'msdb', N'tempdb')
    THROW 60010, N'Refusing to run against a system database. Select your ManageR2 dev database first.', 1;
IF OBJECT_ID(N'dbo.ProjectBoqItems', N'U') IS NULL OR OBJECT_ID(N'dbo.ProjectDrawings', N'U') IS NULL
    THROW 60011, N'Project detail tables not found. Aborting.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.WorkItems WHERE WorkType = N'Project' AND FinanceProjectNumber LIKE N'SEED-P%')
    THROW 60012, N'No seeded projects found. Run 04_seed_projects_tasks.sql before 05.', 1;

RAISERROR(N'== 05_seed_project_details: starting ==', 0, 1) WITH NOWAIT;

DECLARE @Today DATE = CAST(SYSUTCDATETIME() AS DATE);
DECLARE @Now DATETIME2(7) = SYSUTCDATETIME();

BEGIN TRY
    BEGIN TRAN;

    /* ---- Bill of quantities --------------------------------------- */
    DECLARE @Boq TABLE (
        Fin NVARCHAR(20), SystemName NVARCHAR(200), ItemDescription NVARCHAR(500),
        Quantity DECIMAL(18,2), Unit NVARCHAR(50), SortOrder INT
    );
    INSERT INTO @Boq (Fin, SystemName, ItemDescription, Quantity, Unit, SortOrder) VALUES
        (N'SEED-P01', N'מצלמות',     N'מצלמת כיפה IP 4MP',              24,  N'יח׳', 1),
        (N'SEED-P01', N'מצלמות',     N'מצלמת צינור IP 8MP',            12,  N'יח׳', 2),
        (N'SEED-P01', N'הקלטה',      N'מקליט רשת NVR 32 ערוצים',        2,   N'יח׳', 3),
        (N'SEED-P01', N'תקשורת',     N'כבל רשת CAT6',                  600, N'מ׳',  4),
        (N'SEED-P01', N'תקשורת',     N'ארון תקשורת 19 אינץ׳ 42U',       1,   N'יח׳', 5),
        (N'SEED-P02', N'בקרת כניסה', N'בקר כניסה 4 דלתות',             3,   N'יח׳', 1),
        (N'SEED-P02', N'בקרת כניסה', N'קורא כרטיסים RFID',             8,   N'יח׳', 2),
        (N'SEED-P02', N'בקרת כניסה', N'מחסום חניון אוטומטי',           2,   N'יח׳', 3),
        (N'SEED-P02', N'תקשורת',     N'כבל רשת CAT6',                  300, N'מ׳',  4),
        (N'SEED-P03', N'תקשורת',     N'כבל סיב אופטי חד-מודי',         800, N'מ׳',  1),
        (N'SEED-P03', N'תקשורת',     N'כבל רשת CAT6',                  1200,N'מ׳',  2),
        (N'SEED-P03', N'תקשורת',     N'מתג PoE מנוהל 24 פורט',          6,   N'יח׳', 3),
        (N'SEED-P03', N'תקשורת',     N'ארון תקשורת 19 אינץ׳ 42U',       2,   N'יח׳', 4),
        (N'SEED-P04', N'מולטימדיה',  N'רמקול תקרה 6W',                 40,  N'יח׳', 1),
        (N'SEED-P04', N'מולטימדיה',  N'מגבר כריזה 240W',               2,   N'יח׳', 2),
        (N'SEED-P04', N'מולטימדיה',  N'מסך מקצועי 75 אינץ׳',           3,   N'יח׳', 3),
        (N'SEED-P04', N'מולטימדיה',  N'מקרן לייזר 5000 לומן',          2,   N'יח׳', 4),
        (N'SEED-P07', N'גילוי אש',   N'גלאי עשן אופטי כתובתי',         60,  N'יח׳', 1),
        (N'SEED-P07', N'גילוי אש',   N'רכזת גילוי אש 8 אזורים',         2,   N'יח׳', 2),
        (N'SEED-P07', N'גילוי אש',   N'צופר ונצנץ חירום',              12,  N'יח׳', 3),
        (N'SEED-P07', N'חשמל',       N'צינור שרשורי 25 מ״מ',           400, N'מ׳',  4);

    INSERT INTO dbo.ProjectBoqItems (ProjectId, SystemName, ItemDescription, Quantity, Unit, SortOrder, IsActive, CreatedAt)
    SELECT p.WorkItemId, b.SystemName, b.ItemDescription, b.Quantity, b.Unit, b.SortOrder, 1, @Now
    FROM @Boq b
    INNER JOIN dbo.WorkItems p ON p.WorkType = N'Project' AND p.FinanceProjectNumber = b.Fin
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.ProjectBoqItems x
        WHERE x.ProjectId = p.WorkItemId AND x.ItemDescription = b.ItemDescription AND x.IsActive = 1
    );
    RAISERROR(N'BOQ items upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* ---- Drawings (Type in {PDF, DWG}) ---------------------------- */
    DECLARE @Drawings TABLE (
        Fin NVARCHAR(20), Name NVARCHAR(200), Type NVARCHAR(20), DateOffset INT, Note NVARCHAR(500), SortOrder INT
    );
    INSERT INTO @Drawings (Fin, Name, Type, DateOffset, Note, SortOrder) VALUES
        (N'SEED-P01', N'תוכנית פריסת מצלמות - קומת קרקע', N'PDF', -36, N'פריסה מאושרת ללקוח',        1),
        (N'SEED-P01', N'תרשים חיווט NVR וארון תקשורת',   N'DWG', -34, N'כולל סכמת חיבורים',          2),
        (N'SEED-P02', N'תוכנית בקרת כניסה',              N'PDF', -24, N'דלתות, קוראים ומחסומים',     1),
        (N'SEED-P02', N'פריסת מחסומים בחניון',           N'DWG', -22, NULL,                          2),
        (N'SEED-P03', N'תוכנית תשתית תקשורת',            N'PDF', -18, N'CAT6 וסיב אופטי',            1),
        (N'SEED-P03', N'תרשים ארון תקשורת',              N'DWG', -16, N'מדף תקשורת ומיתוג',          2),
        (N'SEED-P03', N'מפת נקודות רשת',                 N'PDF', -14, NULL,                          3),
        (N'SEED-P04', N'תוכנית אקוסטיקה ופריסת רמקולים', N'PDF', 3,   N'חלוקה לאזורי כריזה',         1),
        (N'SEED-P04', N'תרשים חיבורי AV',                N'DWG', 4,   NULL,                          2),
        (N'SEED-P07', N'תוכנית גילוי אש',                N'PDF', -16, N'בהתאם לתקן 1220',            1),
        (N'SEED-P07', N'תרשים אזורי גילוי וכריזה',       N'DWG', -14, N'מאושר יועץ בטיחות',          2);

    INSERT INTO dbo.ProjectDrawings (ProjectId, Name, Type, DrawingDate, Note, SortOrder, IsActive, CreatedAt)
    SELECT p.WorkItemId, d.Name, d.Type, DATEADD(DAY, d.DateOffset, @Today), d.Note, d.SortOrder, 1, @Now
    FROM @Drawings d
    INNER JOIN dbo.WorkItems p ON p.WorkType = N'Project' AND p.FinanceProjectNumber = d.Fin
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.ProjectDrawings x
        WHERE x.ProjectId = p.WorkItemId AND x.Name = d.Name AND x.IsActive = 1
    );
    RAISERROR(N'Drawings upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* ---- Equipment (Status in {installed, installing, ordered, waiting}) */
    DECLARE @Equipment TABLE (
        Fin NVARCHAR(20), EquipmentName NVARCHAR(200), Status NVARCHAR(50), Location NVARCHAR(200), SortOrder INT
    );
    INSERT INTO @Equipment (Fin, EquipmentName, Status, Location, SortOrder) VALUES
        (N'SEED-P01', N'מקליט NVR מרכזי',        N'installed',  N'חדר תקשורת',  1),
        (N'SEED-P01', N'ארון תקשורת ראשי',       N'installing', N'חדר תקשורת',  2),
        (N'SEED-P01', N'ספק כוח מצלמות',         N'ordered',    N'חדר תקשורת',  3),
        (N'SEED-P02', N'בקר כניסה ראשי',         N'installing', N'חדר בקרה',    1),
        (N'SEED-P02', N'מחסום כניסה אוטומטי',    N'ordered',    N'שער כניסה',   2),
        (N'SEED-P02', N'קורא כרטיסים',           N'waiting',    N'עמדת שומר',   3),
        (N'SEED-P03', N'ארון תקשורת ראשי',       N'installing', N'חדר שרתים',   1),
        (N'SEED-P03', N'מתג ליבה',               N'ordered',    N'חדר שרתים',   2),
        (N'SEED-P03', N'פאנל סיב אופטי',         N'waiting',    N'חדר שרתים',   3),
        (N'SEED-P04', N'מגבר כריזה מרכזי',       N'ordered',    N'חדר בקרה',    1),
        (N'SEED-P04', N'מסך מקצועי 75 אינץ׳',    N'ordered',    N'אולם ראשי',   2),
        (N'SEED-P04', N'מקרן לייזר',             N'waiting',    N'אולם ראשי',   3),
        (N'SEED-P07', N'רכזת גילוי אש',          N'installing', N'חדר חשמל',    1),
        (N'SEED-P07', N'גלאי עשן כתובתיים',      N'installing', N'מסדרונות',    2),
        (N'SEED-P07', N'צופר ונצנץ חירום',       N'ordered',    N'לובי',        3);

    INSERT INTO dbo.ProjectEquipmentItems (ProjectId, EquipmentName, Status, Location, SortOrder, CreatedAt)
    SELECT p.WorkItemId, e.EquipmentName, e.Status, e.Location, e.SortOrder, @Now
    FROM @Equipment e
    INNER JOIN dbo.WorkItems p ON p.WorkType = N'Project' AND p.FinanceProjectNumber = e.Fin
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.ProjectEquipmentItems x
        WHERE x.ProjectId = p.WorkItemId AND x.EquipmentName = e.EquipmentName
    );
    RAISERROR(N'Equipment items upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRAN;
    RAISERROR(N'== 05_seed_project_details FAILED and was rolled back. ==', 16, 1) WITH NOWAIT;
    THROW;
END CATCH;

/* ---- Summary ------------------------------------------------------- */
SELECT
    (SELECT COUNT(*) FROM dbo.ProjectBoqItems WHERE IsActive = 1)       AS Boq_items,
    (SELECT COUNT(*) FROM dbo.ProjectDrawings WHERE IsActive = 1)       AS Drawings,
    (SELECT COUNT(*) FROM dbo.ProjectEquipmentItems)                    AS Equipment_items;

RAISERROR(N'== 05_seed_project_details: done. ==', 0, 1) WITH NOWAIT;

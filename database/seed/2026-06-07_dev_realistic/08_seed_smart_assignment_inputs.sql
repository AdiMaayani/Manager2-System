/* =====================================================================
   ManageR2 - Dev Realistic Seed
   08_seed_smart_assignment_inputs.sql

   Seeds INPUT data for the existing Smart Assignment algorithm so it has
   meaningful candidates. The algorithm itself is NOT changed.

   Sections (all idempotent, natural-key guarded):
     A. Rec_Skills          - skill catalog (reuse by name, create if missing)
        Rec_WorkZones       - geographic zones (reuse by name, create if missing)
     B. Rec_EmployeeSkills  - per-role skill profile for the roster
     C. Rec_EmployeeWorkZones - primary zone (home) + secondary coverage
     D. Rec_EmployeeCapacity  - weekly capacity (drives workload score)
     E. Rec_EmployeeBaseAddress - home base + zone (geographic origin)
     F. Rec_SiteAddressProfile  - per seeded customer site + zone
     G. Rec_WorkItemRequiredSkills - required skills per task / service call
                                     (aligned to WorkItems.RequiredRole)
     H. Rec_WorkItemAlgorithmProfile - required workers / planning notes

   Enum values are matched to the algorithm code:
     - AvailabilityType 'Available' (a covering window => fully available);
       'Leave'/'Training'/'Busy' overlapping a task => unavailable for it.
     - ImportanceLevel in {Critical, Important, Preferred}.
     - SkillLevel / RequiredLevel on a 1..5 scale (ratio-based scoring).

   Runtime / computed result tables are intentionally LEFT EMPTY:
     Rec_RecommendationRuns, Rec_TaskAssignmentRecommendations,
     Rec_EmployeePlannedStops, Rec_EmployeeLocationEvents, Rec_RouteEstimates.

   Depends on 03 (employees/sites) and 04 + 07 (tasks/service calls).
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ---- Context / sentinel guards ------------------------------------ */
IF DB_NAME() IN (N'master', N'model', N'msdb', N'tempdb')
    THROW 60010, N'Refusing to run against a system database. Select your ManageR2 dev database first.', 1;
IF OBJECT_ID(N'dbo.Rec_Skills', N'U') IS NULL
   OR OBJECT_ID(N'dbo.Rec_WorkZones', N'U') IS NULL
   OR OBJECT_ID(N'dbo.Rec_EmployeeSkills', N'U') IS NULL
    THROW 60011, N'Smart Assignment (Rec_*) tables not found. Aborting.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.Employees WHERE IsActive = 1 AND IsAssignable = 1)
    THROW 60012, N'No assignable employees found. Run 03_seed_core.sql before 08.', 1;

RAISERROR(N'== 08_seed_smart_assignment_inputs: starting ==', 0, 1) WITH NOWAIT;

DECLARE @Today DATE = CAST(SYSUTCDATETIME() AS DATE);
DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();

/* ================================================================
   A. SKILL CATALOG + WORK ZONES  (reuse if present, create if missing)
   ================================================================ */
BEGIN TRY
    BEGIN TRAN;

    DECLARE @SkillCat TABLE (SkillName NVARCHAR(100), SkillCategory NVARCHAR(100), Descr NVARCHAR(255));
    INSERT INTO @SkillCat (SkillName, SkillCategory, Descr) VALUES
        (N'התקנת מצלמות ו-NVR', N'מצלמות ואבטחה',  N'התקנה, כבילה והגדרת מצלמות IP ומקליטי NVR'),
        (N'בקרת כניסה ומחסומים', N'בקרת כניסה',     N'בקרים, קוראים, מנעולים ומחסומי חניון'),
        (N'תשתיות תקשורת מבנים', N'תקשורת ותשתית', N'השחלת CAT6, פאנלים, מיתוג ותשתית פסיבית'),
        (N'סיב אופטי',           N'תקשורת ותשתית', N'ריתוך, חיבור ובדיקת סיב אופטי'),
        (N'חשמל ומתח נמוך',      N'חשמל ובקרה',    N'עבודות חשמל, מתח נמוך וספקי כוח'),
        (N'גילוי וכיבוי אש',     N'בטיחות אש',     N'גלאים כתובתיים, רכזות וכריזת חירום'),
        (N'כריזה ומולטימדיה',    N'כריזה ומולטימדיה', N'רמקולים, מגברים, מקרנים ומסכים'),
        (N'בקרת מבנה BMS',       N'חשמל ובקרה',    N'בקרי DDC, חיישנים ובקרת מבנה'),
        (N'ניהול פרויקטים',      N'ניהול',         N'ניהול לוחות זמנים, צוותים ומסירות'),
        (N'אבחון ותיקון תקלות',  N'שירות',         N'אבחון תקלות שטח ותיקון מערכות מותקנות');

    INSERT INTO dbo.Rec_Skills (SkillName, SkillCategory, Description, IsActive, CreatedAt)
    SELECT sc.SkillName, sc.SkillCategory, sc.Descr, 1, @Now
    FROM @SkillCat sc
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Rec_Skills x WHERE x.SkillName = sc.SkillName);
    RAISERROR(N'Rec_Skills reused/created (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    DECLARE @ZoneCat TABLE (ZoneName NVARCHAR(100), Descr NVARCHAR(255));
    INSERT INTO @ZoneCat (ZoneName, Descr) VALUES
        (N'אזור השרון',  N'כפר סבא, רעננה, הרצליה, נתניה והסביבה'),
        (N'אזור גוש דן', N'תל אביב, בת ים, חולון, רמת גן והסביבה'),
        (N'אזור ירושלים',N'ירושלים והסביבה');

    INSERT INTO dbo.Rec_WorkZones (ZoneName, Description, IsActive, CreatedAt)
    SELECT zc.ZoneName, zc.Descr, 1, @Now
    FROM @ZoneCat zc
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Rec_WorkZones x WHERE x.ZoneName = zc.ZoneName);
    RAISERROR(N'Rec_WorkZones reused/created (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRAN;
    RAISERROR(N'== 08 (catalog) FAILED and was rolled back. ==', 16, 1) WITH NOWAIT;
    THROW;
END CATCH;

RAISERROR(N'-- 08: catalog section done. --', 0, 1) WITH NOWAIT;

/* ================================================================
   B-E. EMPLOYEE PROFILE INPUTS (skills, zones, capacity, base address)
   Joined to the roster by Employees.PrimaryRole, so they stay aligned
   with WorkItems.RequiredRole used in 04 / 07.
   ================================================================ */
BEGIN TRY
    BEGIN TRAN;

    /* ---- B. Employee skills (per role) ---- */
    DECLARE @EmpSkill TABLE (Role NVARCHAR(100), SkillName NVARCHAR(100), SkillLevel INT, Years DECIMAL(5,2), IsCertified BIT);
    INSERT INTO @EmpSkill (Role, SkillName, SkillLevel, Years, IsCertified) VALUES
        (N'מנהל פרויקטים',          N'ניהול פרויקטים',     5, 8.0, 1),
        (N'מנהל פרויקטים',          N'אבחון ותיקון תקלות', 3, 5.0, 0),
        (N'מנהלת פרויקטים',         N'ניהול פרויקטים',     5, 7.0, 1),
        (N'מנהלת פרויקטים',         N'כריזה ומולטימדיה',   3, 4.0, 0),
        (N'טכנאי בכיר',             N'אבחון ותיקון תקלות', 5, 10.0,1),
        (N'טכנאי בכיר',             N'התקנת מצלמות ו-NVR', 4, 8.0, 0),
        (N'טכנאי בכיר',             N'תשתיות תקשורת מבנים',4, 8.0, 0),
        (N'טכנאי בכיר',             N'בקרת כניסה ומחסומים',3, 6.0, 0),
        (N'טכנאי מערכות מתח נמוך',  N'חשמל ומתח נמוך',     4, 6.0, 0),
        (N'טכנאי מערכות מתח נמוך',  N'תשתיות תקשורת מבנים',3, 5.0, 0),
        (N'טכנאי מערכות מתח נמוך',  N'בקרת כניסה ומחסומים',3, 5.0, 0),
        (N'חשמלאי מוסמך',           N'חשמל ומתח נמוך',     5, 9.0, 1),
        (N'חשמלאי מוסמך',           N'גילוי וכיבוי אש',    4, 6.0, 1),
        (N'חשמלאי מוסמך',           N'בקרת מבנה BMS',      3, 4.0, 0),
        (N'מתקין מצלמות',           N'התקנת מצלמות ו-NVR', 5, 6.0, 0),
        (N'מתקין מצלמות',           N'תשתיות תקשורת מבנים',3, 5.0, 0),
        (N'טכנאי תקשורת',           N'תשתיות תקשורת מבנים',5, 7.0, 0),
        (N'טכנאי תקשורת',           N'סיב אופטי',          4, 5.0, 1),
        (N'טכנאי תקשורת',           N'התקנת מצלמות ו-NVR', 2, 3.0, 0),
        (N'מתקין בקרת כניסה',       N'בקרת כניסה ומחסומים',5, 6.0, 0),
        (N'מתקין בקרת כניסה',       N'חשמל ומתח נמוך',     3, 4.0, 0),
        (N'טכנאי שירות',            N'אבחון ותיקון תקלות', 4, 5.0, 0),
        (N'טכנאי שירות',            N'כריזה ומולטימדיה',   3, 4.0, 0),
        (N'טכנאי שירות',            N'התקנת מצלמות ו-NVR', 2, 3.0, 0);

    INSERT INTO dbo.Rec_EmployeeSkills (EmployeeId, SkillId, SkillLevel, YearsExperience, IsCertified, CreatedAt)
    SELECT e.EmployeeId, s.SkillId, es.SkillLevel, es.Years, es.IsCertified, @Now
    FROM @EmpSkill es
    INNER JOIN dbo.Employees e ON e.PrimaryRole = es.Role AND e.IsActive = 1 AND e.IsAssignable = 1
    INNER JOIN dbo.Rec_Skills s ON s.SkillName = es.SkillName
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Rec_EmployeeSkills x WHERE x.EmployeeId = e.EmployeeId AND x.SkillId = s.SkillId);
    RAISERROR(N'Rec_EmployeeSkills upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* ---- C. Employee work zones: home (primary) + secondary coverage ---- */
    DECLARE @EmpBase TABLE (FullName NVARCHAR(100), City NVARCHAR(100), ZoneName NVARCHAR(100));
    INSERT INTO @EmpBase (FullName, City, ZoneName) VALUES
        (N'יוסי אברהמי', N'רעננה',   N'אזור השרון'),
        (N'דנה כהן',      N'תל אביב', N'אזור גוש דן'),
        (N'איציק לוי',    N'כפר סבא', N'אזור השרון'),
        (N'מוחמד עוואד',  N'טירה',    N'אזור השרון'),
        (N'סרגיי פלדמן',  N'נתניה',   N'אזור השרון'),
        (N'אבי מזרחי',    N'הרצליה',  N'אזור השרון'),
        (N'נועם שלו',     N'תל אביב', N'אזור גוש דן'),
        (N'ראמי חורי',    N'חולון',   N'אזור גוש דן'),
        (N'טל גולן',      N'רעננה',   N'אזור השרון'),
        (N'עומר בן דוד',  N'בת ים',   N'אזור גוש דן');

    /* Primary zone = home zone. */
    INSERT INTO dbo.Rec_EmployeeWorkZones (EmployeeId, ZoneId, IsPrimary, Notes, CreatedAt)
    SELECT e.EmployeeId, z.ZoneId, 1, N'אזור בית', @Now
    FROM @EmpBase b
    INNER JOIN dbo.Employees e ON e.FullName = b.FullName AND e.IsActive = 1
    INNER JOIN dbo.Rec_WorkZones z ON z.ZoneName = b.ZoneName
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Rec_EmployeeWorkZones x WHERE x.EmployeeId = e.EmployeeId AND x.ZoneId = z.ZoneId);
    RAISERROR(N'Rec_EmployeeWorkZones (primary) upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* Secondary coverage so both metro zones have candidates per role. */
    DECLARE @EmpZoneExtra TABLE (FullName NVARCHAR(100), ZoneName NVARCHAR(100));
    INSERT INTO @EmpZoneExtra (FullName, ZoneName) VALUES
        (N'איציק לוי',   N'אזור גוש דן'),
        (N'טל גולן',     N'אזור גוש דן'),
        (N'מוחמד עוואד', N'אזור גוש דן'),
        (N'סרגיי פלדמן', N'אזור גוש דן'),
        (N'נועם שלו',    N'אזור השרון'),
        (N'ראמי חורי',   N'אזור השרון');

    INSERT INTO dbo.Rec_EmployeeWorkZones (EmployeeId, ZoneId, IsPrimary, Notes, CreatedAt)
    SELECT e.EmployeeId, z.ZoneId, 0, N'אזור משני', @Now
    FROM @EmpZoneExtra x
    INNER JOIN dbo.Employees e ON e.FullName = x.FullName AND e.IsActive = 1
    INNER JOIN dbo.Rec_WorkZones z ON z.ZoneName = x.ZoneName
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Rec_EmployeeWorkZones w WHERE w.EmployeeId = e.EmployeeId AND w.ZoneId = z.ZoneId);
    RAISERROR(N'Rec_EmployeeWorkZones (secondary) upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* ---- D. Weekly capacity (presence => workload score) ---- */
    INSERT INTO dbo.Rec_EmployeeCapacity (EmployeeId, WeeklyCapacityHours, EffectiveFrom, EffectiveTo, Notes, CreatedAt)
    SELECT e.EmployeeId, CAST(e.DailyCapacityHours * 5 AS DECIMAL(10,2)), DATEADD(DAY, -60, @Today), NULL, N'קיבולת שבועית סטנדרטית', @Now
    FROM dbo.Employees e
    WHERE e.IsActive = 1 AND e.IsAssignable = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.Rec_EmployeeCapacity c WHERE c.EmployeeId = e.EmployeeId AND c.EffectiveFrom = DATEADD(DAY, -60, @Today));
    RAISERROR(N'Rec_EmployeeCapacity upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* ---- E. Employee base address (geographic origin + zone) ---- */
    INSERT INTO dbo.Rec_EmployeeBaseAddress (EmployeeId, InputAddress, FormattedAddress, ValidationStatus, City, Country, ZoneId, CreatedAt)
    SELECT e.EmployeeId, b.City, b.City + N', ישראל', N'Seeded', b.City, N'ישראל', z.ZoneId, @Now
    FROM @EmpBase b
    INNER JOIN dbo.Employees e ON e.FullName = b.FullName AND e.IsActive = 1
    INNER JOIN dbo.Rec_WorkZones z ON z.ZoneName = b.ZoneName
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Rec_EmployeeBaseAddress x WHERE x.EmployeeId = e.EmployeeId);
    RAISERROR(N'Rec_EmployeeBaseAddress upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRAN;
    RAISERROR(N'== 08 (employee inputs) FAILED and was rolled back. ==', 16, 1) WITH NOWAIT;
    THROW;
END CATCH;

RAISERROR(N'-- 08: employee inputs section done. --', 0, 1) WITH NOWAIT;

/* ================================================================
   F-I. AVAILABILITY, SITE PROFILES, REQUIRED SKILLS, ALGO PROFILES
   ================================================================ */
BEGIN TRY
    BEGIN TRAN;

    /* ---- Availability: one broad 'Available' window covering the seed
       horizon (so candidates are "fully available"), plus a few realistic
       blocking windows. Window bounds are datetime2(0). ---- */
    DECLARE @AvailFrom DATETIME2(0) = CAST(DATEADD(DAY, -60, @Today) AS DATETIME2(0));
    DECLARE @AvailTo   DATETIME2(0) = CAST(DATEADD(DAY, 181, @Today) AS DATETIME2(0));

    INSERT INTO dbo.Rec_EmployeeAvailability (EmployeeId, AvailableFrom, AvailableTo, AvailabilityType, Source, Notes, CreatedAt)
    SELECT e.EmployeeId, @AvailFrom, @AvailTo, N'Available', N'Seed', N'זמינות שוטפת', @Now
    FROM dbo.Employees e
    WHERE e.IsActive = 1 AND e.IsAssignable = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.Rec_EmployeeAvailability a
                      WHERE a.EmployeeId = e.EmployeeId AND a.AvailableFrom = @AvailFrom AND a.AvailabilityType = N'Available');
    RAISERROR(N'Rec_EmployeeAvailability (Available windows) upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* Short blocking windows (do not blanket-block the roster). */
    DECLARE @Blocks TABLE (FullName NVARCHAR(100), Kind NVARCHAR(20), StartOffset INT, DurDays INT, Notes NVARCHAR(500));
    INSERT INTO @Blocks (FullName, Kind, StartOffset, DurDays, Notes) VALUES
        (N'סרגיי פלדמן', N'Leave',    20, 4, N'חופשה מתוכננת'),
        (N'טל גולן',     N'Training', 15, 1, N'יום הדרכת יצרן'),
        (N'מוחמד עוואד', N'Busy',     30, 1, N'יום ספירת מלאי');

    INSERT INTO dbo.Rec_EmployeeAvailability (EmployeeId, AvailableFrom, AvailableTo, AvailabilityType, Source, Notes, CreatedAt)
    SELECT e.EmployeeId,
           CAST(DATEADD(DAY, b.StartOffset, @Today) AS DATETIME2(0)),
           CAST(DATEADD(DAY, b.StartOffset + b.DurDays, @Today) AS DATETIME2(0)),
           b.Kind, N'Seed', b.Notes, @Now
    FROM @Blocks b
    INNER JOIN dbo.Employees e ON e.FullName = b.FullName AND e.IsActive = 1
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Rec_EmployeeAvailability a
                      WHERE a.EmployeeId = e.EmployeeId
                        AND a.AvailableFrom = CAST(DATEADD(DAY, b.StartOffset, @Today) AS DATETIME2(0))
                        AND a.AvailabilityType = b.Kind);
    RAISERROR(N'Rec_EmployeeAvailability (blocks) upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* ---- F. Site address profiles (per seeded customer site + zone). ---- */
    DECLARE @CityZone TABLE (City NVARCHAR(100), ZoneName NVARCHAR(100));
    INSERT INTO @CityZone (City, ZoneName) VALUES
        (N'כפר סבא', N'אזור השרון'),
        (N'רעננה',   N'אזור השרון'),
        (N'הרצליה',  N'אזור השרון'),
        (N'תל אביב', N'אזור גוש דן'),
        (N'בת ים',   N'אזור גוש דן');

    INSERT INTO dbo.Rec_SiteAddressProfile (SiteId, InputAddress, FormattedAddress, ValidationStatus, City, Country, ZoneId, CreatedAt)
    SELECT s.SiteId,
           ISNULL(s.AddressLine + N', ', N'') + s.City,
           ISNULL(s.AddressLine + N', ', N'') + s.City + N', ישראל',
           N'Seeded', s.City, N'ישראל', z.ZoneId, @Now
    FROM dbo.Sites s
    INNER JOIN dbo.Customers c ON c.CustomerId = s.CustomerId AND c.CustomerType <> N'Internal'
    INNER JOIN @CityZone cz ON cz.City = s.City
    INNER JOIN dbo.Rec_WorkZones z ON z.ZoneName = cz.ZoneName
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Rec_SiteAddressProfile x WHERE x.SiteId = s.SiteId);
    RAISERROR(N'Rec_SiteAddressProfile upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* ---- G. Required skills per task / service call (by RequiredRole). ---- */
    DECLARE @RoleSkill TABLE (Role NVARCHAR(100), SkillName NVARCHAR(100), Importance NVARCHAR(20), RequiredLevel INT);
    INSERT INTO @RoleSkill (Role, SkillName, Importance, RequiredLevel) VALUES
        (N'מנהל פרויקטים',          N'ניהול פרויקטים',     N'Critical', 4),
        (N'מנהלת פרויקטים',         N'ניהול פרויקטים',     N'Critical', 4),
        (N'טכנאי בכיר',             N'אבחון ותיקון תקלות', N'Critical', 4),
        (N'טכנאי בכיר',             N'תשתיות תקשורת מבנים',N'Preferred',3),
        (N'טכנאי מערכות מתח נמוך',  N'חשמל ומתח נמוך',     N'Critical', 4),
        (N'טכנאי מערכות מתח נמוך',  N'בקרת כניסה ומחסומים',N'Preferred',3),
        (N'חשמלאי מוסמך',           N'חשמל ומתח נמוך',     N'Critical', 4),
        (N'חשמלאי מוסמך',           N'גילוי וכיבוי אש',    N'Important', 3),
        (N'מתקין מצלמות',           N'התקנת מצלמות ו-NVR', N'Critical', 4),
        (N'מתקין מצלמות',           N'תשתיות תקשורת מבנים',N'Preferred',2),
        (N'טכנאי תקשורת',           N'תשתיות תקשורת מבנים',N'Critical', 4),
        (N'טכנאי תקשורת',           N'סיב אופטי',          N'Important', 3),
        (N'מתקין בקרת כניסה',       N'בקרת כניסה ומחסומים',N'Critical', 4),
        (N'מתקין בקרת כניסה',       N'חשמל ומתח נמוך',     N'Preferred',2),
        (N'טכנאי שירות',            N'אבחון ותיקון תקלות', N'Critical', 4),
        (N'טכנאי שירות',            N'כריזה ומולטימדיה',   N'Preferred',2);

    INSERT INTO dbo.Rec_WorkItemRequiredSkills (WorkItemId, SkillId, RequiredLevel, ImportanceLevel, Notes, CreatedAt)
    SELECT wi.WorkItemId, s.SkillId, rs.RequiredLevel, rs.Importance, N'נגזר מתפקיד נדרש: ' + wi.RequiredRole, @Now
    FROM dbo.WorkItems wi
    INNER JOIN @RoleSkill rs ON rs.Role = wi.RequiredRole
    INNER JOIN dbo.Rec_Skills s ON s.SkillName = rs.SkillName
    WHERE wi.RequiredRole IS NOT NULL
      AND (
            wi.WorkType = N'ServiceCall'
            OR (wi.WorkType = N'Task' AND EXISTS (
                    SELECT 1 FROM dbo.WorkItems p
                    WHERE p.WorkItemId = wi.ParentWorkItemId AND p.FinanceProjectNumber LIKE N'SEED-P%'))
          )
      AND NOT EXISTS (SELECT 1 FROM dbo.Rec_WorkItemRequiredSkills x WHERE x.WorkItemId = wi.WorkItemId AND x.SkillId = s.SkillId);
    RAISERROR(N'Rec_WorkItemRequiredSkills upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* ---- H. Algorithm profile per task / service call. ---- */
    INSERT INTO dbo.Rec_WorkItemAlgorithmProfile (WorkItemId, ProjectType, RequiredWorkersCount, PlanningNotes, CreatedAt)
    SELECT wi.WorkItemId,
           CASE WHEN wi.WorkType = N'ServiceCall' THEN N'קריאת שירות' ELSE N'התקנה ותשתית' END,
           CASE WHEN wi.EstimatedHours >= 40 THEN 2 ELSE 1 END,
           N'פרופיל שיבוץ אוטומטי (נתוני בסיס)', @Now
    FROM dbo.WorkItems wi
    WHERE (
            wi.WorkType = N'ServiceCall'
            OR (wi.WorkType = N'Task' AND EXISTS (
                    SELECT 1 FROM dbo.WorkItems p
                    WHERE p.WorkItemId = wi.ParentWorkItemId AND p.FinanceProjectNumber LIKE N'SEED-P%'))
          )
      AND NOT EXISTS (SELECT 1 FROM dbo.Rec_WorkItemAlgorithmProfile x WHERE x.WorkItemId = wi.WorkItemId);
    RAISERROR(N'Rec_WorkItemAlgorithmProfile upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRAN;
    RAISERROR(N'== 08 (availability/profiles) FAILED and was rolled back. ==', 16, 1) WITH NOWAIT;
    THROW;
END CATCH;

/* ---- Summary ------------------------------------------------------- */
SELECT
    (SELECT COUNT(*) FROM dbo.Rec_Skills)                  AS Skills_total,
    (SELECT COUNT(*) FROM dbo.Rec_WorkZones)               AS Zones_total,
    (SELECT COUNT(*) FROM dbo.Rec_EmployeeSkills)          AS EmployeeSkills_total,
    (SELECT COUNT(*) FROM dbo.Rec_EmployeeWorkZones)       AS EmployeeZones_total,
    (SELECT COUNT(*) FROM dbo.Rec_EmployeeCapacity)        AS Capacity_total,
    (SELECT COUNT(*) FROM dbo.Rec_EmployeeBaseAddress)     AS BaseAddress_total,
    (SELECT COUNT(*) FROM dbo.Rec_EmployeeAvailability)    AS Availability_total,
    (SELECT COUNT(*) FROM dbo.Rec_SiteAddressProfile)      AS SiteProfiles_total,
    (SELECT COUNT(*) FROM dbo.Rec_WorkItemRequiredSkills)  AS WorkItemRequiredSkills_total,
    (SELECT COUNT(*) FROM dbo.Rec_WorkItemAlgorithmProfile)AS WorkItemAlgoProfiles_total;

RAISERROR(N'== 08_seed_smart_assignment_inputs: done. ==', 0, 1) WITH NOWAIT;



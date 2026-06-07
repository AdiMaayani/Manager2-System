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

    /* Skill catalog aligned to the business domains (= task RequiredRole set
       and the inventory categories). Rec_Skills is preserved across cleanup,
       so this reuses existing rows by name and only adds missing ones. */
    DECLARE @SkillCat TABLE (SkillName NVARCHAR(100), SkillCategory NVARCHAR(100), Descr NVARCHAR(255));
    INSERT INTO @SkillCat (SkillName, SkillCategory, Descr) VALUES
        (N'מצלמות אבטחה',       N'מתח נמוך מאוד', N'התקנה, כבילה והגדרת מצלמות IP ומקליטי NVR'),
        (N'מערכות אזעקה',       N'מתח נמוך מאוד', N'רכזות אזעקה, גלאים, סירנות וגילוי אש'),
        (N'שו"ב',               N'שליטה ובקרה',   N'בקרת כניסה, מחסומים ובקרי מבנה (DDC)'),
        (N'רשת מחשבים',         N'תקשורת',        N'מיתוג מנוהל, פאנלים, ארונות תקשורת ונתבים'),
        (N'טלפוניה ואינטרקום',  N'תקשורת',        N'מרכזיות IP, אינטרקום ושלוחות'),
        (N'כבילה ותשתיות',      N'תשתיות',        N'השחלת CAT6, סיב אופטי, צנרת ותשתית פסיבית'),
        (N'חשמל חכם',           N'חשמל ובקרה',    N'עמעום, ממסרים חכמים, ספקי כוח ובקרת תאורה'),
        (N'מולטימדיה',          N'מולטימדיה',     N'רמקולים, מגברים, מקרנים ומסכים'),
        (N'ניהול פרויקטים',     N'ניהול',         N'ניהול לוחות זמנים, צוותים ומסירות'),
        (N'אבחון ותיקון תקלות', N'שירות',         N'אבחון תקלות שטח ותיקון מערכות מותקנות');

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

    /* ---- B. Employee skills (keyed by PrimaryRole of IsAssignable=1 staff) ----
       Three installers share PrimaryRole = N'צוות התקנות', so they all inherit
       the installer skill set. Every task RequiredRole domain has >=1 candidate. */
    DECLARE @EmpSkill TABLE (Role NVARCHAR(120), SkillName NVARCHAR(100), SkillLevel INT, Years DECIMAL(5,2), IsCertified BIT);
    INSERT INTO @EmpSkill (Role, SkillName, SkillLevel, Years, IsCertified) VALUES
        /* רותם — ראש צוות חשמל חכם ומולטימדיה */
        (N'ראש צוות חשמל חכם ומולטימדיה / ניהול פרויקטים / שירות והתקנות', N'חשמל חכם',           5, 9.0, 1),
        (N'ראש צוות חשמל חכם ומולטימדיה / ניהול פרויקטים / שירות והתקנות', N'מולטימדיה',          5, 8.0, 0),
        (N'ראש צוות חשמל חכם ומולטימדיה / ניהול פרויקטים / שירות והתקנות', N'שו"ב',               3, 6.0, 0),
        (N'ראש צוות חשמל חכם ומולטימדיה / ניהול פרויקטים / שירות והתקנות', N'ניהול פרויקטים',     4, 7.0, 1),
        (N'ראש צוות חשמל חכם ומולטימדיה / ניהול פרויקטים / שירות והתקנות', N'אבחון ותיקון תקלות', 4, 7.0, 0),
        /* יובל — ראש צוות מתח נמוך מאוד */
        (N'ראש צוות מתח נמוך מאוד / ניהול פרויקטים / שירות והתקנות',       N'מצלמות אבטחה',       5, 9.0, 1),
        (N'ראש צוות מתח נמוך מאוד / ניהול פרויקטים / שירות והתקנות',       N'מערכות אזעקה',       4, 7.0, 0),
        (N'ראש צוות מתח נמוך מאוד / ניהול פרויקטים / שירות והתקנות',       N'שו"ב',               4, 7.0, 0),
        (N'ראש צוות מתח נמוך מאוד / ניהול פרויקטים / שירות והתקנות',       N'רשת מחשבים',         4, 6.0, 1),
        (N'ראש צוות מתח נמוך מאוד / ניהול פרויקטים / שירות והתקנות',       N'טלפוניה ואינטרקום',  3, 5.0, 0),
        (N'ראש צוות מתח נמוך מאוד / ניהול פרויקטים / שירות והתקנות',       N'ניהול פרויקטים',     4, 6.0, 1),
        (N'ראש צוות מתח נמוך מאוד / ניהול פרויקטים / שירות והתקנות',       N'אבחון ותיקון תקלות', 4, 6.0, 0),
        /* איתן / עופר / ליאור — צוות התקנות (shared role) */
        (N'צוות התקנות',  N'כבילה ותשתיות',      4, 5.0, 0),
        (N'צוות התקנות',  N'מצלמות אבטחה',       4, 5.0, 0),
        (N'צוות התקנות',  N'רשת מחשבים',         3, 4.0, 0),
        (N'צוות התקנות',  N'חשמל חכם',           3, 4.0, 0),
        (N'צוות התקנות',  N'מולטימדיה',          3, 4.0, 0),
        (N'צוות התקנות',  N'מערכות אזעקה',       3, 4.0, 0),
        (N'צוות התקנות',  N'טלפוניה ואינטרקום',  3, 3.0, 0),
        (N'צוות התקנות',  N'אבחון ותיקון תקלות', 3, 4.0, 0);

    INSERT INTO dbo.Rec_EmployeeSkills (EmployeeId, SkillId, SkillLevel, YearsExperience, IsCertified, CreatedAt)
    SELECT e.EmployeeId, s.SkillId, es.SkillLevel, es.Years, es.IsCertified, @Now
    FROM @EmpSkill es
    INNER JOIN dbo.Employees e ON e.PrimaryRole = es.Role AND e.IsActive = 1 AND e.IsAssignable = 1
    INNER JOIN dbo.Rec_Skills s ON s.SkillName = es.SkillName
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Rec_EmployeeSkills x WHERE x.EmployeeId = e.EmployeeId AND x.SkillId = s.SkillId);
    RAISERROR(N'Rec_EmployeeSkills upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* ---- C. Employee work zones: home (primary) + secondary coverage ---- */
    /* Only the five IsAssignable=1 operational employees get a base address
       and work zones. Admin / sales / domain managers are intentionally absent. */
    DECLARE @EmpBase TABLE (FullName NVARCHAR(100), City NVARCHAR(100), ZoneName NVARCHAR(100));
    INSERT INTO @EmpBase (FullName, City, ZoneName) VALUES
        (N'רותם', N'כפר סבא', N'אזור השרון'),
        (N'יובל', N'רעננה',   N'אזור השרון'),
        (N'איתן', N'נתניה',   N'אזור השרון'),
        (N'עופר', N'תל אביב', N'אזור גוש דן'),
        (N'ליאור',N'בת ים',   N'אזור גוש דן');

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
        (N'רותם', N'אזור גוש דן'),
        (N'יובל', N'אזור גוש דן'),
        (N'איתן', N'אזור גוש דן'),
        (N'עופר', N'אזור השרון'),
        (N'ליאור',N'אזור השרון');

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

    /* Short blocking windows (do not blanket-block the roster). Placed past the
       dense WorkPlan horizon (+35d) so they never collide with scheduled tasks. */
    DECLARE @Blocks TABLE (FullName NVARCHAR(100), Kind NVARCHAR(20), StartOffset INT, DurDays INT, Notes NVARCHAR(500));
    INSERT INTO @Blocks (FullName, Kind, StartOffset, DurDays, Notes) VALUES
        (N'איתן', N'Leave',    42, 4, N'חופשה מתוכננת'),
        (N'ליאור',N'Training', 47, 1, N'יום הדרכת יצרן'),
        (N'עופר', N'Busy',     40, 1, N'יום ספירת מלאי');

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
    /* Each WorkItem.RequiredRole IS a skill-domain name; map it to that skill
       (Critical) plus one realistic secondary skill. Covers every RequiredRole
       used in 04 / 07. */
    DECLARE @RoleSkill TABLE (Role NVARCHAR(100), SkillName NVARCHAR(100), Importance NVARCHAR(20), RequiredLevel INT);
    INSERT INTO @RoleSkill (Role, SkillName, Importance, RequiredLevel) VALUES
        (N'ניהול פרויקטים',     N'ניהול פרויקטים',     N'Critical', 4),
        (N'ניהול פרויקטים',     N'אבחון ותיקון תקלות', N'Preferred',2),
        (N'מצלמות אבטחה',       N'מצלמות אבטחה',       N'Critical', 4),
        (N'מצלמות אבטחה',       N'כבילה ותשתיות',      N'Preferred',3),
        (N'מערכות אזעקה',       N'מערכות אזעקה',       N'Critical', 4),
        (N'מערכות אזעקה',       N'אבחון ותיקון תקלות', N'Important', 3),
        (N'שו"ב',               N'שו"ב',               N'Critical', 4),
        (N'שו"ב',               N'חשמל חכם',           N'Preferred',2),
        (N'רשת מחשבים',         N'רשת מחשבים',         N'Critical', 4),
        (N'רשת מחשבים',         N'כבילה ותשתיות',      N'Important', 3),
        (N'טלפוניה ואינטרקום',  N'טלפוניה ואינטרקום',  N'Critical', 4),
        (N'טלפוניה ואינטרקום',  N'רשת מחשבים',         N'Preferred',2),
        (N'כבילה ותשתיות',      N'כבילה ותשתיות',      N'Critical', 4),
        (N'כבילה ותשתיות',      N'רשת מחשבים',         N'Preferred',2),
        (N'חשמל חכם',           N'חשמל חכם',           N'Critical', 4),
        (N'חשמל חכם',           N'שו"ב',               N'Preferred',2),
        (N'מולטימדיה',          N'מולטימדיה',          N'Critical', 4),
        (N'מולטימדיה',          N'חשמל חכם',           N'Preferred',2),
        (N'אבחון ותיקון תקלות', N'אבחון ותיקון תקלות', N'Critical', 4);

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



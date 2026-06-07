/* =====================================================================
   ManageR2 - Dev Realistic Seed
   03_seed_core.sql

   Seeds the relational core (deterministic, realistic Hebrew data):
     - Employees (field roster, distinct from preserved admin users)
     - Customers (Israeli low-voltage / smart-systems clients)
     - Sites
     - Contacts (customer-linked + standalone suppliers/partners)
     - Contractors
     - InventoryItems

   Implementation notes:
     - Direct, set-based INSERTs guarded by natural-key NOT EXISTS.
       Chosen over the create SPs because we need: idempotency, stable
       natural keys for later scripts, and the ability to set fields the
       SPs do not expose. (See 00_README.md, "Stored procedures".)
     - @SeedUserId is resolved from an ACTIVE Admin (prefers the five
       named admins). THROWs if none exists.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ---- Context / sentinel guards ------------------------------------ */
IF DB_NAME() IN (N'master', N'model', N'msdb', N'tempdb')
    THROW 60010, N'Refusing to run against a system database. Select your ManageR2 dev database first.', 1;
IF OBJECT_ID(N'dbo.Customers', N'U') IS NULL OR OBJECT_ID(N'dbo.Employees', N'U') IS NULL
    THROW 60011, N'Current database does not look like a ManageR2 database. Aborting.', 1;

RAISERROR(N'== 03_seed_core: starting ==', 0, 1) WITH NOWAIT;

/* ---- Resolve @SeedUserId (active Admin; prefer named admins) ------ */
DECLARE @SeedUserId INT;
DECLARE @Preferred TABLE (Name NVARCHAR(50) PRIMARY KEY, Rank INT);
INSERT INTO @Preferred (Name, Rank) VALUES
    (N'adi', 1), (N'klil', 2), (N'almog', 3), (N'raviv', 4), (N'ronen', 5);

SELECT TOP (1) @SeedUserId = u.UserId
FROM dbo.Users u
INNER JOIN dbo.UserRoles ur ON ur.UserId = u.UserId AND ur.IsActive = 1
INNER JOIN dbo.Roles r ON r.RoleId = ur.RoleId AND r.RoleName = N'Admin'
INNER JOIN @Preferred p
    ON LOWER(REPLACE(u.Username, N' ', N'')) IN (p.Name, N'admin-' + p.Name)
       OR LOWER(u.Email) LIKE p.Name + N'@%'
       OR LOWER(u.Email) LIKE N'admin' + p.Name + N'@%'
       OR (p.Name = N'almog' AND LOWER(u.Email) = N'algom@gmail.com')
WHERE u.IsActive = 1
ORDER BY p.Rank, u.UserId;

IF @SeedUserId IS NULL
    SELECT TOP (1) @SeedUserId = u.UserId
    FROM dbo.Users u
    INNER JOIN dbo.UserRoles ur ON ur.UserId = u.UserId AND ur.IsActive = 1
    INNER JOIN dbo.Roles r ON r.RoleId = ur.RoleId AND r.RoleName = N'Admin'
    WHERE u.IsActive = 1
    ORDER BY u.UserId;

IF @SeedUserId IS NULL
    THROW 60001, N'No active Admin user found; seed aborted (this script never creates users). Run 02_ensure_admin_roles.sql and verify an admin exists.', 1;

RAISERROR(N'Using SeedUserId = %d for ownership columns.', 0, 1, @SeedUserId) WITH NOWAIT;

DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();

BEGIN TRY
    BEGIN TRAN;

    /* ================================================================
       EMPLOYEES - field roster (names deliberately differ from the
       preserved admin users to avoid confusion / duplication).
       Roles align with WorkItems.RequiredRole used in 04 and the
       skills seeded in 08.
       ================================================================ */
    DECLARE @Employees TABLE (
        FullName NVARCHAR(100),
        PrimaryRole NVARCHAR(100),
        Phone NVARCHAR(20),
        Email NVARCHAR(100),
        DailyCapacityHours DECIMAL(4,2),
        IsAssignable BIT
    );
    INSERT INTO @Employees (FullName, PrimaryRole, Phone, Email, DailyCapacityHours, IsAssignable) VALUES
        (N'יוסי אברהמי',  N'מנהל פרויקטים',            N'052-5512011', N'yossi.avrahami@smartsys.co.il', 8.00, 1),
        (N'דנה כהן',       N'מנהלת פרויקטים',           N'052-5512012', N'dana.cohen@smartsys.co.il',     8.00, 1),
        (N'איציק לוי',     N'טכנאי בכיר',               N'052-5512013', N'itzik.levi@smartsys.co.il',     8.00, 1),
        (N'מוחמד עוואד',   N'טכנאי מערכות מתח נמוך',     N'052-5512014', N'mohammed.awad@smartsys.co.il',  8.00, 1),
        (N'סרגיי פלדמן',   N'חשמלאי מוסמך',             N'052-5512015', N'sergey.feldman@smartsys.co.il', 8.00, 1),
        (N'אבי מזרחי',     N'מתקין מצלמות',             N'052-5512016', N'avi.mizrahi@smartsys.co.il',    8.00, 1),
        (N'נועם שלו',      N'טכנאי תקשורת',             N'052-5512017', N'noam.shalev@smartsys.co.il',    8.00, 1),
        (N'ראמי חורי',     N'מתקין בקרת כניסה',         N'052-5512018', N'rami.khoury@smartsys.co.il',    8.00, 1),
        (N'טל גולן',       N'טכנאי שירות',              N'052-5512019', N'tal.golan@smartsys.co.il',      8.00, 1),
        (N'עומר בן דוד',   N'מתקין מצלמות',             N'052-5512020', N'omer.bendavid@smartsys.co.il',  8.00, 1);

    INSERT INTO dbo.Employees (FullName, PrimaryRole, Phone, Email, IsActive, CreatedAt, DailyCapacityHours, IsAssignable)
    SELECT e.FullName, e.PrimaryRole, e.Phone, e.Email, 1, @Now, e.DailyCapacityHours, e.IsAssignable
    FROM @Employees e
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Employees x WHERE x.FullName = e.FullName);
    RAISERROR(N'Employees upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRAN;
    RAISERROR(N'== 03_seed_core (employees) FAILED and was rolled back. ==', 16, 1) WITH NOWAIT;
    THROW;
END CATCH;

RAISERROR(N'-- 03_seed_core: employees section done. --', 0, 1) WITH NOWAIT;

BEGIN TRY
BEGIN TRAN;

/* ====================================================================
   CUSTOMERS - Israeli low-voltage / smart-systems clients.
   CustomerType in {עסקי, פרטי, גוף ציבורי, תאגיד}; Status 'פעיל'.
   Natural key: CustomerName.
   ==================================================================== */
DECLARE @Customers TABLE (
    CustomerName NVARCHAR(200),
    CustomerType NVARCHAR(50),
    Phone NVARCHAR(20),
    Email NVARCHAR(100),
    City NVARCHAR(100),
    Region NVARCHAR(100),
    Address NVARCHAR(255),
    Notes NVARCHAR(1000)
);
INSERT INTO @Customers (CustomerName, CustomerType, Phone, Email, City, Region, Address, Notes) VALUES
    (N'עיריית כפר סבא',                    N'גוף ציבורי', N'09-7649000', N'info@ksaba.muni.il',                N'כפר סבא', N'השרון',  N'רחוב ויצמן 135, כפר סבא',        N'לקוח מסגרת - מערכות אבטחה ובקרה במבני ציבור'),
    (N'קניון רננים - חברת ניהול',          N'תאגיד',      N'09-7610000', N'mgmt@renanim-mall.co.il',           N'רעננה',   N'השרון',  N'דרך מנחם בגין 2, רעננה',         N'אחזקת מערכות מצלמות וכריזה במתחם המסחרי'),
    (N'רשת מלונות ישרוטל',                 N'עסקי',       N'03-5200000', N'projects@isrotel-example.co.il',    N'תל אביב', N'גוש דן', N'רחוב הירקון 115, תל אביב',       N'פרויקטי מולטימדיה וחדרי ישיבות'),
    (N'מכללת אפקה להנדסה',                 N'גוף ציבורי', N'03-7688888', N'facilities@afeka-example.ac.il',    N'תל אביב', N'גוש דן', N'רחוב מבצע קדש 38, תל אביב',      N'תשתיות תקשורת ובקרת כניסה בקמפוס'),
    (N'מגדלי הים התיכון - ניהול ואחזקה',   N'תאגיד',      N'03-5512345', N'vaad@medtowers.co.il',              N'בת ים',   N'גוש דן', N'שדרות העצמאות 100, בת ים',       N'בקרת מבנה ומערכות בטיחות במגדלי מגורים'),
    (N'בנק הפועלים סניף רעננה',            N'עסקי',       N'09-7720000', N'branch.raanana@bank-example.co.il', N'רעננה',   N'השרון',  N'אחוזה 96, רעננה',               N'שדרוג מערכות מצלמות ואזעקה בסניף'),
    (N'מרכז רפואי מאיר',                   N'גוף ציבורי', N'09-7472555', N'maintenance@meir-example.health.il',N'כפר סבא', N'השרון',  N'רחוב טשרניחובסקי 59, כפר סבא',   N'מערכות גילוי אש וכריזת חירום'),
    (N'משפחת לוי - הרצליה פיתוח',          N'פרטי',       N'054-4412233',N'david.levi@example.com',            N'הרצליה',  N'השרון',  N'רחוב גלי תכלת 20, הרצליה פיתוח', N'מערכת בית חכם בווילה פרטית');

INSERT INTO dbo.Customers (CustomerName, CustomerType, Phone, Email, PrimaryPhone, PrimaryEmail, City, Region, Address, Status, Notes, IsActive, CreatedAt, CreatedByUserId)
SELECT c.CustomerName, c.CustomerType, c.Phone, c.Email, c.Phone, c.Email, c.City, c.Region, c.Address, N'פעיל', c.Notes, 1, @Now, @SeedUserId
FROM @Customers c
WHERE NOT EXISTS (SELECT 1 FROM dbo.Customers x WHERE x.CustomerName = c.CustomerName);
RAISERROR(N'Customers upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

/* ====================================================================
   SITES - one or two per customer. Natural key: (CustomerId, SiteName).
   ==================================================================== */
DECLARE @Sites TABLE (
    CustomerName NVARCHAR(200),
    SiteName NVARCHAR(100),
    AddressLine NVARCHAR(200),
    City NVARCHAR(50),
    IsPrimary BIT,
    Notes NVARCHAR(500)
);
INSERT INTO @Sites (CustomerName, SiteName, AddressLine, City, IsPrimary, Notes) VALUES
    (N'עיריית כפר סבא',                  N'בניין העירייה הראשי',            N'רחוב ויצמן 135', N'כפר סבא', 1, N'מוקד עירוני ומערך מצלמות מרכזי'),
    (N'עיריית כפר סבא',                  N'חניון עירוני מרכזי',             N'רחוב הרצל 20',   N'כפר סבא', 0, N'מחסומים ובקרת כניסה לרכב'),
    (N'קניון רננים - חברת ניהול',        N'קניון רננים - מתחם ראשי',        N'דרך מנחם בגין 2',N'רעננה',   1, N'מסחר, חניון ומוקד ביטחון'),
    (N'קניון רננים - חברת ניהול',        N'חניון קניון רננים',              N'דרך מנחם בגין 2',N'רעננה',   0, N'בקרת כניסה ומונים לחניון'),
    (N'רשת מלונות ישרוטל',               N'מלון ישרוטל תל אביב - אגף כנסים', N'רחוב הירקון 115',N'תל אביב', 1, N'אולמות כנסים וחדרי ישיבות'),
    (N'מכללת אפקה להנדסה',               N'קמפוס אפקה - בניין הנדסה',        N'רחוב מבצע קדש 38',N'תל אביב',1, N'מעבדות וכיתות חכמות'),
    (N'מכללת אפקה להנדסה',               N'קמפוס אפקה - ספרייה',            N'רחוב מבצע קדש 38',N'תל אביב',0, N'בקרת כניסה ומערכת השאלה'),
    (N'מגדלי הים התיכון - ניהול ואחזקה', N'מגדל מגורים A',                  N'שדרות העצמאות 100',N'בת ים', 1, N'לובי, חניון ומערכות בקרת מבנה'),
    (N'בנק הפועלים סניף רעננה',          N'סניף רעננה מרכז',                N'אחוזה 96',       N'רעננה',   1, N'אזור קופות וכספות'),
    (N'מרכז רפואי מאיר',                 N'אגף אשפוז חדש',                  N'רחוב טשרניחובסקי 59',N'כפר סבא',1,N'מחלקות אשפוז ומסדרונות'),
    (N'משפחת לוי - הרצליה פיתוח',        N'וילה פרטית הרצליה פיתוח',         N'רחוב גלי תכלת 20',N'הרצליה', 1, N'בית פרטי תלת-מפלסי');

INSERT INTO dbo.Sites (CustomerId, SiteName, AddressLine, City, IsPrimary, Notes, CreatedAt, IsActive)
SELECT c.CustomerId, s.SiteName, s.AddressLine, s.City, s.IsPrimary, s.Notes, @Now, 1
FROM @Sites s
INNER JOIN dbo.Customers c ON c.CustomerName = s.CustomerName
WHERE NOT EXISTS (SELECT 1 FROM dbo.Sites x WHERE x.CustomerId = c.CustomerId AND x.SiteName = s.SiteName);
RAISERROR(N'Sites upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

/* ====================================================================
   CONTACTS
   - ContactCategory uses DB enum values (CustomerPrimary,
     CustomerRepresentative, Supplier, BusinessPartner, Contractor,
     Consultant, Architect, Other) per CK_Contacts_ContactCategory.
   - CustomerPrimary / CustomerRepresentative REQUIRE a CustomerId.
   - Every contact has a phone (satisfies phone-or-email CHECK).
   - Natural key: (FullName, ContactCategory).
   ==================================================================== */
DECLARE @CustomerContacts TABLE (
    CustomerName NVARCHAR(200),
    FullName NVARCHAR(200),
    JobTitle NVARCHAR(150),
    ContactCategory NVARCHAR(50),
    Phone NVARCHAR(50),
    Email NVARCHAR(255)
);
INSERT INTO @CustomerContacts (CustomerName, FullName, JobTitle, ContactCategory, Phone, Email) VALUES
    (N'עיריית כפר סבא',                  N'אבי נחמיאס',  N'מנהל אגף בינוי ותחזוקה', N'CustomerPrimary',        N'09-7649123', N'a.nachmias@ksaba.muni.il'),
    (N'עיריית כפר סבא',                  N'ניר ברקת',    N'קצין ביטחון ראשי',       N'CustomerRepresentative', N'050-6612001',NULL),
    (N'קניון רננים - חברת ניהול',        N'שירלי מימון', N'מנהלת אחזקה',            N'CustomerPrimary',        N'050-6612002',N'shirly@renanim-mall.co.il'),
    (N'קניון רננים - חברת ניהול',        N'מאיה כהן',    N'אחראית ביטחון ומוקד',    N'CustomerRepresentative', N'050-6612003',NULL),
    (N'רשת מלונות ישרוטל',               N'גדעון אבישר', N'מנהל תפעול',             N'CustomerPrimary',        N'03-5200111', N'gideon@isrotel-example.co.il'),
    (N'מכללת אפקה להנדסה',               N'חיים גרנות',  N'מנהל תפעול קמפוס',       N'CustomerPrimary',        N'03-7688123', N'granot@afeka-example.ac.il'),
    (N'מגדלי הים התיכון - ניהול ואחזקה', N'ויקטור אזולאי',N'מנהל הבניין',           N'CustomerPrimary',        N'050-6612004',NULL),
    (N'בנק הפועלים סניף רעננה',          N'רונית שגיא',  N'מנהלת הסניף',            N'CustomerPrimary',        N'09-7720111', N'ronit.sagi@bank-example.co.il'),
    (N'מרכז רפואי מאיר',                 N'אסף רגב',     N'מנהל מחלקת אחזקה',       N'CustomerPrimary',        N'09-7472111', N'a.regev@meir-example.health.il'),
    (N'משפחת לוי - הרצליה פיתוח',        N'דוד לוי',     N'בעל הנכס',               N'CustomerPrimary',        N'054-4412233',N'david.levi@example.com');

INSERT INTO dbo.Contacts (FullName, JobTitle, ContactCategory, CustomerId, CompanyName, Phone, Email, PreferredChannel, City, Status, IsActive, CreatedAt, CreatedByUserId)
SELECT cc.FullName, cc.JobTitle, cc.ContactCategory, c.CustomerId, c.CustomerName, cc.Phone, cc.Email,
       CASE WHEN cc.Email IS NULL THEN N'טלפון' ELSE N'אימייל' END, c.City, N'פעיל', 1, @Now, @SeedUserId
FROM @CustomerContacts cc
INNER JOIN dbo.Customers c ON c.CustomerName = cc.CustomerName
WHERE NOT EXISTS (SELECT 1 FROM dbo.Contacts x WHERE x.FullName = cc.FullName AND x.ContactCategory = cc.ContactCategory);
RAISERROR(N'Customer-linked contacts upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

DECLARE @StandaloneContacts TABLE (
    FullName NVARCHAR(200),
    JobTitle NVARCHAR(150),
    ContactCategory NVARCHAR(50),
    CompanyName NVARCHAR(200),
    Phone NVARCHAR(50),
    Email NVARCHAR(255),
    City NVARCHAR(100)
);
INSERT INTO @StandaloneContacts (FullName, JobTitle, ContactCategory, CompanyName, Phone, Email, City) VALUES
    (N'אבי בר-טוב',  N'מנהל מכירות',        N'Supplier',        N'היקוויז״ן ישראל',            N'03-9000001', N'sales@hikvision-il-example.co.il', N'ראשון לציון'),
    (N'יוליה רוזן',  N'מנהלת תיק לקוח',     N'Supplier',        N'מילניום מערכות מתח נמוך',     N'03-9000002', N'yulia@millennium-example.co.il',  N'פתח תקווה'),
    (N'סמיר חדאד',   N'מנהל עבודה',         N'Contractor',      N'תשתיות פסיביות הצפון',        N'050-6612011',NULL,                               N'חיפה'),
    (N'מיכל רז',     N'אדריכלית',           N'Architect',       N'רז אדריכלות ופנים',          N'03-9000003', N'michal@raz-arch-example.co.il',   N'תל אביב'),
    (N'יורם שגב',    N'יועץ מערכות מתח נמוך',N'Consultant',      N'שגב הנדסת מערכות',           N'050-6612010',N'yoram@segev-eng-example.co.il',   N'רעננה'),
    (N'קובי טכנו',   N'מנהל פיתוח עסקי',    N'BusinessPartner', N'טכנו-סקיוריטי בע״מ',         N'03-9000004', N'kobi@techno-sec-example.co.il',   N'הרצליה');

INSERT INTO dbo.Contacts (FullName, JobTitle, ContactCategory, CustomerId, CompanyName, Phone, Email, PreferredChannel, City, Status, IsActive, CreatedAt, CreatedByUserId)
SELECT sc.FullName, sc.JobTitle, sc.ContactCategory, NULL, sc.CompanyName, sc.Phone, sc.Email,
       CASE WHEN sc.Email IS NULL THEN N'טלפון' ELSE N'אימייל' END, sc.City, N'פעיל', 1, @Now, @SeedUserId
FROM @StandaloneContacts sc
WHERE NOT EXISTS (SELECT 1 FROM dbo.Contacts x WHERE x.FullName = sc.FullName AND x.ContactCategory = sc.ContactCategory);
RAISERROR(N'Standalone contacts upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

/* ====================================================================
   CONTRACTORS - external crews used on projects. Natural key: CompanyName.
   ==================================================================== */
DECLARE @Contractors TABLE (
    FullName NVARCHAR(100),
    CompanyName NVARCHAR(100),
    Phone NVARCHAR(20),
    Email NVARCHAR(100)
);
INSERT INTO @Contractors (FullName, CompanyName, Phone, Email) VALUES
    (N'משה דהן',     N'חשמל ותקשורת א.ב. בע״מ', N'03-9111001',  N'office@ab-elec-example.co.il'),
    (N'סמיר חדאד',   N'תשתיות פסיביות הצפון',    N'04-8111002',  N'info@north-infra-example.co.il'),
    (N'יבגני קוזלוב',N'כבלים ותקשורת מרכז',      N'03-9111003',  N'service@center-cab-example.co.il'),
    (N'ניסים אוחיון',N'עבודות גובה ותורן בע״מ',  N'052-9111004', N'nissim@height-works-example.co.il');

INSERT INTO dbo.Contractors (FullName, CompanyName, Phone, Email, IsActive, CreatedAt)
SELECT t.FullName, t.CompanyName, t.Phone, t.Email, 1, @Now
FROM @Contractors t
WHERE NOT EXISTS (SELECT 1 FROM dbo.Contractors x WHERE x.CompanyName = t.CompanyName);
RAISERROR(N'Contractors upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

/* ====================================================================
   INVENTORY - low-voltage / smart-systems catalog. Natural key: SkuCode
   (matches the active-SKU unique filtered index). QuantityOnHand >= 0.
   ==================================================================== */
DECLARE @Inventory TABLE (
    SkuCode NVARCHAR(50),
    ItemName NVARCHAR(200),
    Category NVARCHAR(100),
    QuantityOnHand DECIMAL(18,3),
    Unit NVARCHAR(20),
    MinimumQuantity DECIMAL(18,3)
);
INSERT INTO @Inventory (SkuCode, ItemName, Category, QuantityOnHand, Unit, MinimumQuantity) VALUES
    (N'CAM-DOME-4MP',    N'מצלמת כיפה IP 4MP',              N'מצלמות ואבטחה',  48, N'יח׳', 10),
    (N'CAM-BULLET-8MP',  N'מצלמת צינור IP 8MP',            N'מצלמות ואבטחה',  32, N'יח׳', 8),
    (N'CAM-PTZ-2MP',     N'מצלמת PTZ ממונעת 2MP',          N'מצלמות ואבטחה',  9,  N'יח׳', 3),
    (N'NVR-16CH',        N'מקליט רשת NVR 16 ערוצים',        N'מצלמות ואבטחה',  7,  N'יח׳', 2),
    (N'NVR-32CH',        N'מקליט רשת NVR 32 ערוצים',        N'מצלמות ואבטחה',  4,  N'יח׳', 2),
    (N'HDD-8TB',         N'דיסק קשיח לאבטחה 8TB',          N'מצלמות ואבטחה',  22, N'יח׳', 6),
    (N'ACS-CTRL-4DR',    N'בקר כניסה 4 דלתות',             N'בקרת כניסה',     11, N'יח׳', 3),
    (N'ACS-READER-RFID', N'קורא כרטיסים RFID',             N'בקרת כניסה',     40, N'יח׳', 10),
    (N'ACS-MAGLOCK-600', N'מנעול מגנטי 600 ק״ג',           N'בקרת כניסה',     26, N'יח׳', 8),
    (N'ACS-EXIT-BTN',    N'לחצן יציאה',                    N'בקרת כניסה',     35, N'יח׳', 10),
    (N'ACS-CARD-RFID',   N'כרטיס קרבה RFID',               N'בקרת כניסה',     500,N'יח׳', 100),
    (N'NET-CAT6-305',    N'כבל רשת CAT6 (תיבה 305 מ׳)',     N'תקשורת ותשתית',  18, N'תיבה',5),
    (N'NET-PATCH-24',    N'פאנל ניתוק 24 פורט',            N'תקשורת ותשתית',  14, N'יח׳', 4),
    (N'NET-SWITCH-P24',  N'מתג PoE מנוהל 24 פורט',          N'תקשורת ותשתית',  9,  N'יח׳', 3),
    (N'NET-RACK-42U',    N'ארון תקשורת 19 אינץ׳ 42U',       N'תקשורת ותשתית',  5,  N'יח׳', 2),
    (N'NET-FIBER-SM',    N'כבל סיב אופטי חד-מודי (מטר)',    N'תקשורת ותשתית',  1200,N'מ׳',300),
    (N'NET-PATCHCORD2',  N'כבל חיבור רשת 2 מ׳',            N'תקשורת ותשתית',  220,N'יח׳', 50),
    (N'AV-SPK-CEIL6',    N'רמקול תקרה 6W',                 N'כריזה ומולטימדיה',60,N'יח׳', 15),
    (N'AV-AMP-240',      N'מגבר כריזה 240W',               N'כריזה ומולטימדיה',6, N'יח׳', 2),
    (N'AV-SCREEN-75',    N'מסך מקצועי 75 אינץ׳',            N'כריזה ומולטימדיה',5, N'יח׳', 2),
    (N'AV-PROJ-LASER',   N'מקרן לייזר 5000 לומן',          N'כריזה ומולטימדיה',4, N'יח׳', 1),
    (N'AV-MIC-CONF',     N'מיקרופון ועידה שולחני',         N'כריזה ומולטימדיה',18,N'יח׳', 6),
    (N'ELE-PSU-12V10A',  N'ספק כוח מיוצב 12V 10A',         N'חשמל ובקרה',     30, N'יח׳', 8),
    (N'ELE-UPS-1500',    N'אל-פסק UPS 1500VA',             N'חשמל ובקרה',     12, N'יח׳', 4),
    (N'ELE-CONDUIT-25',  N'צינור שרשורי 25 מ״מ (מטר)',     N'חשמל ובקרה',     800,N'מ׳',200),
    (N'BMS-CTRL-DDC',    N'בקר DDC לבקרת מבנה',            N'חשמל ובקרה',     8,  N'יח׳', 2),
    (N'FIRE-SMOKE-DET',  N'גלאי עשן אופטי כתובתי',         N'בטיחות אש',      55, N'יח׳', 15),
    (N'FIRE-PANEL-8Z',   N'רכזת גילוי אש 8 אזורים',         N'בטיחות אש',      4,  N'יח׳', 1);

INSERT INTO dbo.InventoryItems (SkuCode, ItemName, Category, QuantityOnHand, Unit, MinimumQuantity, LocationName, IsActive, CreatedAt)
SELECT i.SkuCode, i.ItemName, i.Category, i.QuantityOnHand, i.Unit, i.MinimumQuantity, N'מחסן ראשי - רעננה', 1, @Now
FROM @Inventory i
WHERE NOT EXISTS (SELECT 1 FROM dbo.InventoryItems x WHERE x.SkuCode = i.SkuCode AND x.IsActive = 1);
RAISERROR(N'Inventory items upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRAN;
    RAISERROR(N'== 03_seed_core (customers..inventory) FAILED and was rolled back. ==', 16, 1) WITH NOWAIT;
    THROW;
END CATCH;

/* ---- Summary ------------------------------------------------------- */
SELECT
    (SELECT COUNT(*) FROM dbo.Employees   WHERE IsActive = 1) AS Employees_active,
    (SELECT COUNT(*) FROM dbo.Customers   WHERE CustomerType <> N'Internal') AS Customers_seeded,
    (SELECT COUNT(*) FROM dbo.Sites)                          AS Sites_total,
    (SELECT COUNT(*) FROM dbo.Contacts)                       AS Contacts_total,
    (SELECT COUNT(*) FROM dbo.Contractors)                    AS Contractors_total,
    (SELECT COUNT(*) FROM dbo.InventoryItems WHERE IsActive = 1) AS Inventory_active;

RAISERROR(N'== 03_seed_core: done. ==', 0, 1) WITH NOWAIT;




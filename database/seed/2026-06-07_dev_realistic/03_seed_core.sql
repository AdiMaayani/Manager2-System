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
       EMPLOYEES - operational roster reflecting the real org structure
       (names deliberately differ from the preserved admin users).

       IsAssignable = 1  -> Smart Assignment / WorkPlan field candidates
                            (team leads + installation crew).
       IsAssignable = 0  -> sales / domain managers; appear as employees
                            but are NOT field-assignable candidates.

       Last names are unknown for now, so first-name Hebrew display names
       are used intentionally (no invented contact details).
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
        -- Sales / domain managers (not field-assignable)
        (N'אלון', N'מנהל תחום ומכירות מולטימדיה',   NULL, NULL, NULL, 0),
        (N'אבי',  N'מנהל מכירות',                    NULL, NULL, NULL, 0),
        (N'נחום', N'מנהל תחום ומכירות חשמל חכם',     NULL, NULL, NULL, 0),
        -- Team leads (project management + service + field-assignable)
        (N'רותם', N'ראש צוות חשמל חכם ומולטימדיה / ניהול פרויקטים / שירות והתקנות', NULL, NULL, 8.00, 1),
        (N'יובל', N'ראש צוות מתח נמוך מאוד / ניהול פרויקטים / שירות והתקנות',       NULL, NULL, 8.00, 1),
        -- Installation crew (field-assignable)
        (N'איתן', N'צוות התקנות', NULL, NULL, 8.00, 1),
        (N'עופר', N'צוות התקנות', NULL, NULL, 8.00, 1),
        (N'ליאור',N'צוות התקנות', NULL, NULL, 8.00, 1);

    INSERT INTO dbo.Employees (FullName, PrimaryRole, Phone, Email, IsActive, CreatedAt, DailyCapacityHours, IsAssignable)
    SELECT e.FullName, e.PrimaryRole, e.Phone, e.Email, 1, @Now, e.DailyCapacityHours, e.IsAssignable
    FROM @Employees e
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Employees x WHERE x.FullName = e.FullName);
    RAISERROR(N'Employees upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* Keep the roster aligned on re-run: correct role / assignability for the
       operational employees in case an earlier seed created them differently.
       Admin-linked employees (02b) are left untouched. */
    UPDATE e
        SET e.PrimaryRole = src.PrimaryRole,
            e.IsAssignable = src.IsAssignable,
            e.DailyCapacityHours = src.DailyCapacityHours,
            e.IsActive = 1
    FROM dbo.Employees e
    INNER JOIN @Employees src ON src.FullName = e.FullName
    WHERE e.PrimaryRole <> src.PrimaryRole
       OR e.IsAssignable <> src.IsAssignable
       OR ISNULL(e.DailyCapacityHours, -1) <> ISNULL(src.DailyCapacityHours, -1)
       OR e.IsActive <> 1;
    RAISERROR(N'Operational employees reconciled (%d corrected).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

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
   CustomerType is restricted to the business set {עסקי, מוסד, פרטי}.
   Status carries the customer business state and is one of
   {פרויקט בביצוע, בשירות תחת חוזה, בתשלום} (Customers.Status column).
   Natural key: CustomerName.
   ==================================================================== */
DECLARE @Customers TABLE (
    CustomerName NVARCHAR(200),
    CustomerType NVARCHAR(50),
    Status NVARCHAR(50),
    Phone NVARCHAR(20),
    Email NVARCHAR(100),
    City NVARCHAR(100),
    Region NVARCHAR(100),
    Address NVARCHAR(255),
    Notes NVARCHAR(1000)
);
INSERT INTO @Customers (CustomerName, CustomerType, Status, Phone, Email, City, Region, Address, Notes) VALUES
    (N'עיריית כפר סבא',                    N'מוסד',  N'בשירות תחת חוזה', N'09-7649000', N'info@ksaba.muni.il',                N'כפר סבא', N'השרון',  N'רחוב ויצמן 135, כפר סבא',        N'לקוח מסגרת - מערכות אבטחה ובקרה במבני ציבור'),
    (N'קניון רננים - חברת ניהול',          N'עסקי',  N'בשירות תחת חוזה', N'09-7610000', N'mgmt@renanim-mall.co.il',           N'רעננה',   N'השרון',  N'דרך מנחם בגין 2, רעננה',         N'אחזקת מערכות מצלמות וכריזה במתחם המסחרי'),
    (N'רשת מלונות ישרוטל',                 N'עסקי',  N'פרויקט בביצוע',   N'03-5200000', N'projects@isrotel-example.co.il',    N'תל אביב', N'גוש דן', N'רחוב הירקון 115, תל אביב',       N'פרויקטי מולטימדיה וחדרי ישיבות'),
    (N'מכללת אפקה להנדסה',                 N'מוסד',  N'פרויקט בביצוע',   N'03-7688888', N'facilities@afeka-example.ac.il',    N'תל אביב', N'גוש דן', N'רחוב מבצע קדש 38, תל אביב',      N'תשתיות תקשורת ובקרת כניסה בקמפוס'),
    (N'מגדלי הים התיכון - ניהול ואחזקה',   N'עסקי',  N'בשירות תחת חוזה', N'03-5512345', N'vaad@medtowers.co.il',              N'בת ים',   N'גוש דן', N'שדרות העצמאות 100, בת ים',       N'בקרת מבנה ומערכות בטיחות במגדלי מגורים'),
    (N'בנק הפועלים סניף רעננה',            N'עסקי',  N'בתשלום',          N'09-7720000', N'branch.raanana@bank-example.co.il', N'רעננה',   N'השרון',  N'אחוזה 96, רעננה',               N'שדרוג מערכות מצלמות ואזעקה בסניף'),
    (N'מרכז רפואי מאיר',                   N'מוסד',  N'פרויקט בביצוע',   N'09-7472555', N'maintenance@meir-example.health.il',N'כפר סבא', N'השרון',  N'רחוב טשרניחובסקי 59, כפר סבא',   N'מערכות גילוי אש וכריזת חירום'),
    (N'משפחת לוי - הרצליה פיתוח',          N'פרטי',  N'בתשלום',          N'054-4412233',N'david.levi@example.com',            N'הרצליה',  N'השרון',  N'רחוב גלי תכלת 20, הרצליה פיתוח', N'מערכת בית חכם בווילה פרטית');

INSERT INTO dbo.Customers (CustomerName, CustomerType, Phone, Email, PrimaryPhone, PrimaryEmail, City, Region, Address, Status, Notes, IsActive, CreatedAt, CreatedByUserId)
SELECT c.CustomerName, c.CustomerType, c.Phone, c.Email, c.Phone, c.Email, c.City, c.Region, c.Address, c.Status, c.Notes, 1, @Now, @SeedUserId
FROM @Customers c
WHERE NOT EXISTS (SELECT 1 FROM dbo.Customers x WHERE x.CustomerName = c.CustomerName);
RAISERROR(N'Customers upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

/* Keep CustomerType / Status aligned to the business set on re-run
   (corrects rows from an earlier seed; never touches the Internal customer). */
UPDATE x
    SET x.CustomerType = c.CustomerType,
        x.Status = c.Status
FROM dbo.Customers x
INNER JOIN @Customers c ON c.CustomerName = x.CustomerName
WHERE x.CustomerType <> c.CustomerType OR ISNULL(x.Status, N'') <> c.Status;
RAISERROR(N'Customer type/status reconciled (%d corrected).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

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

   Category is restricted to the business set:
     חשמל חכם, מולטימדיה, שו"ב, רשת מחשבים, מצלמות אבטחה,
     מערכות אזעקה, טלפוניה ואינטרקום, כבילה ותשתיות.

   DB LIMITATION: InventoryItems has no supplier-price / sale-price /
   warranty columns. Per the brief, warranty status + supplier price +
   sale price are stored in the existing Notes column (documented in
   00_README.md). Warranty is one of {באחריות, לא באחריות}.
   ==================================================================== */
DECLARE @Inventory TABLE (
    SkuCode NVARCHAR(50),
    ItemName NVARCHAR(200),
    Category NVARCHAR(100),
    QuantityOnHand DECIMAL(18,3),
    Unit NVARCHAR(20),
    MinimumQuantity DECIMAL(18,3),
    Warranty NVARCHAR(20),
    SupplierPrice DECIMAL(18,2),
    SalePrice DECIMAL(18,2)
);
INSERT INTO @Inventory (SkuCode, ItemName, Category, QuantityOnHand, Unit, MinimumQuantity, Warranty, SupplierPrice, SalePrice) VALUES
    -- מצלמות אבטחה
    (N'CAM-DOME-4MP',    N'מצלמת כיפה IP 4MP',              N'מצלמות אבטחה',     48,  N'יח׳', 10,  N'באחריות',    280.00,  420.00),
    (N'CAM-BULLET-8MP',  N'מצלמת צינור IP 8MP',            N'מצלמות אבטחה',     32,  N'יח׳', 8,   N'באחריות',    360.00,  540.00),
    (N'CAM-PTZ-2MP',     N'מצלמת PTZ ממונעת 2MP',          N'מצלמות אבטחה',     9,   N'יח׳', 3,   N'באחריות',    1450.00, 2100.00),
    (N'NVR-32CH',        N'מקליט רשת NVR 32 ערוצים',        N'מצלמות אבטחה',     4,   N'יח׳', 2,   N'באחריות',    1900.00, 2750.00),
    (N'HDD-8TB',         N'דיסק קשיח לאבטחה 8TB',          N'מצלמות אבטחה',     22,  N'יח׳', 6,   N'לא באחריות', 520.00,  720.00),
    -- מערכות אזעקה
    (N'ALM-PANEL-8Z',    N'רכזת אזעקה 8 אזורים',           N'מערכות אזעקה',     10,  N'יח׳', 3,   N'באחריות',    540.00,  820.00),
    (N'ALM-PIR',         N'גלאי נפח IR',                   N'מערכות אזעקה',     80,  N'יח׳', 20,  N'באחריות',    45.00,   75.00),
    (N'ALM-SIREN',       N'סירנה חיצונית עם פלאש',         N'מערכות אזעקה',     24,  N'יח׳', 6,   N'באחריות',    120.00,  190.00),
    (N'FIRE-SMOKE-DET',  N'גלאי עשן אופטי כתובתי',         N'מערכות אזעקה',     55,  N'יח׳', 15,  N'באחריות',    95.00,   150.00),
    -- שו"ב (שליטה ובקרה / בקרת כניסה)
    (N'ACS-CTRL-4DR',    N'בקר כניסה 4 דלתות',             N'שו"ב',             11,  N'יח׳', 3,   N'באחריות',    980.00,  1450.00),
    (N'ACS-READER-RFID', N'קורא כרטיסים RFID',             N'שו"ב',             40,  N'יח׳', 10,  N'באחריות',    130.00,  210.00),
    (N'ACS-MAGLOCK-600', N'מנעול מגנטי 600 ק״ג',           N'שו"ב',             26,  N'יח׳', 8,   N'באחריות',    90.00,   150.00),
    (N'BMS-CTRL-DDC',    N'בקר DDC לבקרת מבנה',            N'שו"ב',             8,   N'יח׳', 2,   N'באחריות',    1600.00, 2350.00),
    -- רשת מחשבים
    (N'NET-SWITCH-P24',  N'מתג PoE מנוהל 24 פורט',          N'רשת מחשבים',       9,   N'יח׳', 3,   N'באחריות',    1250.00, 1850.00),
    (N'NET-PATCH-24',    N'פאנל ניתוק 24 פורט',            N'רשת מחשבים',       14,  N'יח׳', 4,   N'באחריות',    110.00,  180.00),
    (N'NET-RACK-42U',    N'ארון תקשורת 19 אינץ׳ 42U',       N'רשת מחשבים',       5,   N'יח׳', 2,   N'באחריות',    1700.00, 2500.00),
    (N'NET-ROUTER-ENT',  N'נתב ארגוני',                    N'רשת מחשבים',       6,   N'יח׳', 2,   N'לא באחריות', 900.00,  1400.00),
    -- כבילה ותשתיות
    (N'NET-CAT6-305',    N'כבל רשת CAT6 (תיבה 305 מ׳)',     N'כבילה ותשתיות',    18,  N'תיבה',5,   N'לא באחריות', 320.00,  480.00),
    (N'NET-FIBER-SM',    N'כבל סיב אופטי חד-מודי (מטר)',    N'כבילה ותשתיות',    1200,N'מ׳',  300, N'לא באחריות', 3.50,    6.00),
    (N'ELE-CONDUIT-25',  N'צינור שרשורי 25 מ״מ (מטר)',     N'כבילה ותשתיות',    800, N'מ׳',  200, N'לא באחריות', 2.20,    4.00),
    (N'NET-PATCHCORD2',  N'כבל חיבור רשת 2 מ׳',            N'כבילה ותשתיות',    220, N'יח׳', 50,  N'לא באחריות', 8.00,    15.00),
    -- חשמל חכם
    (N'ELE-PSU-12V10A',  N'ספק כוח מיוצב 12V 10A',         N'חשמל חכם',         30,  N'יח׳', 8,   N'באחריות',    110.00,  180.00),
    (N'ELE-UPS-1500',    N'אל-פסק UPS 1500VA',             N'חשמל חכם',         12,  N'יח׳', 4,   N'באחריות',    520.00,  780.00),
    (N'SH-DIMMER-KNX',   N'יחידת עמעום חכמה KNX',          N'חשמל חכם',         20,  N'יח׳', 5,   N'באחריות',    380.00,  560.00),
    (N'SH-RELAY-8CH',    N'מודול ממסרים חכם 8 ערוצים',      N'חשמל חכם',         16,  N'יח׳', 4,   N'באחריות',    420.00,  620.00),
    -- מולטימדיה
    (N'AV-SCREEN-75',    N'מסך מקצועי 75 אינץ׳',            N'מולטימדיה',        5,   N'יח׳', 2,   N'באחריות',    3200.00, 4600.00),
    (N'AV-PROJ-LASER',   N'מקרן לייזר 5000 לומן',          N'מולטימדיה',        4,   N'יח׳', 1,   N'באחריות',    4100.00, 5900.00),
    (N'AV-SPK-CEIL6',    N'רמקול תקרה 6W',                 N'מולטימדיה',        60,  N'יח׳', 15,  N'באחריות',    60.00,   110.00),
    (N'AV-AMP-240',      N'מגבר כריזה ומולטימדיה 240W',     N'מולטימדיה',        6,   N'יח׳', 2,   N'באחריות',    880.00,  1300.00),
    -- טלפוניה ואינטרקום
    (N'INT-PANEL-IP',    N'פאנל אינטרקום IP בכניסה',        N'טלפוניה ואינטרקום',8,   N'יח׳', 2,   N'באחריות',    540.00,  820.00),
    (N'INT-STATION',     N'שלוחת אינטרקום פנים',           N'טלפוניה ואינטרקום',30,  N'יח׳', 8,   N'באחריות',    180.00,  290.00),
    (N'TEL-PBX-IP',      N'מרכזיית IP-PBX',                N'טלפוניה ואינטרקום',3,   N'יח׳', 1,   N'לא באחריות', 1500.00, 2200.00),
    (N'TEL-PHONE-IP',    N'טלפון IP שולחני',               N'טלפוניה ואינטרקום',24,  N'יח׳', 6,   N'באחריות',    220.00,  340.00);

    /* Compose the Notes payload (warranty + prices) once, reused for insert + reconcile. */
    INSERT INTO dbo.InventoryItems (SkuCode, ItemName, Category, QuantityOnHand, Unit, MinimumQuantity, LocationName, Notes, IsActive, CreatedAt)
    SELECT i.SkuCode, i.ItemName, i.Category, i.QuantityOnHand, i.Unit, i.MinimumQuantity, N'מחסן ראשי - רעננה',
           N'אחריות: ' + i.Warranty
             + N' | מחיר ספק: ' + CONVERT(NVARCHAR(20), CAST(i.SupplierPrice AS DECIMAL(18,2))) + N' ₪'
             + N' | מחיר מכירה: ' + CONVERT(NVARCHAR(20), CAST(i.SalePrice AS DECIMAL(18,2))) + N' ₪',
           1, @Now
    FROM @Inventory i
    WHERE NOT EXISTS (SELECT 1 FROM dbo.InventoryItems x WHERE x.SkuCode = i.SkuCode AND x.IsActive = 1);
    RAISERROR(N'Inventory items upserted (+%d new).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* Reconcile Category + Notes for SKUs that already existed from an earlier
       seed (so categories/warranty/prices match the current business set). */
    UPDATE x
        SET x.Category = i.Category,
            x.ItemName = i.ItemName,
            x.Notes = N'אחריות: ' + i.Warranty
                + N' | מחיר ספק: ' + CONVERT(NVARCHAR(20), CAST(i.SupplierPrice AS DECIMAL(18,2))) + N' ₪'
                + N' | מחיר מכירה: ' + CONVERT(NVARCHAR(20), CAST(i.SalePrice AS DECIMAL(18,2))) + N' ₪',
            x.UpdatedAt = @Now
    FROM dbo.InventoryItems x
    INNER JOIN @Inventory i ON i.SkuCode = x.SkuCode AND x.IsActive = 1
    WHERE ISNULL(x.Category, N'') <> i.Category
       OR ISNULL(x.Notes, N'') NOT LIKE N'אחריות:%';
    RAISERROR(N'Inventory category/notes reconciled (%d corrected).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

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




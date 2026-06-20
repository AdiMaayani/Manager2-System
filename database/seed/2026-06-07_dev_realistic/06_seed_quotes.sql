/* =====================================================================
   ManageR2 - Dev Realistic Seed
   06_seed_quotes.sql

   Seeds realistic quotes with line items (VAT 17%).

   Uses the official quote stored procedures (they own QuoteNumber
   generation and VAT/total math):
     - dbo.sp_Quotes_Create            (returns QuoteId)
     - dbo.sp_Quotes_AddLine
     - dbo.sp_Quotes_RecalculateTotals

   Idempotency: each quote's Notes carries a stable 'SEED::Qnn' tag; the
   whole block is skipped if any seed-tagged quote already exists (the SPs
   generate fresh QuoteNumbers and cannot be made row-idempotent).

   @SeedUserId is an active Admin (prefers the five named admins).
   Depends on 03 (customers) and 04 (projects).
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() IN (N'master', N'model', N'msdb', N'tempdb')
    THROW 60010, N'Refusing to run against a system database. Select your ManageR2 dev database first.', 1;
IF OBJECT_ID(N'dbo.sp_Quotes_Create', N'P') IS NULL
   OR OBJECT_ID(N'dbo.sp_Quotes_AddLine', N'P') IS NULL
   OR OBJECT_ID(N'dbo.sp_Quotes_RecalculateTotals', N'P') IS NULL
    THROW 60011, N'Quote stored procedures not found. Aborting.', 1;

RAISERROR(N'== 06_seed_quotes: starting ==', 0, 1) WITH NOWAIT;

/* ---- Resolve @SeedUserId (active Admin; prefer named admins) ------ */
DECLARE @SeedUserId INT;
DECLARE @Preferred TABLE (Name NVARCHAR(50) PRIMARY KEY, Rank INT);
INSERT INTO @Preferred (Name, Rank) VALUES (N'adi',1),(N'klil',2),(N'almog',3),(N'raviv',4),(N'ronen',5);

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
    THROW 60001, N'No active Admin user found; quotes seed aborted (users are never created here).', 1;

/* ---- Idempotency gate --------------------------------------------- */
IF EXISTS (SELECT 1 FROM dbo.Quotes WHERE Notes LIKE N'SEED::%')
BEGIN
    RAISERROR(N'Seed-tagged quotes already exist; skipping quote creation (idempotent).', 0, 1) WITH NOWAIT;
    RETURN;
END

DECLARE @Today DATE = CAST(SYSUTCDATETIME() AS DATE);

/* ---- Quote headers ------------------------------------------------- */
DECLARE @QuoteSeed TABLE (
    QuoteKey NVARCHAR(10) PRIMARY KEY,
    CustomerName NVARCHAR(200),
    Fin NVARCHAR(20) NULL,
    Status NVARCHAR(50),
    DateOffset INT,
    ValidDays INT,
    Note NVARCHAR(200)
);
INSERT INTO @QuoteSeed (QuoteKey, CustomerName, Fin, Status, DateOffset, ValidDays, Note) VALUES
    (N'Q01', N'קניון רננים - חברת ניהול',          N'SEED-P01', N'Approved', -38, 30, N'מערכת מצלמות אבטחה למתחם המסחרי'),
    (N'Q02', N'עיריית כפר סבא',                    N'SEED-P02', N'Sent',     -26, 45, N'בקרת כניסה ומחסומי חניון'),
    (N'Q03', N'מכללת אפקה להנדסה',                 N'SEED-P03', N'Tracking', -20, 60, N'תשתית תקשורת CAT6 וסיב אופטי'),
    (N'Q04', N'רשת מלונות ישרוטל',                 N'SEED-P04', N'Draft',    -3,  30, N'מערכת כריזה ומולטימדיה לאולמות'),
    (N'Q05', N'מגדלי הים התיכון - ניהול ואחזקה',   N'SEED-P05', N'Sent',     -5,  45, N'בקרת מבנה חכמה BMS'),
    (N'Q06', N'מרכז רפואי מאיר',                   N'SEED-P07', N'Approved', -16, 30, N'מערכת גילוי אש כתובתית'),
    (N'Q07', N'משפחת לוי - הרצליה פיתוח',          N'SEED-P08', N'Approved', -22, 21, N'מערכת בית חכם לווילה'),
    (N'Q08', N'בנק הפועלים סניף רעננה',            NULL,        N'Rejected', -50, 30, N'שדרוג מצלמות - הצעה שלא נבחרה');

/* ---- Quote lines (QuoteKey -> lines) ------------------------------ */
DECLARE @QuoteLines TABLE (
    QuoteKey NVARCHAR(10),
    Description NVARCHAR(500),
    Quantity DECIMAL(18,2),
    Unit NVARCHAR(50),
    UnitPrice DECIMAL(18,2),
    SortOrder INT
);
INSERT INTO @QuoteLines (QuoteKey, Description, Quantity, Unit, UnitPrice, SortOrder) VALUES
    (N'Q01', N'מצלמת כיפה IP 4MP',              24, N'יח׳', 420.00,  1),
    (N'Q01', N'מצלמת צינור IP 8MP',            12, N'יח׳', 690.00,  2),
    (N'Q01', N'מקליט רשת NVR 32 ערוצים',        2,  N'יח׳', 3200.00, 3),
    (N'Q01', N'עבודות התקנה וכבילה',           1,  N'קומפלט', 8500.00, 4),
    (N'Q01', N'אחריות ושירות שנתי',            1,  N'שנה', 2400.00, 5),
    (N'Q02', N'בקר כניסה 4 דלתות',             3,  N'יח׳', 2800.00, 1),
    (N'Q02', N'קורא כרטיסים RFID',             8,  N'יח׳', 350.00,  2),
    (N'Q02', N'מחסום חניון אוטומטי',           2,  N'יח׳', 9500.00, 3),
    (N'Q02', N'עבודות התקנה וחיווט',           1,  N'קומפלט', 12000.00, 4),
    (N'Q03', N'כבל סיב אופטי חד-מודי',         800,N'מ׳',  12.00,   1),
    (N'Q03', N'כבל רשת CAT6',                  1200,N'מ׳', 6.00,    2),
    (N'Q03', N'מתג PoE מנוהל 24 פורט',          6,  N'יח׳', 2200.00, 3),
    (N'Q03', N'ארון תקשורת 19 אינץ׳ 42U',       2,  N'יח׳', 1900.00, 4),
    (N'Q03', N'עבודות השחלה והתקנה',           1,  N'קומפלט', 18000.00, 5),
    (N'Q04', N'רמקול תקרה 6W',                 40, N'יח׳', 180.00,  1),
    (N'Q04', N'מגבר כריזה 240W',               2,  N'יח׳', 3400.00, 2),
    (N'Q04', N'מסך מקצועי 75 אינץ׳',           3,  N'יח׳', 6500.00, 3),
    (N'Q04', N'מקרן לייזר 5000 לומן',          2,  N'יח׳', 9800.00, 4),
    (N'Q04', N'התקנה וכיול מערכת',             1,  N'קומפלט', 14000.00, 5),
    (N'Q05', N'בקר DDC לבקרת מבנה',            6,  N'יח׳', 4200.00, 1),
    (N'Q05', N'חיישנים ואביזרי שדה',           1,  N'קומפלט', 8800.00, 2),
    (N'Q05', N'תכנות, אינטגרציה והרצה',        1,  N'קומפלט', 16000.00, 3),
    (N'Q06', N'גלאי עשן אופטי כתובתי',         60, N'יח׳', 95.00,   1),
    (N'Q06', N'רכזת גילוי אש 8 אזורים',         2,  N'יח׳', 5200.00, 2),
    (N'Q06', N'צופר ונצנץ חירום',              12, N'יח׳', 220.00,  3),
    (N'Q06', N'עבודות חיווט והתקנה',           1,  N'קומפלט', 16500.00, 4),
    (N'Q07', N'בקרת תאורה ותריסים',            1,  N'קומפלט', 12000.00, 1),
    (N'Q07', N'מצלמות ובקרת כניסה',            1,  N'קומפלט', 9000.00, 2),
    (N'Q07', N'מערכת מולטירום',                1,  N'קומפלט', 14000.00, 3),
    (N'Q07', N'התקנה, אינטגרציה והדרכה',       1,  N'קומפלט', 11000.00, 4),
    (N'Q08', N'מצלמת כיפה IP 4MP',              8,  N'יח׳', 450.00,  1),
    (N'Q08', N'מקליט רשת NVR 16 ערוצים',        1,  N'יח׳', 2600.00, 2),
    (N'Q08', N'עבודות התקנה',                  1,  N'קומפלט', 6000.00, 3);

DECLARE @createdQuotes INT = 0;

BEGIN TRY
    BEGIN TRAN;

    DECLARE @qk NVARCHAR(10), @custName NVARCHAR(200), @fin NVARCHAR(20),
            @status NVARCHAR(50), @dateOffset INT, @validDays INT, @note NVARCHAR(200);
    DECLARE @custId INT, @projId INT, @quoteId INT, @notes NVARCHAR(1000);
    DECLARE @qDate DATE, @qValid DATE;
    DECLARE @ld NVARCHAR(500), @lq DECIMAL(18,2), @lu NVARCHAR(50), @lp DECIMAL(18,2), @lso INT;
    DECLARE @newQuote TABLE (QuoteId INT);
    DECLARE @newLine TABLE (Id INT);
    DECLARE @totals TABLE (Subtotal DECIMAL(18,2), VatAmount DECIMAL(18,2), Total DECIMAL(18,2));

    DECLARE quote_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT QuoteKey, CustomerName, Fin, Status, DateOffset, ValidDays, Note FROM @QuoteSeed ORDER BY QuoteKey;
    OPEN quote_cursor;
    FETCH NEXT FROM quote_cursor INTO @qk, @custName, @fin, @status, @dateOffset, @validDays, @note;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @custId = (SELECT CustomerId FROM dbo.Customers WHERE CustomerName = @custName);
        SET @projId = CASE WHEN @fin IS NULL THEN NULL
                           ELSE (SELECT WorkItemId FROM dbo.WorkItems WHERE WorkType = N'Project' AND FinanceProjectNumber = @fin) END;

        IF @custId IS NULL
        BEGIN
            RAISERROR(N'Skipping quote %s: customer not found (%s).', 10, 1, @qk, @custName) WITH NOWAIT;
        END
        ELSE
        BEGIN
            SET @notes = N'SEED::' + @qk + N' - ' + @note;
            SET @qDate = DATEADD(DAY, @dateOffset, @Today);
            SET @qValid = DATEADD(DAY, @dateOffset + @validDays, @Today);

            INSERT INTO @newQuote (QuoteId)
            EXEC dbo.sp_Quotes_Create
                @CustomerId = @custId,
                @ProjectId = @projId,
                @QuoteDate = @qDate,
                @ValidUntil = @qValid,
                @Status = @status,
                @Notes = @notes,
                @VatRate = 17.00,
                @CreatedByUserId = @SeedUserId;
            SET @quoteId = (SELECT TOP (1) QuoteId FROM @newQuote);
            DELETE FROM @newQuote;

            /* Add lines for this quote. */
            DECLARE line_cursor CURSOR LOCAL FAST_FORWARD FOR
                SELECT Description, Quantity, Unit, UnitPrice, SortOrder
                FROM @QuoteLines WHERE QuoteKey = @qk ORDER BY SortOrder;
            OPEN line_cursor;
            FETCH NEXT FROM line_cursor INTO @ld, @lq, @lu, @lp, @lso;
            WHILE @@FETCH_STATUS = 0
            BEGIN
                INSERT INTO @newLine (Id)
                EXEC dbo.sp_Quotes_AddLine
                    @QuoteId = @quoteId, @Description = @ld, @Quantity = @lq,
                    @Unit = @lu, @UnitPrice = @lp, @SortOrder = @lso;
                DELETE FROM @newLine;
                FETCH NEXT FROM line_cursor INTO @ld, @lq, @lu, @lp, @lso;
            END
            CLOSE line_cursor;
            DEALLOCATE line_cursor;

            /* Recalculate Subtotal / VAT (17%) / Total. */
            INSERT INTO @totals (Subtotal, VatAmount, Total)
            EXEC dbo.sp_Quotes_RecalculateTotals @QuoteId = @quoteId;
            DELETE FROM @totals;

            SET @createdQuotes += 1;
        END

        FETCH NEXT FROM quote_cursor INTO @qk, @custName, @fin, @status, @dateOffset, @validDays, @note;
    END
    CLOSE quote_cursor;
    DEALLOCATE quote_cursor;

    COMMIT TRAN;
    RAISERROR(N'Quotes created: %d (with line items and recalculated VAT 17%%).', 0, 1, @createdQuotes) WITH NOWAIT;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRAN;
    /* Defensive cursor cleanup. */
    IF CURSOR_STATUS('local', 'line_cursor') >= 0 BEGIN CLOSE line_cursor; DEALLOCATE line_cursor; END
    IF CURSOR_STATUS('local', 'quote_cursor') >= 0 BEGIN CLOSE quote_cursor; DEALLOCATE quote_cursor; END
    RAISERROR(N'== 06_seed_quotes FAILED and was rolled back. ==', 16, 1) WITH NOWAIT;
    THROW;
END CATCH;

/* ---- Summary ------------------------------------------------------- */
SELECT
    (SELECT COUNT(*) FROM dbo.Quotes WHERE Notes LIKE N'SEED::%')        AS Quotes_seeded,
    (SELECT COUNT(*) FROM dbo.QuoteLineItems li
        INNER JOIN dbo.Quotes q ON q.QuoteId = li.QuoteId WHERE q.Notes LIKE N'SEED::%') AS QuoteLines_seeded,
    (SELECT SUM(Total) FROM dbo.Quotes WHERE Notes LIKE N'SEED::%')      AS Quotes_total_incl_vat;

RAISERROR(N'== 06_seed_quotes: done. ==', 0, 1) WITH NOWAIT;

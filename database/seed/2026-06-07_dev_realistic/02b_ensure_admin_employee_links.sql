/* =====================================================================
   ManageR2 - Dev Realistic Seed
   02b_ensure_admin_employee_links.sql

   Purpose:
     Fix the admin User -> Employee mapping. A User has no name of its own
     (dbo.Users has only Username/Email); its displayed identity comes from
     the linked Employees.FullName via Users.EmployeeId. If an admin user is
     linked to the WRONG employee (e.g. klil -> "Yossi Cohen"), the personal
     WorkPlan scope shows the wrong person.

     For each EXISTING user matching adi / klil / almog / raviv / ronen:
       - find the employee that represents that admin
         (match by the user's own Email, else by the canonical FullName),
       - create that employee row only if it does not exist,
       - set the canonical Hebrew FullName and make the employee active
         (so a rerun converges to the correct name even if a prior run
         stored a wrong/garbled value),
       - relink Users.EmployeeId to it if it currently points elsewhere.

   User matching tolerates real-world variants:
       Username : <name>  or  "Admin - <name>"   (e.g. "Klil", "Admin - Klil")
       Email    : <name>@...  or  admin<name>@... (e.g. adminKlil@example.com)
       Almog    : also the known typo email  algom@gmail.com

   Hard rules honored:
     - NEVER creates a User.
     - NEVER touches PasswordHash / PasswordSalt; passwords are untouched.
     - Missing users are REPORTED only, never created.
     - Admin ROLE logic is unchanged (that lives in 02_ensure_admin_roles.sql).
     - Only the five admin links and their matching employee rows are touched;
       the rest of the seed dataset is left alone.

   Identity key: the user's own Email (Users.Email is NOT NULL + UNIQUE);
                 the canonical Hebrew FullName is the displayed identity.

   Idempotent: re-running finds the same employee (by email) and is a no-op.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ---- Context / sentinel guards ------------------------------------ */
IF DB_NAME() IN (N'master', N'model', N'msdb', N'tempdb')
    THROW 60010, N'Refusing to run against a system database. Select your ManageR2 dev database first.', 1;
IF OBJECT_ID(N'dbo.Users', N'U') IS NULL OR OBJECT_ID(N'dbo.Employees', N'U') IS NULL
    THROW 60011, N'Current database is missing Users/Employees. Aborting.', 1;

RAISERROR(N'== 02b_ensure_admin_employee_links: starting ==', 0, 1) WITH NOWAIT;

DECLARE @Now DATETIME2(7) = SYSUTCDATETIME();
DECLARE @createdEmp INT = 0;
DECLARE @relinked INT = 0;
DECLARE @correctedEmp INT = 0;

/* Canonical identity per admin (lowercase match key + display full name). */
DECLARE @AdminMap TABLE (
    Name NVARCHAR(50) PRIMARY KEY,
    Rank INT,
    FullNameHe NVARCHAR(100),
    RoleHe NVARCHAR(100)
);
INSERT INTO @AdminMap (Name, Rank, FullNameHe, RoleHe) VALUES
    (N'adi',   1, N'עדי מעיני',  N'מנהל מערכת'),
    (N'klil',  2, N'כליל כהן',   N'מנהל מערכת'),
    (N'almog', 3, N'אלמוג שלף',  N'מנהל מערכת'),
    (N'raviv', 4, N'רביב מעיני', N'מנהל מערכת'),
    (N'ronen', 5, N'רונן כץ',    N'מנהל מערכת');

BEGIN TRY
    BEGIN TRAN;

    DECLARE @uid INT, @uemail NVARCHAR(100), @uname NVARCHAR(50),
            @fullHe NVARCHAR(100), @roleHe NVARCHAR(100), @curEmp INT, @empId INT;

    DECLARE admin_link_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT u.UserId, u.Email, u.Username, m.FullNameHe, m.RoleHe, u.EmployeeId
        FROM dbo.Users u
        INNER JOIN @AdminMap m
            ON LOWER(REPLACE(u.Username, N' ', N'')) IN (m.Name, N'admin-' + m.Name)
               OR LOWER(u.Email) LIKE m.Name + N'@%'
               OR LOWER(u.Email) LIKE N'admin' + m.Name + N'@%'
               OR (m.Name = N'almog' AND LOWER(u.Email) = N'algom@gmail.com');
    OPEN admin_link_cursor;
    FETCH NEXT FROM admin_link_cursor INTO @uid, @uemail, @uname, @fullHe, @roleHe, @curEmp;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        /* Find the employee that represents this admin: prefer the user's own
           email, then the canonical full name. */
        SET @empId = NULL;
        SELECT TOP (1) @empId = e.EmployeeId
        FROM dbo.Employees e
        WHERE e.Email = @uemail OR e.FullName = @fullHe
        ORDER BY CASE WHEN e.Email = @uemail THEN 0 ELSE 1 END, e.EmployeeId;

        IF @empId IS NULL
        BEGIN
            /* Create ONLY the employee row (never a user). Admins are not
               field-assignable, so keep them out of the assignment pool. */
            INSERT INTO dbo.Employees (FullName, PrimaryRole, Phone, Email, IsActive, CreatedAt, DailyCapacityHours, IsAssignable)
            VALUES (@fullHe, @roleHe, NULL, @uemail, 1, @Now, NULL, 0);
            SET @empId = CAST(SCOPE_IDENTITY() AS INT);
            SET @createdEmp += 1;
            RAISERROR(N'Created employee "%s" for admin user "%s" (EmployeeId %d).', 0, 1, @fullHe, @uname, @empId) WITH NOWAIT;
        END
        ELSE
        BEGIN
            /* Converge the admin's own employee to the canonical name + active.
               Only this admin's matched employee is touched (matched by the
               user's unique email or the canonical name). */
            UPDATE dbo.Employees
                SET FullName = @fullHe,
                    IsActive = 1
            WHERE EmployeeId = @empId
              AND (FullName <> @fullHe OR IsActive <> 1);
            SET @correctedEmp += @@ROWCOUNT;
        END

        /* Relink the user only if it currently points to a different employee.
           Touches EmployeeId only - never password columns. */
        IF @curEmp <> @empId
        BEGIN
            UPDATE dbo.Users SET EmployeeId = @empId WHERE UserId = @uid;
            SET @relinked += 1;
            RAISERROR(N'Relinked user "%s" from EmployeeId %d to %d.', 0, 1, @uname, @curEmp, @empId) WITH NOWAIT;
        END

        FETCH NEXT FROM admin_link_cursor INTO @uid, @uemail, @uname, @fullHe, @roleHe, @curEmp;
    END
    CLOSE admin_link_cursor;
    DEALLOCATE admin_link_cursor;

    COMMIT TRAN;
    RAISERROR(N'Admin links processed: %d created, %d name/active corrected, %d relinked.', 0, 1, @createdEmp, @correctedEmp, @relinked) WITH NOWAIT;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRAN;
    IF CURSOR_STATUS('local', 'admin_link_cursor') >= 0 BEGIN CLOSE admin_link_cursor; DEALLOCATE admin_link_cursor; END
    RAISERROR(N'== 02b_ensure_admin_employee_links FAILED and was rolled back. ==', 16, 1) WITH NOWAIT;
    THROW;
END CATCH;

/* ---- Status report: admin User <-> Employee mapping ---------------- */
SELECT
    m.Name                                          AS ExpectedAdmin,
    m.Rank,
    CASE WHEN u.UserId IS NULL THEN N'MISSING' ELSE N'FOUND' END AS Presence,
    u.UserId,
    u.Username,
    u.Email,
    u.EmployeeId,
    e.FullName                                      AS EmployeeName,
    u.IsActive                                      AS IsUserActive,
    e.IsActive                                      AS IsEmployeeActive,
    CASE
        WHEN u.UserId IS NULL THEN N'MISSING (report only - user not created)'
        WHEN e.EmployeeId IS NULL THEN N'CHECK - no employee linked'
        WHEN e.FullName = m.FullNameHe AND u.IsActive = 1 AND e.IsActive = 1 THEN N'PASS'
        ELSE N'CHECK'
    END                                             AS Result
FROM @AdminMap m
LEFT JOIN dbo.Users u
    ON LOWER(REPLACE(u.Username, N' ', N'')) IN (m.Name, N'admin-' + m.Name)
       OR LOWER(u.Email) LIKE m.Name + N'@%'
       OR LOWER(u.Email) LIKE N'admin' + m.Name + N'@%'
       OR (m.Name = N'almog' AND LOWER(u.Email) = N'algom@gmail.com')
LEFT JOIN dbo.Employees e
    ON e.EmployeeId = u.EmployeeId
ORDER BY m.Rank;

/* ---- Loud warning for any missing required admin ------------------- */
IF EXISTS (
    SELECT 1 FROM @AdminMap m
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.Users u
        WHERE LOWER(REPLACE(u.Username, N' ', N'')) IN (m.Name, N'admin-' + m.Name)
           OR LOWER(u.Email) LIKE m.Name + N'@%'
           OR LOWER(u.Email) LIKE N'admin' + m.Name + N'@%'
           OR (m.Name = N'almog' AND LOWER(u.Email) = N'algom@gmail.com')
    )
)
    RAISERROR(N'WARNING: one or more required admins are MISSING (see result set). This script does NOT create users.', 10, 1) WITH NOWAIT;

RAISERROR(N'== 02b_ensure_admin_employee_links: done. ==', 0, 1) WITH NOWAIT;

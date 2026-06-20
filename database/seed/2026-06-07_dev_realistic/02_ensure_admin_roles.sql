/* =====================================================================
   ManageR2 - Dev Realistic Seed
   02_ensure_admin_roles.sql

   Purpose:
     - Ensure the 'Admin' role exists.
     - For the five named admins (adi, klil, almog, raviv, ronen) that
       ALREADY exist: set IsActive = 1 and ensure an active Admin role
       (via dbo.sp_UpsertUserRole).
     - Report presence / active / role status for all five.

   Hard rules honored:
     - NEVER creates a user.
     - NEVER touches PasswordHash / PasswordSalt (passwords untouched).
     - Missing admins are only REPORTED, never created.

   Matching tolerates real-world variants (case-insensitive):
       Username : <name>  or  "Admin - <name>"   (e.g. "Klil", "Admin - Klil")
       Email    : <name>@...  or  admin<name>@... (e.g. adminKlil@example.com)
       Almog    : also the known typo email  algom@gmail.com

   Idempotent: safe to re-run.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ---- Context / sentinel guards ------------------------------------ */
IF DB_NAME() IN (N'master', N'model', N'msdb', N'tempdb')
    THROW 60010, N'Refusing to run against a system database. Select your ManageR2 dev database first.', 1;

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
   OR OBJECT_ID(N'dbo.Roles', N'U') IS NULL
   OR OBJECT_ID(N'dbo.UserRoles', N'U') IS NULL
   OR OBJECT_ID(N'dbo.sp_UpsertUserRole', N'P') IS NULL
    THROW 60011, N'Current database is missing Users/Roles/UserRoles or sp_UpsertUserRole. Aborting.', 1;

RAISERROR(N'== 02_ensure_admin_roles: starting ==', 0, 1) WITH NOWAIT;

DECLARE @adminUpdated INT = 0;

/* Preferred admin natural keys (lower-case), ranked. */
DECLARE @Preferred TABLE (Name NVARCHAR(50) PRIMARY KEY, Rank INT);
INSERT INTO @Preferred (Name, Rank) VALUES
    (N'adi', 1), (N'klil', 2), (N'almog', 3), (N'raviv', 4), (N'ronen', 5);

BEGIN TRY
    BEGIN TRAN;

    /* ---- 1. Ensure the Admin role exists -------------------------- */
    IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = N'Admin')
    BEGIN
        INSERT INTO dbo.Roles (RoleName, RoleCode, Description, IsActive, CreatedAt)
        VALUES (N'Admin', N'ADMIN', N'מנהל מערכת - גישה מלאה', 1, SYSDATETIME());
        RAISERROR(N'Created missing role: Admin.', 0, 1) WITH NOWAIT;
    END
    ELSE
    BEGIN
        UPDATE dbo.Roles SET IsActive = 1 WHERE RoleName = N'Admin' AND IsActive <> 1;
        RAISERROR(N'Admin role already exists.', 0, 1) WITH NOWAIT;
    END

    /* ---- 2. Resolve which of the five named admins exist ---------- */
    DECLARE @Matched TABLE (UserId INT PRIMARY KEY, Username NVARCHAR(50), MatchName NVARCHAR(50));
    INSERT INTO @Matched (UserId, Username, MatchName)
    SELECT u.UserId, u.Username, p.Name
    FROM dbo.Users u
    INNER JOIN @Preferred p
        ON LOWER(REPLACE(u.Username, N' ', N'')) IN (p.Name, N'admin-' + p.Name)
        OR LOWER(u.Email) LIKE p.Name + N'@%'
        OR LOWER(u.Email) LIKE N'admin' + p.Name + N'@%'
        OR (p.Name = N'almog' AND LOWER(u.Email) = N'algom@gmail.com');

    /* ---- 3. Activate matched admins (never touch passwords) ------- */
    UPDATE u
        SET u.IsActive = 1
    FROM dbo.Users u
    INNER JOIN @Matched m ON m.UserId = u.UserId
    WHERE u.IsActive <> 1;
    RAISERROR(N'Activated %d previously-inactive named admin(s).', 0, 1, @@ROWCOUNT) WITH NOWAIT;

    /* ---- 4. Ensure active Admin role via the official upsert SP ---- */
    DECLARE @uid INT;
    DECLARE admin_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT UserId FROM @Matched;
    OPEN admin_cursor;
    FETCH NEXT FROM admin_cursor INTO @uid;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC dbo.sp_UpsertUserRole @UserId = @uid, @RoleName = N'Admin';
        SET @adminUpdated += 1;
        FETCH NEXT FROM admin_cursor INTO @uid;
    END
    CLOSE admin_cursor;
    DEALLOCATE admin_cursor;
    RAISERROR(N'Ensured Admin role for %d matched named admin user(s).', 0, 1, @adminUpdated) WITH NOWAIT;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRAN;
    RAISERROR(N'== 02_ensure_admin_roles FAILED and was rolled back. ==', 16, 1) WITH NOWAIT;
    THROW;
END CATCH;

/* ---- 5. Status report for the five required admins ---------------- */
SELECT
    p.Name                                          AS ExpectedAdmin,
    p.Rank,
    CASE WHEN u.UserId IS NULL THEN N'MISSING' ELSE N'FOUND' END AS Presence,
    u.UserId,
    u.Username,
    u.Email,
    u.IsActive                                      AS IsActiveNow,
    CAST(CASE WHEN EXISTS (
        SELECT 1
        FROM dbo.UserRoles ur
        INNER JOIN dbo.Roles r ON r.RoleId = ur.RoleId
        WHERE ur.UserId = u.UserId AND ur.IsActive = 1 AND r.RoleName = N'Admin'
    ) THEN 1 ELSE 0 END AS BIT)                     AS HasActiveAdminRole
FROM @Preferred p
LEFT JOIN dbo.Users u
    ON LOWER(REPLACE(u.Username, N' ', N'')) IN (p.Name, N'admin-' + p.Name)
    OR LOWER(u.Email) LIKE p.Name + N'@%'
    OR LOWER(u.Email) LIKE N'admin' + p.Name + N'@%'
    OR (p.Name = N'almog' AND LOWER(u.Email) = N'algom@gmail.com')
ORDER BY p.Rank;

/* ---- 6. Loud warning for any missing required admin --------------- */
IF EXISTS (
    SELECT 1 FROM @Preferred p
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.Users u
        WHERE LOWER(REPLACE(u.Username, N' ', N'')) IN (p.Name, N'admin-' + p.Name)
           OR LOWER(u.Email) LIKE p.Name + N'@%'
           OR LOWER(u.Email) LIKE N'admin' + p.Name + N'@%'
           OR (p.Name = N'almog' AND LOWER(u.Email) = N'algom@gmail.com')
    )
)
    RAISERROR(N'WARNING: one or more required admins are MISSING (see result set). This script does NOT create users.', 10, 1) WITH NOWAIT;

RAISERROR(N'== 02_ensure_admin_roles: done. ==', 0, 1) WITH NOWAIT;

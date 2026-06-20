/* =====================================================================
   ManageR2 - Initial Admin Bootstrap Seed
   00_seed_initial_admin.sql

   PURPOSE
     Create ONE login-able administrator on a fresh database so the system
     can be used end-to-end. A database built only from schema + stored
     procedures (igroup30_prod.sql, or database/schema/tables.sql +
     database/SP folder) contains no Roles and no Users, so login is otherwise
     impossible: POST /api/Users (create user) itself requires an already
     authenticated Admin. This seed breaks that bootstrap cycle.

   VERIFIED AGAINST igroup30_prod.sql + database/SP/ (signatures matched):
     - Users.EmployeeId is NOT NULL            -> create/locate Employee first.
     - Username  NVARCHAR(50)  NOT NULL UNIQUE.
     - Email     NVARCHAR(100) NOT NULL UNIQUE.
     - PasswordSalt NVARCHAR(500) NOT NULL (no default) -> always supplied.
     - sp_CreateEmployee(@FullName,@PrimaryRole,@Phone,@Email,
                         @DailyCapacityHours,@IsAssignable,@IsActive) -> EmployeeId
     - sp_CreateUser(@EmployeeId,@Username,@Email,@PasswordHash,
                     @PasswordSalt,@IsActive,@Phone,@Notes)           -> NewUserId
     - sp_UpsertUserRole(@UserId,@RoleName)  (errors if role row missing).

   CREDENTIALS (DEV ONLY - change before any shared/real environment):
     Username : admin
     Email    : admin@manager2.local
     Password : Admin#2026!

     PasswordHash/PasswordSalt below were produced by PasswordService
     (PBKDF2-SHA256, 100000 iterations, 16-byte salt, 32-byte key, Base64).
     To change the password, regenerate both literals with
     database/seed/initial_admin/generate_password_hash.ps1 and replace them.

   SAFE TO RE-RUN (idempotent). Never overwrites an existing user's password.
   Do NOT execute igroup30_prod.sql to build the DB from this seed; this seed
   only inserts the bootstrap admin into an already-created schema.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ---- Guard: never run against a system database ------------------- */
IF DB_NAME() IN (N'master', N'model', N'msdb', N'tempdb')
    THROW 60020, N'Refusing to run against a system database. Select your ManageR2 database first.', 1;

/* ---- Guard: required schema + stored procedures must exist -------- */
IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
   OR OBJECT_ID(N'dbo.Roles', N'U') IS NULL
   OR OBJECT_ID(N'dbo.UserRoles', N'U') IS NULL
   OR OBJECT_ID(N'dbo.Employees', N'U') IS NULL
   OR OBJECT_ID(N'dbo.sp_CreateEmployee', N'P') IS NULL
   OR OBJECT_ID(N'dbo.sp_CreateUser', N'P') IS NULL
   OR OBJECT_ID(N'dbo.sp_UpsertUserRole', N'P') IS NULL
    THROW 60021, N'Missing required tables or stored procedures. Run schema + SP scripts first.', 1;

/* ---- Bootstrap parameters (dev) ---------------------------------- */
DECLARE @Username     NVARCHAR(50)  = N'admin';
DECLARE @Email        NVARCHAR(100) = N'admin@manager2.local';
DECLARE @FullName     NVARCHAR(100) = N'System Administrator';
DECLARE @PrimaryRole  NVARCHAR(100) = N'Administrator';
DECLARE @RoleName     NVARCHAR(50)  = N'Admin';
DECLARE @RoleCode     NVARCHAR(50)  = N'ADMIN';

/* PBKDF2-SHA256(Admin#2026!) - see header to regenerate. */
DECLARE @PasswordHash NVARCHAR(255) = N'yDKNfl66u6vb5XlGl7VAU9CE0NMbHT2wEv7xFqT+Fqg=';
DECLARE @PasswordSalt NVARCHAR(500) = N'O3xCWL4Vz73GpkoF1lPwtw==';

RAISERROR(N'== 00_seed_initial_admin: starting ==', 0, 1) WITH NOWAIT;

BEGIN TRY
    BEGIN TRAN;

    /* ---- 1. Ensure the Admin role exists ------------------------- */
    IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = @RoleName)
    BEGIN
        INSERT INTO dbo.Roles (RoleName, RoleCode, Description, IsActive, CreatedAt)
        VALUES (@RoleName, @RoleCode, N'System administrator - full access', 1, SYSDATETIME());
        RAISERROR(N'Created missing role: Admin.', 0, 1) WITH NOWAIT;
    END
    ELSE
    BEGIN
        UPDATE dbo.Roles SET IsActive = 1 WHERE RoleName = @RoleName AND IsActive <> 1;
    END

    /* ---- 2. Resolve target user by Username OR Email ------------- */
    DECLARE @UserId INT;
    SELECT @UserId = UserId
    FROM dbo.Users
    WHERE Username = @Username OR Email = @Email;

    IF @UserId IS NULL
    BEGIN
        /* ---- 2a. Ensure an Employee to satisfy Users.EmployeeId -- */
        DECLARE @EmployeeId INT;

        SELECT TOP (1) @EmployeeId = EmployeeId
        FROM dbo.Employees
        WHERE Email = @Email OR FullName = @FullName
        ORDER BY EmployeeId;

        IF @EmployeeId IS NULL
        BEGIN
            DECLARE @newEmployee TABLE (EmployeeId INT);
            INSERT INTO @newEmployee (EmployeeId)
            EXEC dbo.sp_CreateEmployee
                @FullName           = @FullName,
                @PrimaryRole        = @PrimaryRole,
                @Phone              = NULL,
                @Email              = @Email,
                @DailyCapacityHours = NULL,
                @IsAssignable       = 0,   -- system admin is not a field-assignable resource
                @IsActive           = 1;

            SELECT @EmployeeId = EmployeeId FROM @newEmployee;
            RAISERROR(N'Created bootstrap employee (EmployeeId=%d).', 0, 1, @EmployeeId) WITH NOWAIT;
        END

        /* ---- 2b. Create the user via the official stored proc ---- */
        DECLARE @newUser TABLE (NewUserId INT);
        INSERT INTO @newUser (NewUserId)
        EXEC dbo.sp_CreateUser
            @EmployeeId   = @EmployeeId,
            @Username     = @Username,
            @Email        = @Email,
            @PasswordHash = @PasswordHash,
            @PasswordSalt = @PasswordSalt,
            @IsActive     = 1,
            @Phone        = NULL,
            @Notes        = N'Bootstrap administrator created by 00_seed_initial_admin.sql';

        SELECT @UserId = NewUserId FROM @newUser;
        RAISERROR(N'Created bootstrap admin user (UserId=%d).', 0, 1, @UserId) WITH NOWAIT;
    END
    ELSE
    BEGIN
        /* Existing user: only ensure active. NEVER overwrite the password. */
        UPDATE dbo.Users SET IsActive = 1 WHERE UserId = @UserId AND IsActive <> 1;
        RAISERROR(N'Admin user already exists (UserId=%d); password left unchanged.', 0, 1, @UserId) WITH NOWAIT;
    END

    /* ---- 3. Ensure the user holds the active Admin role ---------- */
    EXEC dbo.sp_UpsertUserRole @UserId = @UserId, @RoleName = @RoleName;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRAN;
    RAISERROR(N'== 00_seed_initial_admin FAILED and was rolled back. ==', 16, 1) WITH NOWAIT;
    THROW;
END CATCH;

/* ---- 4. Status report -------------------------------------------- */
SELECT
    u.UserId,
    u.Username,
    u.Email,
    u.EmployeeId,
    u.IsActive,
    CAST(CASE WHEN EXISTS (
        SELECT 1
        FROM dbo.UserRoles ur
        INNER JOIN dbo.Roles r ON r.RoleId = ur.RoleId
        WHERE ur.UserId = u.UserId AND ur.IsActive = 1 AND r.RoleName = @RoleName
    ) THEN 1 ELSE 0 END AS BIT) AS HasActiveAdminRole
FROM dbo.Users u
WHERE u.Username = @Username OR u.Email = @Email;

RAISERROR(N'== 00_seed_initial_admin: done. Login with admin@manager2.local / Admin#2026! ==', 0, 1) WITH NOWAIT;

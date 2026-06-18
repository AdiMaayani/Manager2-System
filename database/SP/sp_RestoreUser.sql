SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Table-valued parameter carrying the role/department names an admin chose for a restored user.
IF TYPE_ID(N'dbo.NameList') IS NULL
BEGIN
    CREATE TYPE dbo.NameList AS TABLE
    (
        Name NVARCHAR(100) NOT NULL
    );
END
GO

-- Restores a soft-deleted user in ONE transaction: reactivates the user row and synchronizes the
-- user's roles/departments to EXACTLY the admin-selected sets. It does not resurrect unrelated
-- historical assignments — anything not selected is deactivated, the selection is (re)activated.
-- At least one role is required (a user with no role would have no access).
CREATE OR ALTER PROCEDURE [dbo].[sp_RestoreUser]
    @UserId INT,
    @Roles dbo.NameList READONLY,
    @Departments dbo.NameList READONLY
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM @Roles)
    BEGIN
        RAISERROR('At least one role is required to restore a user.', 16, 1);
        RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @UserId)
    BEGIN
        SELECT 0 AS RowsAffected;
        RETURN;
    END

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1. Reactivate the user.
        UPDATE dbo.Users
        SET IsActive = 1
        WHERE UserId = @UserId;

        -- 2. Synchronize roles to exactly the selected set.
        UPDATE ur
        SET ur.IsActive = 0,
            ur.RemovedAt = SYSUTCDATETIME()
        FROM dbo.UserRoles ur
        WHERE ur.UserId = @UserId
          AND ur.IsActive = 1
          AND NOT EXISTS
          (
              SELECT 1
              FROM @Roles sel
              JOIN dbo.Roles r ON r.RoleName = sel.Name
              WHERE r.RoleId = ur.RoleId
          );

        UPDATE ur
        SET ur.IsActive = 1,
            ur.RemovedAt = NULL
        FROM dbo.UserRoles ur
        JOIN dbo.Roles r ON r.RoleId = ur.RoleId
        JOIN @Roles sel ON sel.Name = r.RoleName
        WHERE ur.UserId = @UserId;

        INSERT INTO dbo.UserRoles (UserId, RoleId, AssignedAt, IsActive, RemovedAt)
        SELECT @UserId, r.RoleId, SYSUTCDATETIME(), 1, NULL
        FROM @Roles sel
        JOIN dbo.Roles r ON r.RoleName = sel.Name
        WHERE NOT EXISTS
        (
            SELECT 1 FROM dbo.UserRoles ur
            WHERE ur.UserId = @UserId AND ur.RoleId = r.RoleId
        );

        -- 3. Synchronize departments to exactly the selected set (may be empty).
        UPDATE ud
        SET ud.IsActive = 0,
            ud.RemovedAt = SYSUTCDATETIME()
        FROM dbo.UserDepartments ud
        WHERE ud.UserId = @UserId
          AND ud.IsActive = 1
          AND NOT EXISTS
          (
              SELECT 1
              FROM @Departments sel
              JOIN dbo.Departments d ON d.DepartmentName = sel.Name
              WHERE d.DepartmentId = ud.DepartmentId
          );

        UPDATE ud
        SET ud.IsActive = 1,
            ud.RemovedAt = NULL
        FROM dbo.UserDepartments ud
        JOIN dbo.Departments d ON d.DepartmentId = ud.DepartmentId
        JOIN @Departments sel ON sel.Name = d.DepartmentName
        WHERE ud.UserId = @UserId;

        INSERT INTO dbo.UserDepartments (UserId, DepartmentId, AssignedAt, IsActive, RemovedAt)
        SELECT @UserId, d.DepartmentId, SYSUTCDATETIME(), 1, NULL
        FROM @Departments sel
        JOIN dbo.Departments d ON d.DepartmentName = sel.Name
        WHERE NOT EXISTS
        (
            SELECT 1 FROM dbo.UserDepartments ud
            WHERE ud.UserId = @UserId AND ud.DepartmentId = d.DepartmentId
        );

        COMMIT TRANSACTION;

        SELECT 1 AS RowsAffected;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

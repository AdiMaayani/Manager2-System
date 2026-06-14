/*
    ManageR2 permission-matrix role seed.

    Purpose:
        Ensures the role catalog (dbo.Roles) contains the roles required by the
        feature/permissions-matrix branch so administrators can assign them to users
        (sp_UpsertUserRole raises an error if the RoleName row is missing).

        The 'Admin' role is seeded elsewhere (initial admin / ensure_admin_roles) and is
        intentionally not touched here.

    Safety:
        - Additive and idempotent. Inserts each role only when missing (matched by RoleName).
        - No tables, columns, users, or assignments are altered. No data is deleted.
        - Uses the existing dbo.Roles structure (RoleName/RoleCode/Description) — no new
          permissions table is introduced; the existing Roles/UserRoles model is sufficient.

    How to run:
        Execute manually in SSMS (or sqlcmd) against the target database, e.g.

            sqlcmd -S localhost -d ManageR2_Dev -i database/seed/2026-06-14_permission_roles.sql
*/

SET NOCOUNT ON;
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

DECLARE @RolesToSeed TABLE (
    RoleName    NVARCHAR(50)  NOT NULL,
    RoleCode    NVARCHAR(50)  NOT NULL,
    Description NVARCHAR(255) NOT NULL
);

INSERT INTO @RolesToSeed (RoleName, RoleCode, Description) VALUES
    (N'SeniorManagement', N'SR_MGMT',   N'Senior management - broad operational visibility and business data management'),
    (N'ProjectManager',   N'PROJ_MGR',  N'Project manager - manages projects, sites, work plan, tasks, reports and service calls'),
    (N'Office',           N'OFFICE',    N'Office - manages customers, contacts, quotes, reports and service calls'),
    (N'Technician',       N'TECH',      N'Field technician - personal work plan, assigned tasks, service calls and reporting'),
    (N'Inventory',        N'INVENTORY', N'Inventory - manages inventory, equipment and project BOQ items');

INSERT INTO dbo.Roles (RoleName, RoleCode, Description, IsActive, CreatedAt)
SELECT s.RoleName, s.RoleCode, s.Description, 1, SYSDATETIME()
FROM @RolesToSeed AS s
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Roles AS r WHERE r.RoleName = s.RoleName
);

-- Reactivate any of these roles that exist but were previously deactivated.
UPDATE r
SET r.IsActive = 1
FROM dbo.Roles AS r
INNER JOIN @RolesToSeed AS s ON s.RoleName = r.RoleName
WHERE r.IsActive <> 1;
GO

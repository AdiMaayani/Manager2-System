SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_Employees_GetDistinctPrimaryRoles
AS
BEGIN
    SET NOCOUNT ON;

    SELECT availableRole.RoleName AS PrimaryRole
    FROM
    (
        SELECT LTRIM(RTRIM(employee.PrimaryRole)) AS RoleName
        FROM dbo.Employees AS employee
        WHERE employee.IsActive = 1
          AND DATALENGTH(LTRIM(RTRIM(ISNULL(employee.PrimaryRole, N'')))) > 0

        UNION

        SELECT profession.RoleName
        FROM dbo.EmployeeProfessions AS profession
        INNER JOIN dbo.Employees AS professionEmployee
            ON professionEmployee.EmployeeId = profession.EmployeeId
        WHERE professionEmployee.IsActive = 1
    ) AS availableRole
    ORDER BY availableRole.RoleName;
END
GO

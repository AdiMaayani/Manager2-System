SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* =========================================
   sp_GetEmployees
========================================= */
CREATE OR ALTER PROCEDURE [dbo].[sp_GetEmployees]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        employee.EmployeeId,
        employee.FullName,
        employee.PrimaryRole,
        employee.Phone,
        employee.Email,
        employee.DailyCapacityHours,
        employee.IsAssignable,
        employee.IsActive,
        employee.CreatedAt,
        CASE WHEN EXISTS
        (
            SELECT 1 FROM dbo.EmployeeProfessions AS profession
            WHERE profession.EmployeeId = employee.EmployeeId
        ) THEN (
            SELECT profession.RoleName AS [Role]
            FROM dbo.EmployeeProfessions AS profession
            WHERE profession.EmployeeId = employee.EmployeeId
            ORDER BY profession.RoleName
            FOR XML PATH(''), ROOT('Roles'), TYPE
        ) ELSE CAST(NULL AS XML) END AS ProfessionsXml
    FROM dbo.Employees AS employee
    ORDER BY employee.FullName ASC;
END;

GO

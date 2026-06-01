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
        EmployeeId,
        FullName,
        PrimaryRole,
        Phone,
        Email,
        IsActive,
        CreatedAt
    FROM Employees
    ORDER BY FullName;
END;

GO

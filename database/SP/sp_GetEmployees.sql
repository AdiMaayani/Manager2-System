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
        DailyCapacityHours,
        IsAssignable,
        IsActive,
        CreatedAt
    FROM dbo.Employees
    ORDER BY FullName ASC;
END;

GO

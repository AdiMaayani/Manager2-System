SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[Rec_GetActiveAssignableEmployees]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        EmployeeId,
        FullName,
        PrimaryRole,
        IsActive,
        IsAssignable,
        DailyCapacityHours,
        Phone,
        Email
    FROM dbo.Employees
    WHERE IsActive = 1
      AND IsAssignable = 1
    ORDER BY FullName;
END
GO

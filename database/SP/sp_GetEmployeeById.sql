SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetEmployeeById
    @EmployeeId INT
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
    WHERE EmployeeId = @EmployeeId;
END
GO

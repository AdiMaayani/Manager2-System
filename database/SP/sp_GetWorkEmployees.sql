SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/* =========================================
   sp_GetWorkEmployees
========================================= */
CREATE OR ALTER PROCEDURE [dbo].[sp_GetWorkEmployees]
    @WorkItemId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        wea.WorkEmployeeAssignmentId,
        wea.WorkItemId,
        wea.EmployeeId,
        e.FullName,
        e.PrimaryRole,
        e.Phone,
        e.Email,
        wea.AssignmentRole,
        wea.AssignedAt
    FROM WorkEmployeeAssignments wea
    INNER JOIN Employees e ON wea.EmployeeId = e.EmployeeId
    WHERE wea.WorkItemId = @WorkItemId
    ORDER BY wea.AssignedAt DESC;
END;

GO

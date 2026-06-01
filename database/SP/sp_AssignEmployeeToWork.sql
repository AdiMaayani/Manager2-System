SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_AssignEmployeeToWork]
    @WorkItemId INT,
    @EmployeeId INT,
    @AssignmentRole NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.WorkItems
        WHERE WorkItemId = @WorkItemId
    )
    BEGIN
        THROW 50001, 'Work item was not found.', 1;
    END

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.Employees
        WHERE EmployeeId = @EmployeeId
    )
    BEGIN
        THROW 50002, 'Employee was not found.', 1;
    END

    IF NULLIF(LTRIM(RTRIM(@AssignmentRole)), '') IS NULL
    BEGIN
        THROW 50003, 'Assignment role is required.', 1;
    END

    IF EXISTS (
        SELECT 1
        FROM dbo.WorkEmployeeAssignments
        WHERE WorkItemId = @WorkItemId
          AND EmployeeId = @EmployeeId
    )
    BEGIN
        THROW 50004, 'Employee is already assigned to this work item.', 1;
    END

    INSERT INTO dbo.WorkEmployeeAssignments
    (
        WorkItemId,
        EmployeeId,
        AssignmentRole,
        AssignedHours,
        IsManualAssignment
    )
    VALUES
    (
        @WorkItemId,
        @EmployeeId,
        @AssignmentRole,
        NULL,
        1
    );

    SELECT @@ROWCOUNT;
END
GO

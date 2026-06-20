USE [igroup30_prod];
GO

/* =========================================================
   Demo algorithm data for WorkPlan project 1
   Scope:
   - Project: WorkItemId = 1
   - Tasks: 17, 5, 6, 2
   - Employees: 1, 2, 3
   ========================================================= */

BEGIN TRANSACTION;
BEGIN TRY

    /* =========================
       Employees
       ========================= */
    UPDATE dbo.Employees
    SET
        DailyCapacityHours = 8.00,
        IsAssignable = 1
    WHERE EmployeeId IN (1, 2, 3);

    /* =========================
       WorkItems - Tasks only
       ========================= */

    -- Task 17
    UPDATE dbo.WorkItems
    SET
        EstimatedHours = 2.00,
        Priority = N'Medium',
        PlannedStart = '2026-04-21T08:00:00',
        PlannedEnd = '2026-04-21T10:00:00',
        RequiredRole = N'טכנאי בכיר',
        IsLocked = 0
    WHERE WorkItemId = 17;

    -- Task 5
    UPDATE dbo.WorkItems
    SET
        EstimatedHours = 4.00,
        Priority = N'High',
        PlannedStart = '2026-04-21T10:00:00',
        PlannedEnd = '2026-04-21T14:00:00',
        RequiredRole = N'טכנאי בכיר',
        IsLocked = 1
    WHERE WorkItemId = 5;

    -- Task 6
    UPDATE dbo.WorkItems
    SET
        EstimatedHours = 3.00,
        Priority = N'High',
        PlannedStart = '2026-04-21T14:00:00',
        PlannedEnd = '2026-04-21T17:00:00',
        RequiredRole = N'בעלים',
        IsLocked = 0
    WHERE WorkItemId = 6;

    -- Task 2
    UPDATE dbo.WorkItems
    SET
        EstimatedHours = 1.50,
        Priority = N'Low',
        PlannedStart = '2026-04-22T08:00:00',
        PlannedEnd = '2026-04-22T09:30:00',
        RequiredRole = N'טכנאי בכיר',
        IsLocked = 0
    WHERE WorkItemId = 2;

    /* =========================
       WorkEmployeeAssignments
       ========================= */

    -- Project assignment: employee 1
    UPDATE dbo.WorkEmployeeAssignments
    SET
        AssignedHours = 1.00,
        IsManualAssignment = 1
    WHERE WorkItemId = 1
      AND EmployeeId = 1;

    -- Project assignment: employee 2
    UPDATE dbo.WorkEmployeeAssignments
    SET
        AssignedHours = 2.00,
        IsManualAssignment = 1
    WHERE WorkItemId = 1
      AND EmployeeId = 2;

    -- Task 5 assignment: employee 1
    UPDATE dbo.WorkEmployeeAssignments
    SET
        AssignedHours = 4.00,
        IsManualAssignment = 1
    WHERE WorkItemId = 5
      AND EmployeeId = 1;

    -- Task 6 assignment: employee 2
    UPDATE dbo.WorkEmployeeAssignments
    SET
        AssignedHours = 3.00,
        IsManualAssignment = 0
    WHERE WorkItemId = 6
      AND EmployeeId = 2;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

USE [igroup30_prod];
GO

/* =========================================================
   WorkItems – algorithm support fields
   ========================================================= */

IF COL_LENGTH('dbo.WorkItems', 'EstimatedHours') IS NULL
BEGIN
    ALTER TABLE dbo.WorkItems
    ADD EstimatedHours DECIMAL(5,2) NULL;
END
GO

IF COL_LENGTH('dbo.WorkItems', 'Priority') IS NULL
BEGIN
    ALTER TABLE dbo.WorkItems
    ADD Priority NVARCHAR(20) NULL;
END
GO

IF COL_LENGTH('dbo.WorkItems', 'PlannedStart') IS NULL
BEGIN
    ALTER TABLE dbo.WorkItems
    ADD PlannedStart DATETIME2(7) NULL;
END
GO

IF COL_LENGTH('dbo.WorkItems', 'PlannedEnd') IS NULL
BEGIN
    ALTER TABLE dbo.WorkItems
    ADD PlannedEnd DATETIME2(7) NULL;
END
GO

IF COL_LENGTH('dbo.WorkItems', 'RequiredRole') IS NULL
BEGIN
    ALTER TABLE dbo.WorkItems
    ADD RequiredRole NVARCHAR(100) NULL;
END
GO

IF COL_LENGTH('dbo.WorkItems', 'IsLocked') IS NULL
BEGIN
    ALTER TABLE dbo.WorkItems
    ADD IsLocked BIT NOT NULL
        CONSTRAINT DF_WorkItems_IsLocked DEFAULT (0);
END
GO


/* =========================================================
   Employees – algorithm support fields
   ========================================================= */

IF COL_LENGTH('dbo.Employees', 'DailyCapacityHours') IS NULL
BEGIN
    ALTER TABLE dbo.Employees
    ADD DailyCapacityHours DECIMAL(4,2) NULL;
END
GO

IF COL_LENGTH('dbo.Employees', 'IsAssignable') IS NULL
BEGIN
    ALTER TABLE dbo.Employees
    ADD IsAssignable BIT NOT NULL
        CONSTRAINT DF_Employees_IsAssignable DEFAULT (1);
END
GO


/* =========================================================
   WorkEmployeeAssignments – algorithm support fields
   ========================================================= */

IF COL_LENGTH('dbo.WorkEmployeeAssignments', 'AssignedHours') IS NULL
BEGIN
    ALTER TABLE dbo.WorkEmployeeAssignments
    ADD AssignedHours DECIMAL(5,2) NULL;
END
GO

IF COL_LENGTH('dbo.WorkEmployeeAssignments', 'IsManualAssignment') IS NULL
BEGIN
    ALTER TABLE dbo.WorkEmployeeAssignments
    ADD IsManualAssignment BIT NOT NULL
        CONSTRAINT DF_WorkEmployeeAssignments_IsManualAssignment DEFAULT (0);
END
GO
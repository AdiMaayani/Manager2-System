/*
  Idempotent additive migration: nullable ManagerEmployeeId on ProjectMilestones.
  Do not execute unless approved. Safe to re-run.
*/
SET NOCOUNT ON;

IF COL_LENGTH(N'dbo.ProjectMilestones', N'ManagerEmployeeId') IS NULL
BEGIN
    ALTER TABLE dbo.ProjectMilestones
        ADD ManagerEmployeeId INT NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_ProjectMilestones_ManagerEmployee'
)
BEGIN
    ALTER TABLE dbo.ProjectMilestones WITH CHECK
        ADD CONSTRAINT FK_ProjectMilestones_ManagerEmployee
        FOREIGN KEY (ManagerEmployeeId) REFERENCES dbo.Employees(EmployeeId);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.ProjectMilestones')
      AND name = N'IX_ProjectMilestones_ManagerEmployeeId'
)
BEGIN
    CREATE INDEX IX_ProjectMilestones_ManagerEmployeeId
        ON dbo.ProjectMilestones(ManagerEmployeeId)
        WHERE ManagerEmployeeId IS NOT NULL;
END;
GO

SET NOCOUNT ON;
DECLARE @ApproveEnableWorkItemChecks BIT=0;
SELECT COUNT(*) InvalidTypeCategoryRows FROM dbo.WorkItems WHERE CASE WHEN IsArchived=1 THEN 1 WHEN WorkType=N'Project' AND TaskCategory IS NULL AND ParentWorkItemId IS NULL AND MilestoneId IS NULL THEN 1 WHEN WorkType=N'Task' AND TaskCategory=N'Regular' AND ParentWorkItemId IS NULL AND MilestoneId IS NULL THEN 1 WHEN WorkType=N'Task' AND TaskCategory=N'Project' AND ParentWorkItemId IS NOT NULL THEN 1 WHEN WorkType=N'ServiceCall' AND TaskCategory=N'ServiceCall' AND ParentWorkItemId IS NULL AND MilestoneId IS NULL THEN 1 ELSE 0 END=0;
SELECT COUNT(*) InvalidRegularNoProjectRows FROM dbo.WorkItems WHERE CASE WHEN IsArchived=1 THEN 1 WHEN WorkType<>N'Task' THEN 1 WHEN TaskCategory IS NULL THEN 0 WHEN TaskCategory<>N'Regular' THEN 1 WHEN ParentWorkItemId IS NULL AND MilestoneId IS NULL THEN 1 ELSE 0 END=0;
SELECT COUNT(*) ActiveInternalContainers FROM dbo.WorkItems WHERE WorkType=N'Project' AND FinanceProjectNumber=N'INTERNAL' AND IsArchived=0;
SELECT COUNT(*) InternalAuditRows FROM dbo._InternalContextMigrationAudit;
SELECT COUNT(*) InternalContainerAuditRows FROM dbo._InternalContextContainerAudit;
SELECT (SELECT COUNT(*) FROM dbo._MilestoneMigrationMap) MappedRows,
 (SELECT COUNT(*) FROM dbo.ProjectMilestones WHERE LegacyWorkItemId IN(SELECT WorkItemId FROM dbo._MilestoneMigrationMap)) CopiedRows,
 (SELECT COUNT(*) FROM dbo._MilestoneAssignmentAudit) AssignmentAuditRows,
 (SELECT COUNT(*) FROM dbo.WorkEmployeeAssignments a JOIN dbo._MilestoneMigrationMap m ON m.WorkItemId=a.WorkItemId)
 +(SELECT COUNT(*) FROM dbo.WorkContractorAssignments a JOIN dbo._MilestoneMigrationMap m ON m.WorkItemId=a.WorkItemId) ExpectedAssignmentAuditRows;
SELECT m.* FROM dbo._MilestoneMigrationMap m LEFT JOIN dbo.ProjectMilestones pm ON pm.LegacyWorkItemId=m.WorkItemId WHERE pm.ProjectMilestoneId IS NULL;
SELECT wi.WorkItemId,wi.MilestoneId,wi.ParentWorkItemId,pm.ProjectId FROM dbo.WorkItems wi JOIN dbo.ProjectMilestones pm ON pm.ProjectMilestoneId=wi.MilestoneId WHERE wi.ParentWorkItemId<>pm.ProjectId;
SELECT wi.WorkItemId,wi.ParentWorkItemId,p.WorkType ParentWorkType,p.IsArchived ParentIsArchived
FROM dbo.WorkItems wi LEFT JOIN dbo.WorkItems p ON p.WorkItemId=wi.ParentWorkItemId
WHERE wi.IsArchived=0 AND wi.TaskCategory=N'Project' AND (p.WorkItemId IS NULL OR p.WorkType<>N'Project' OR p.IsArchived=1);
SELECT pm.ProjectMilestoneId,pm.ProjectId,p.WorkType ProjectWorkType,p.IsArchived ProjectIsArchived
FROM dbo.ProjectMilestones pm LEFT JOIN dbo.WorkItems p ON p.WorkItemId=pm.ProjectId
WHERE p.WorkItemId IS NULL OR p.WorkType<>N'Project' OR p.IsArchived=1;
SELECT Status,LifecycleStatus,COUNT(*) AS [RowCount] FROM dbo.WorkReports GROUP BY Status,LifecycleStatus;
SELECT Status,COUNT(*) UnknownWorkflowRows FROM dbo.WorkReports WHERE Status IS NULL OR Status NOT IN(N'טיוטה',N'הוגש',N'הועבר להנה״ח') GROUP BY Status;
SELECT LifecycleStatus,COUNT(*) InvalidLifecycleRows FROM dbo.WorkReports WHERE LifecycleStatus NOT IN(N'Draft',N'Finalized',N'Reversed') GROUP BY LifecycleStatus;
SELECT a.WorkItemId FROM dbo._InternalContextMigrationAudit a JOIN dbo.WorkItems w ON w.WorkItemId=a.WorkItemId
WHERE ISNULL(w.ParentWorkItemId,-1)<>ISNULL(a.MigratedParentWorkItemId,-1)
 OR ISNULL(w.CustomerId,-1)<>ISNULL(a.MigratedCustomerId,-1) OR ISNULL(w.SiteId,-1)<>ISNULL(a.MigratedSiteId,-1)
 OR w.TaskCategory<>a.MigratedTaskCategory OR ISNULL(w.MilestoneId,-1)<>ISNULL(a.MigratedMilestoneId,-1);
SELECT name,is_disabled,is_not_trusted FROM sys.check_constraints
WHERE parent_object_id=OBJECT_ID(N'dbo.WorkItems') AND name IN(N'CK_WorkItems_TypeCategory',N'CK_WorkItems_RegularNoProject',N'CK_WorkItems_ArchiveMetadata');
IF @ApproveEnableWorkItemChecks=1
BEGIN
 IF EXISTS(SELECT 1 FROM dbo.WorkItems WHERE CASE WHEN IsArchived=1 THEN 1 WHEN WorkType=N'Project' AND TaskCategory IS NULL AND ParentWorkItemId IS NULL AND MilestoneId IS NULL THEN 1 WHEN WorkType=N'Task' AND TaskCategory=N'Regular' AND ParentWorkItemId IS NULL AND MilestoneId IS NULL THEN 1 WHEN WorkType=N'Task' AND TaskCategory=N'Project' AND ParentWorkItemId IS NOT NULL THEN 1 WHEN WorkType=N'ServiceCall' AND TaskCategory=N'ServiceCall' AND ParentWorkItemId IS NULL AND MilestoneId IS NULL THEN 1 ELSE 0 END=0) THROW 51440,'Cannot enable WorkItems checks while invalid type/category rows remain.',1;
 IF EXISTS(SELECT 1 FROM dbo.WorkItems WHERE CASE WHEN IsArchived=1 THEN 1 WHEN WorkType<>N'Task' THEN 1 WHEN TaskCategory IS NULL THEN 0 WHEN TaskCategory<>N'Regular' THEN 1 WHEN ParentWorkItemId IS NULL AND MilestoneId IS NULL THEN 1 ELSE 0 END=0) THROW 51443,'Cannot enable WorkItems checks while invalid Regular-task rows remain.',1;
 IF EXISTS(SELECT 1 FROM dbo.WorkItems wi LEFT JOIN dbo.WorkItems p ON p.WorkItemId=wi.ParentWorkItemId WHERE wi.IsArchived=0 AND wi.TaskCategory=N'Project' AND (p.WorkItemId IS NULL OR p.WorkType<>N'Project' OR p.IsArchived=1)) THROW 51441,'Cannot enable checks while a Project task lacks an active project parent.',1;
 IF EXISTS(SELECT 1 FROM dbo.WorkItems wi JOIN dbo.ProjectMilestones pm ON pm.ProjectMilestoneId=wi.MilestoneId WHERE wi.ParentWorkItemId<>pm.ProjectId) THROW 51442,'Cannot enable checks while a milestone belongs to another project.',1;
 ALTER TABLE dbo.WorkItems WITH CHECK CHECK CONSTRAINT CK_WorkItems_TypeCategory;
 ALTER TABLE dbo.WorkItems WITH CHECK CHECK CONSTRAINT CK_WorkItems_RegularNoProject;
 ALTER TABLE dbo.WorkItems WITH CHECK CHECK CONSTRAINT CK_WorkItems_ArchiveMetadata;
END;
GO

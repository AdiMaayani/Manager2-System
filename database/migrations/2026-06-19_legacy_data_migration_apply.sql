/* OPERATOR-GATED. Edit flags only in an approved execution copy. Defaults perform no mutation. */
SET NOCOUNT ON; SET XACT_ABORT ON;
DECLARE @ApproveInternalContext BIT=0;
DECLARE @ApprovedInternalProjectId INT=NULL;
DECLARE @ApproveMilestoneMap BIT=0;

IF @ApproveInternalContext=1
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @InternalProjectId INT,@InternalCustomerId INT,@InternalSiteId INT,@MigrationBatchId UNIQUEIDENTIFIER=NEWID();
 IF @ApprovedInternalProjectId IS NULL THROW 51399,'Approved INTERNAL project id is required.',1;
 IF (SELECT COUNT(*) FROM dbo.WorkItems WHERE WorkType=N'Project' AND FinanceProjectNumber=N'INTERNAL' AND IsArchived=0)<>1
  THROW 51400,'Expected exactly one active INTERNAL project container.',1;
 SELECT @InternalProjectId=WorkItemId,@InternalCustomerId=CustomerId,@InternalSiteId=SiteId FROM dbo.WorkItems WHERE WorkType=N'Project' AND FinanceProjectNumber=N'INTERNAL' AND IsArchived=0;
 IF @InternalProjectId<>@ApprovedInternalProjectId THROW 51398,'Approved INTERNAL project id does not match the reserved container.',1;
 IF @InternalCustomerId IS NULL OR NOT EXISTS(SELECT 1 FROM dbo.Customers WHERE CustomerId=@InternalCustomerId AND CustomerType=N'Internal')
  THROW 51397,'INTERNAL container customer is missing or is not the reserved Internal customer.',1;
 IF @InternalSiteId IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dbo.Sites WHERE SiteId=@InternalSiteId AND CustomerId=@InternalCustomerId)
  THROW 51396,'INTERNAL container site does not belong to the reserved Internal customer.',1;
 IF EXISTS(SELECT 1 FROM dbo.WorkItems WHERE ParentWorkItemId=@InternalProjectId AND WorkType<>N'Task')
  THROW 51402,'INTERNAL container has non-task children; manual review required.',1;
 INSERT dbo._InternalContextMigrationAudit(WorkItemId,MigrationBatchId,InternalProjectId,OldParentWorkItemId,OldCustomerId,OldSiteId,OldTaskCategory,OldMilestoneId,OldIsArchived,OldArchivedAt,MigratedParentWorkItemId,MigratedCustomerId,MigratedSiteId,MigratedTaskCategory,MigratedMilestoneId)
 SELECT WorkItemId,@MigrationBatchId,@InternalProjectId,ParentWorkItemId,CustomerId,SiteId,TaskCategory,MilestoneId,IsArchived,ArchivedAt,
  NULL,CASE WHEN CustomerId=@InternalCustomerId THEN NULL ELSE CustomerId END,
  CASE WHEN SiteId=@InternalSiteId THEN NULL ELSE SiteId END,N'Regular',NULL
 FROM dbo.WorkItems
 WHERE ParentWorkItemId=@InternalProjectId AND NOT EXISTS(SELECT 1 FROM dbo._InternalContextMigrationAudit a WHERE a.WorkItemId=dbo.WorkItems.WorkItemId);
 UPDATE dbo.WorkItems SET ParentWorkItemId=NULL,TaskCategory=N'Regular',MilestoneId=NULL,
  CustomerId=CASE WHEN CustomerId=@InternalCustomerId THEN NULL ELSE CustomerId END,
  SiteId=CASE WHEN SiteId=@InternalSiteId THEN NULL ELSE SiteId END
 WHERE ParentWorkItemId=@InternalProjectId;
 IF EXISTS(SELECT 1 FROM dbo.WorkItems WHERE ParentWorkItemId=@InternalProjectId) THROW 51401,'INTERNAL children remain after conversion.',1;
 IF EXISTS(SELECT 1 FROM dbo._InternalContextMigrationAudit a JOIN dbo.WorkItems w ON w.WorkItemId=a.WorkItemId
  WHERE a.MigrationBatchId=@MigrationBatchId AND (ISNULL(w.ParentWorkItemId,-1)<>ISNULL(a.MigratedParentWorkItemId,-1)
   OR ISNULL(w.CustomerId,-1)<>ISNULL(a.MigratedCustomerId,-1) OR ISNULL(w.SiteId,-1)<>ISNULL(a.MigratedSiteId,-1)
   OR w.TaskCategory<>a.MigratedTaskCategory OR ISNULL(w.MilestoneId,-1)<>ISNULL(a.MigratedMilestoneId,-1)))
  THROW 51395,'INTERNAL child verification failed; no container was archived.',1;
 DECLARE @ContainerArchivedAt DATETIME2(7)=SYSUTCDATETIME();
 INSERT dbo._InternalContextContainerAudit(InternalProjectId,MigrationBatchId,OldIsArchived,OldArchivedAt,MigratedArchivedAt)
 SELECT WorkItemId,@MigrationBatchId,IsArchived,ArchivedAt,@ContainerArchivedAt FROM dbo.WorkItems
 WHERE WorkItemId=@ApprovedInternalProjectId AND NOT EXISTS(SELECT 1 FROM dbo._InternalContextContainerAudit a WHERE a.InternalProjectId=@ApprovedInternalProjectId);
 UPDATE dbo.WorkItems SET IsArchived=1,ArchivedAt=@ContainerArchivedAt WHERE WorkItemId=@ApprovedInternalProjectId AND WorkType=N'Project' AND FinanceProjectNumber=N'INTERNAL' AND IsArchived=0;
 IF @@ROWCOUNT<>1 THROW 51394,'Confirmed INTERNAL container archive failed.',1;
 COMMIT;
END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;

IF @ApproveMilestoneMap=1
BEGIN TRY
 BEGIN TRANSACTION;
 IF NOT EXISTS(SELECT 1 FROM dbo._MilestoneMigrationMap) THROW 51410,'Milestone map is empty; diagnostics only.',1;
 IF EXISTS(SELECT 1 FROM dbo._MilestoneMigrationMap WHERE ApprovedBy IS NULL OR ApprovedAt IS NULL) THROW 51411,'Every milestone map row requires approval metadata.',1;
 IF EXISTS(SELECT 1 FROM dbo._MilestoneMigrationMap m LEFT JOIN dbo.WorkItems wi ON wi.WorkItemId=m.WorkItemId LEFT JOIN dbo.WorkItems p ON p.WorkItemId=m.ProjectId
  WHERE wi.WorkItemId IS NULL OR wi.WorkType<>N'Task' OR wi.ParentWorkItemId<>m.ProjectId OR wi.IsArchived=1 OR p.WorkType<>N'Project' OR p.IsArchived=1)
  THROW 51412,'Unsafe milestone map row found.',1;
 IF EXISTS(SELECT 1 FROM dbo._MilestoneMigrationMap m JOIN dbo.WorkItems wi ON wi.WorkItemId=m.WorkItemId
  WHERE (wi.PlannedStart IS NULL AND wi.PlannedEnd IS NOT NULL) OR (wi.PlannedStart IS NOT NULL AND wi.PlannedEnd IS NULL)
     OR wi.PlannedEnd<=wi.PlannedStart OR (wi.ActualStart IS NULL AND wi.ActualEnd IS NOT NULL)
     OR (wi.ActualStart IS NOT NULL AND wi.ActualEnd IS NULL) OR wi.ActualEnd<=wi.ActualStart)
  THROW 51415,'Mapped milestone has an incomplete or non-increasing date range.',1;
 UPDATE m SET OriginalIsArchived=wi.IsArchived,OriginalArchivedAt=wi.ArchivedAt
 FROM dbo._MilestoneMigrationMap m JOIN dbo.WorkItems wi ON wi.WorkItemId=m.WorkItemId
 WHERE m.OriginalIsArchived IS NULL;
 INSERT dbo.ProjectMilestones(ProjectId,Title,Description,SortOrder,Status,PlannedStart,PlannedEnd,ActualStart,ActualEnd,ProgressPercent,IsActive,LegacyWorkItemId)
 SELECT m.ProjectId,wi.Title,wi.Description,ROW_NUMBER() OVER(PARTITION BY m.ProjectId ORDER BY wi.PlannedStart,wi.WorkItemId),wi.Status,
  wi.PlannedStart,wi.PlannedEnd,wi.ActualStart,wi.ActualEnd,CASE WHEN wi.Status=N'Closed' THEN 100 ELSE 0 END,1,wi.WorkItemId
 FROM dbo._MilestoneMigrationMap m JOIN dbo.WorkItems wi ON wi.WorkItemId=m.WorkItemId
 WHERE NOT EXISTS(SELECT 1 FROM dbo.ProjectMilestones pm WHERE pm.LegacyWorkItemId=m.WorkItemId);
 UPDATE m SET MigratedProjectMilestoneId=pm.ProjectMilestoneId,MigratedAt=SYSUTCDATETIME()
 FROM dbo._MilestoneMigrationMap m JOIN dbo.ProjectMilestones pm ON pm.LegacyWorkItemId=m.WorkItemId;
 INSERT dbo._MilestoneAssignmentAudit(LegacyWorkItemId,ProjectMilestoneId,AssignmentType,SourceAssignmentId,EmployeeId,AssignmentRole,AssignedHours)
 SELECT m.WorkItemId,pm.ProjectMilestoneId,N'Employee',a.WorkEmployeeAssignmentId,a.EmployeeId,a.AssignmentRole,a.AssignedHours
 FROM dbo._MilestoneMigrationMap m JOIN dbo.ProjectMilestones pm ON pm.LegacyWorkItemId=m.WorkItemId JOIN dbo.WorkEmployeeAssignments a ON a.WorkItemId=m.WorkItemId
 WHERE NOT EXISTS(SELECT 1 FROM dbo._MilestoneAssignmentAudit x WHERE x.AssignmentType=N'Employee' AND x.SourceAssignmentId=a.WorkEmployeeAssignmentId);
 INSERT dbo._MilestoneAssignmentAudit(LegacyWorkItemId,ProjectMilestoneId,AssignmentType,SourceAssignmentId,ContractorId,AssignmentRole)
 SELECT m.WorkItemId,pm.ProjectMilestoneId,N'Contractor',a.WorkContractorAssignmentId,a.ContractorId,a.AssignmentRole
 FROM dbo._MilestoneMigrationMap m JOIN dbo.ProjectMilestones pm ON pm.LegacyWorkItemId=m.WorkItemId JOIN dbo.WorkContractorAssignments a ON a.WorkItemId=m.WorkItemId
 WHERE NOT EXISTS(SELECT 1 FROM dbo._MilestoneAssignmentAudit x WHERE x.AssignmentType=N'Contractor' AND x.SourceAssignmentId=a.WorkContractorAssignmentId);
 IF EXISTS(SELECT 1 FROM dbo._MilestoneMigrationMap m JOIN dbo.WorkEmployeeAssignments a ON a.WorkItemId=m.WorkItemId
  WHERE NOT EXISTS(SELECT 1 FROM dbo._MilestoneAssignmentAudit x WHERE x.AssignmentType=N'Employee' AND x.SourceAssignmentId=a.WorkEmployeeAssignmentId))
  OR EXISTS(SELECT 1 FROM dbo._MilestoneMigrationMap m JOIN dbo.WorkContractorAssignments a ON a.WorkItemId=m.WorkItemId
  WHERE NOT EXISTS(SELECT 1 FROM dbo._MilestoneAssignmentAudit x WHERE x.AssignmentType=N'Contractor' AND x.SourceAssignmentId=a.WorkContractorAssignmentId))
  THROW 51414,'Milestone assignment audit parity failed.',1;
 UPDATE wi SET IsArchived=1,ArchivedAt=SYSUTCDATETIME() FROM dbo.WorkItems wi JOIN dbo._MilestoneMigrationMap m ON m.WorkItemId=wi.WorkItemId;
 IF EXISTS(SELECT 1 FROM dbo._MilestoneMigrationMap m LEFT JOIN dbo.ProjectMilestones pm ON pm.LegacyWorkItemId=m.WorkItemId WHERE pm.ProjectMilestoneId IS NULL) THROW 51413,'Milestone copy verification failed.',1;
 COMMIT;
END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
GO

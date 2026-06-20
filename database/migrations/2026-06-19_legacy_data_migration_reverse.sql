/* OPERATOR-GATED reverse. Refuses to remove milestones referenced by new tasks. */
SET NOCOUNT ON; SET XACT_ABORT ON;
DECLARE @ApproveReverseInternal BIT=0,@ApproveReverseMilestones BIT=0;
DECLARE @ApprovedInternalProjectId INT=NULL;
BEGIN TRY BEGIN TRANSACTION;
 IF @ApproveReverseMilestones=1 BEGIN
  IF EXISTS(SELECT 1 FROM dbo.WorkItems wi JOIN dbo.ProjectMilestones pm ON pm.ProjectMilestoneId=wi.MilestoneId WHERE pm.LegacyWorkItemId IN(SELECT WorkItemId FROM dbo._MilestoneMigrationMap)) THROW 51420,'Cannot reverse: migrated milestone is referenced by a task.',1;
  IF EXISTS(SELECT 1 FROM dbo.WorkItems wi JOIN dbo._MilestoneMigrationMap m ON m.WorkItemId=wi.WorkItemId WHERE wi.IsArchived<>1)
   THROW 51421,'Cannot reverse: a mapped legacy row no longer has the migrated archived state.',1;
  DELETE pm FROM dbo.ProjectMilestones pm JOIN dbo._MilestoneMigrationMap m ON m.MigratedProjectMilestoneId=pm.ProjectMilestoneId AND m.WorkItemId=pm.LegacyWorkItemId;
  UPDATE wi SET IsArchived=m.OriginalIsArchived,ArchivedAt=m.OriginalArchivedAt
  FROM dbo.WorkItems wi JOIN dbo._MilestoneMigrationMap m ON m.WorkItemId=wi.WorkItemId
  WHERE wi.IsArchived=1 AND m.OriginalIsArchived IS NOT NULL;
 END;
 IF @ApproveReverseInternal=1 BEGIN
  IF @ApprovedInternalProjectId IS NULL THROW 51422,'Approved INTERNAL project id is required for reverse.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo._InternalContextContainerAudit WHERE InternalProjectId=@ApprovedInternalProjectId)
   THROW 51423,'No INTERNAL container audit exists for the approved project.',1;
  IF EXISTS(SELECT 1 FROM dbo._InternalContextMigrationAudit a JOIN dbo.WorkItems w ON w.WorkItemId=a.WorkItemId
   WHERE a.InternalProjectId=@ApprovedInternalProjectId AND (ISNULL(w.ParentWorkItemId,-1)<>ISNULL(a.MigratedParentWorkItemId,-1)
    OR ISNULL(w.CustomerId,-1)<>ISNULL(a.MigratedCustomerId,-1) OR ISNULL(w.SiteId,-1)<>ISNULL(a.MigratedSiteId,-1)
    OR w.TaskCategory<>a.MigratedTaskCategory OR ISNULL(w.MilestoneId,-1)<>ISNULL(a.MigratedMilestoneId,-1)
    OR w.IsArchived<>a.OldIsArchived OR ISNULL(CONVERT(NVARCHAR(33),w.ArchivedAt,126),N'')<>ISNULL(CONVERT(NVARCHAR(33),a.OldArchivedAt,126),N'')))
   THROW 51424,'Cannot reverse: an INTERNAL task changed after migration.',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.WorkItems p JOIN dbo._InternalContextContainerAudit a ON a.InternalProjectId=p.WorkItemId
   WHERE p.WorkItemId=@ApprovedInternalProjectId AND p.WorkType=N'Project' AND p.FinanceProjectNumber=N'INTERNAL'
    AND p.IsArchived=1 AND p.ArchivedAt=a.MigratedArchivedAt)
   THROW 51425,'Cannot reverse: confirmed INTERNAL container is not in the migrated archived state.',1;
  ALTER TABLE dbo.WorkItems NOCHECK CONSTRAINT CK_WorkItems_TypeCategory;
  ALTER TABLE dbo.WorkItems NOCHECK CONSTRAINT CK_WorkItems_RegularNoProject;
  UPDATE wi SET ParentWorkItemId=a.OldParentWorkItemId,CustomerId=a.OldCustomerId,SiteId=a.OldSiteId,TaskCategory=a.OldTaskCategory,IsArchived=a.OldIsArchived,ArchivedAt=a.OldArchivedAt
   ,MilestoneId=a.OldMilestoneId
  FROM dbo.WorkItems wi JOIN dbo._InternalContextMigrationAudit a ON a.WorkItemId=wi.WorkItemId
  WHERE a.InternalProjectId=@ApprovedInternalProjectId;
  UPDATE p SET IsArchived=a.OldIsArchived,ArchivedAt=a.OldArchivedAt
  FROM dbo.WorkItems p JOIN dbo._InternalContextContainerAudit a ON a.InternalProjectId=p.WorkItemId
  WHERE p.WorkItemId=@ApprovedInternalProjectId AND p.IsArchived=1 AND p.ArchivedAt=a.MigratedArchivedAt;
 END;
 COMMIT;
END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
GO

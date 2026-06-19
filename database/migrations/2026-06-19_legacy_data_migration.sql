/* READ-ONLY diagnostics. Control/audit tables are created by the foundation migration. */
SET NOCOUNT ON;
IF OBJECT_ID(N'dbo._MilestoneMigrationMap',N'U') IS NULL
 OR OBJECT_ID(N'dbo._MilestoneAssignmentAudit',N'U') IS NULL
 OR OBJECT_ID(N'dbo._InternalContextMigrationAudit',N'U') IS NULL
 OR OBJECT_ID(N'dbo._InternalContextContainerAudit',N'U') IS NULL
 THROW 51390,'Run the 2026-06-19 foundation migration before diagnostics.',1;

SELECT WorkItemId,Title,CustomerId,SiteId,FinanceProjectNumber,IsArchived
FROM dbo.WorkItems WHERE WorkType=N'Project' AND FinanceProjectNumber=N'INTERNAL';
SELECT p.WorkItemId AS InternalProjectId,c.WorkItemId,c.Title,c.WorkType,c.TaskCategory,c.CustomerId,c.SiteId,
 (SELECT COUNT(*) FROM dbo.WorkEmployeeAssignments a WHERE a.WorkItemId=c.WorkItemId) EmployeeAssignments,
 (SELECT COUNT(*) FROM dbo.WorkReports r WHERE r.WorkItemId=c.WorkItemId) Reports
FROM dbo.WorkItems p JOIN dbo.WorkItems c ON c.ParentWorkItemId=p.WorkItemId
WHERE p.WorkType=N'Project' AND p.FinanceProjectNumber=N'INTERNAL';

/* Reference scan: customer/site rows are never archived by this package. */
SELECT p.CustomerId,p.SiteId,
 (SELECT COUNT(*) FROM dbo.WorkItems w WHERE w.CustomerId=p.CustomerId AND w.WorkItemId<>p.WorkItemId) OtherCustomerWorkItems,
 (SELECT COUNT(*) FROM dbo.Sites s WHERE s.CustomerId=p.CustomerId) CustomerSites,
 (SELECT COUNT(*) FROM dbo.WorkItems w WHERE w.SiteId=p.SiteId AND w.WorkItemId<>p.WorkItemId) OtherSiteWorkItems,
 (SELECT COUNT(*) FROM dbo.Contacts c WHERE c.CustomerId=p.CustomerId) Contacts,
 (SELECT COUNT(*) FROM dbo.Quotes q WHERE q.CustomerId=p.CustomerId) Quotes,
 (SELECT COUNT(*) FROM dbo.CustomerSystems cs WHERE cs.CustomerId=p.CustomerId OR cs.SiteId=p.SiteId) CustomerSystems,
 (SELECT COUNT(*) FROM dbo.Rec_SiteAddressProfile x WHERE x.SiteId=p.SiteId) SiteAddressProfiles,
 (SELECT COUNT(*) FROM dbo.Rec_RouteEstimates x WHERE x.TargetSiteId=p.SiteId) RouteEstimates,
 (SELECT COUNT(*) FROM dbo.Rec_EmployeeLocationEvents x WHERE x.SiteId=p.SiteId) LocationEvents,
 (SELECT COUNT(*) FROM dbo.Rec_EmployeePlannedStops x WHERE x.SiteId=p.SiteId) PlannedStops
FROM dbo.WorkItems p WHERE p.WorkType=N'Project' AND p.FinanceProjectNumber=N'INTERNAL';

/* No heuristic milestone classification: this lists all eligible rows for human mapping. */
SELECT wi.WorkItemId,wi.ParentWorkItemId AS CandidateProjectId,wi.Title,wi.Status,wi.PlannedStart,wi.PlannedEnd,
 (SELECT COUNT(*) FROM dbo.WorkEmployeeAssignments a WHERE a.WorkItemId=wi.WorkItemId) EmployeeAssignments,
 (SELECT COUNT(*) FROM dbo.WorkContractorAssignments a WHERE a.WorkItemId=wi.WorkItemId) ContractorAssignments,
 (SELECT COUNT(*) FROM dbo.WorkReports r WHERE r.WorkItemId=wi.WorkItemId) Reports
FROM dbo.WorkItems wi JOIN dbo.WorkItems p ON p.WorkItemId=wi.ParentWorkItemId AND p.WorkType=N'Project'
WHERE wi.WorkType=N'Task' AND wi.IsArchived=0 ORDER BY wi.ParentWorkItemId,wi.WorkItemId;
SELECT * FROM dbo._MilestoneMigrationMap ORDER BY WorkItemId;
GO

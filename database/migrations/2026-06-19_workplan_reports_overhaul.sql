/*
    WorkPlan / reports database foundation (2026-06-19).

    Additive, guarded and rerunnable. This script does not migrate legacy milestones,
    archive the INTERNAL container, or shift planned datetimes. Those operations are
    isolated in operator-gated packages documented in database/RUNBOOK.md.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'dbo.WorkItems', N'U') IS NULL OR OBJECT_ID(N'dbo.WorkReports', N'U') IS NULL
    THROW 51000, 'Required baseline tables dbo.WorkItems/dbo.WorkReports are missing.', 1;
GO

/* Hard preflight: never stamp an unknown business workflow status with a guessed
   lifecycle default. This gate intentionally precedes every schema mutation. */
IF EXISTS (
    SELECT 1
    FROM dbo.WorkReports
    WHERE Status IS NULL
       OR Status NOT IN (N'טיוטה', N'הוגש', N'הועבר להנה״ח')
)
BEGIN
    SELECT Status, COUNT_BIG(*) AS [RowCount]
    FROM dbo.WorkReports
    WHERE Status IS NULL
       OR Status NOT IN (N'טיוטה', N'הוגש', N'הועבר להנה״ח')
    GROUP BY Status
    ORDER BY Status;

    THROW 51001, 'Unknown WorkReports.Status values found. Map them explicitly before this migration.', 1;
END;
GO

/* WorkItems foundation. */
IF COL_LENGTH(N'dbo.WorkItems', N'TaskCategory') IS NULL
    ALTER TABLE dbo.WorkItems ADD TaskCategory NVARCHAR(20) NULL;
IF COL_LENGTH(N'dbo.WorkItems', N'MilestoneId') IS NULL
    ALTER TABLE dbo.WorkItems ADD MilestoneId INT NULL;
IF COL_LENGTH(N'dbo.WorkItems', N'IsArchived') IS NULL
    ALTER TABLE dbo.WorkItems ADD IsArchived BIT NOT NULL
        CONSTRAINT DF_WorkItems_IsArchived DEFAULT (0) WITH VALUES;
IF COL_LENGTH(N'dbo.WorkItems', N'ArchivedAt') IS NULL
    ALTER TABLE dbo.WorkItems ADD ArchivedAt DATETIME2(7) NULL;
GO

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.WorkItems') AND name = N'CustomerId' AND is_nullable = 0
)
    ALTER TABLE dbo.WorkItems ALTER COLUMN CustomerId INT NULL;
GO

/* Only categories that are structurally unambiguous are backfilled here.
   Task rows beneath INTERNAL are deliberately deferred to the guarded legacy package. */
UPDATE dbo.WorkItems
SET TaskCategory = CASE
    WHEN WorkType = N'ServiceCall' THEN N'ServiceCall'
    WHEN WorkType = N'Task' AND ParentWorkItemId IS NULL THEN N'Regular'
    WHEN WorkType = N'Task' AND ParentWorkItemId IS NOT NULL
         AND EXISTS (
             SELECT 1 FROM dbo.WorkItems p
             WHERE p.WorkItemId = dbo.WorkItems.ParentWorkItemId
               AND p.WorkType = N'Project'
               AND ISNULL(p.FinanceProjectNumber,N'') <> N'INTERNAL'
         ) THEN N'Project'
    ELSE TaskCategory
END
WHERE TaskCategory IS NULL
  AND (WorkType = N'ServiceCall' OR WorkType = N'Task');
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_WorkItems_TypeCategory')
    ALTER TABLE dbo.WorkItems WITH NOCHECK ADD CONSTRAINT CK_WorkItems_TypeCategory CHECK (
        CASE
            WHEN IsArchived = 1 THEN 1
            WHEN WorkType = N'Project' AND TaskCategory IS NULL AND ParentWorkItemId IS NULL AND MilestoneId IS NULL THEN 1
            WHEN WorkType = N'Task' AND TaskCategory = N'Regular' AND ParentWorkItemId IS NULL AND MilestoneId IS NULL THEN 1
            WHEN WorkType = N'Task' AND TaskCategory = N'Project' AND ParentWorkItemId IS NOT NULL THEN 1
            WHEN WorkType = N'ServiceCall' AND TaskCategory = N'ServiceCall' AND ParentWorkItemId IS NULL AND MilestoneId IS NULL THEN 1
            ELSE 0
        END = 1
    );
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_WorkItems_RegularNoProject')
    ALTER TABLE dbo.WorkItems WITH NOCHECK ADD CONSTRAINT CK_WorkItems_RegularNoProject CHECK (
        CASE
            WHEN IsArchived = 1 THEN 1
            WHEN WorkType <> N'Task' THEN 1
            WHEN TaskCategory IS NULL THEN 0
            WHEN TaskCategory <> N'Regular' THEN 1
            WHEN ParentWorkItemId IS NULL AND MilestoneId IS NULL THEN 1
            ELSE 0
        END = 1
    );
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_WorkItems_ArchiveMetadata')
    ALTER TABLE dbo.WorkItems WITH NOCHECK ADD CONSTRAINT CK_WorkItems_ArchiveMetadata CHECK (
        IsArchived = 0 OR ArchivedAt IS NOT NULL
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.WorkItems') AND name=N'IX_WorkItems_TaskCategory')
    CREATE INDEX IX_WorkItems_TaskCategory ON dbo.WorkItems(TaskCategory) INCLUDE (WorkType, IsArchived);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.WorkItems') AND name=N'IX_WorkItems_MilestoneId')
    CREATE INDEX IX_WorkItems_MilestoneId ON dbo.WorkItems(MilestoneId) WHERE MilestoneId IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.WorkItems') AND name=N'IX_WorkItems_IsArchived')
    CREATE INDEX IX_WorkItems_IsArchived ON dbo.WorkItems(IsArchived, WorkType, TaskCategory);
GO

/* Dedicated non-schedulable milestones. */
IF OBJECT_ID(N'dbo.ProjectMilestones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProjectMilestones
    (
        ProjectMilestoneId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ProjectMilestones PRIMARY KEY,
        ProjectId INT NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        Description NVARCHAR(1000) NULL,
        SortOrder INT NOT NULL CONSTRAINT DF_ProjectMilestones_SortOrder DEFAULT (0),
        Status NVARCHAR(50) NOT NULL CONSTRAINT DF_ProjectMilestones_Status DEFAULT (N'Planned'),
        PlannedStart DATETIME2(7) NULL,
        PlannedEnd DATETIME2(7) NULL,
        ActualStart DATETIME2(7) NULL,
        ActualEnd DATETIME2(7) NULL,
        ProgressPercent DECIMAL(5,2) NOT NULL CONSTRAINT DF_ProjectMilestones_Progress DEFAULT (0),
        IsActive BIT NOT NULL CONSTRAINT DF_ProjectMilestones_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_ProjectMilestones_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        LegacyWorkItemId INT NULL,
        CONSTRAINT FK_ProjectMilestones_Project FOREIGN KEY(ProjectId) REFERENCES dbo.WorkItems(WorkItemId),
        CONSTRAINT FK_ProjectMilestones_LegacyWorkItem FOREIGN KEY(LegacyWorkItemId) REFERENCES dbo.WorkItems(WorkItemId),
        CONSTRAINT CK_ProjectMilestones_Title CHECK (LEN(LTRIM(RTRIM(Title))) > 0),
        CONSTRAINT CK_ProjectMilestones_Progress CHECK (ProgressPercent BETWEEN 0 AND 100),
        CONSTRAINT CK_ProjectMilestones_SortOrder CHECK (SortOrder >= 0),
        CONSTRAINT CK_ProjectMilestones_PlannedRange CHECK (
            (PlannedStart IS NULL AND PlannedEnd IS NULL) OR
            (PlannedStart IS NOT NULL AND PlannedEnd IS NOT NULL AND PlannedEnd > PlannedStart)
        ),
        CONSTRAINT CK_ProjectMilestones_ActualRange CHECK (
            (ActualStart IS NULL AND ActualEnd IS NULL) OR
            (ActualStart IS NOT NULL AND ActualEnd IS NOT NULL AND ActualEnd > ActualStart)
        )
    );
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.ProjectMilestones') AND name=N'IX_ProjectMilestones_Project_Sort')
    CREATE INDEX IX_ProjectMilestones_Project_Sort ON dbo.ProjectMilestones(ProjectId, IsActive, SortOrder, ProjectMilestoneId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.ProjectMilestones') AND name=N'UX_ProjectMilestones_LegacyWorkItemId')
    CREATE UNIQUE INDEX UX_ProjectMilestones_LegacyWorkItemId ON dbo.ProjectMilestones(LegacyWorkItemId) WHERE LegacyWorkItemId IS NOT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_WorkItems_Milestone')
    ALTER TABLE dbo.WorkItems WITH CHECK ADD CONSTRAINT FK_WorkItems_Milestone
        FOREIGN KEY(MilestoneId) REFERENCES dbo.ProjectMilestones(ProjectMilestoneId);
GO

/* Empty control/audit tables. The diagnostics script remains read-only. */
IF OBJECT_ID(N'dbo._MilestoneMigrationMap',N'U') IS NULL
BEGIN
    CREATE TABLE dbo._MilestoneMigrationMap
    (
        WorkItemId INT NOT NULL CONSTRAINT PK__MilestoneMigrationMap PRIMARY KEY,
        ProjectId INT NOT NULL,
        ApprovedBy NVARCHAR(200) NULL,
        ApprovedAt DATETIME2(7) NULL,
        OriginalIsArchived BIT NULL,
        OriginalArchivedAt DATETIME2(7) NULL,
        MigratedProjectMilestoneId INT NULL,
        MigratedAt DATETIME2(7) NULL
    );
END;
IF OBJECT_ID(N'dbo._MilestoneAssignmentAudit',N'U') IS NULL
BEGIN
    CREATE TABLE dbo._MilestoneAssignmentAudit
    (
        MilestoneAssignmentAuditId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK__MilestoneAssignmentAudit PRIMARY KEY,
        LegacyWorkItemId INT NOT NULL,
        ProjectMilestoneId INT NULL,
        AssignmentType NVARCHAR(20) NOT NULL,
        SourceAssignmentId INT NOT NULL,
        EmployeeId INT NULL,
        ContractorId INT NULL,
        AssignmentRole NVARCHAR(100) NULL,
        AssignedHours DECIMAL(5,2) NULL,
        RecordedAt DATETIME2(7) NOT NULL CONSTRAINT DF__MilestoneAssignmentAudit_RecordedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK__MilestoneAssignmentAudit_Type CHECK (AssignmentType IN (N'Employee',N'Contractor')),
        CONSTRAINT UQ__MilestoneAssignmentAudit_Source UNIQUE(AssignmentType,SourceAssignmentId)
    );
END;
IF OBJECT_ID(N'dbo._InternalContextMigrationAudit',N'U') IS NULL
BEGIN
    CREATE TABLE dbo._InternalContextMigrationAudit
    (
        WorkItemId INT NOT NULL CONSTRAINT PK__InternalContextMigrationAudit PRIMARY KEY,
        MigrationBatchId UNIQUEIDENTIFIER NOT NULL,
        InternalProjectId INT NOT NULL,
        OldParentWorkItemId INT NULL,
        OldCustomerId INT NULL,
        OldSiteId INT NULL,
        OldTaskCategory NVARCHAR(20) NULL,
        OldMilestoneId INT NULL,
        OldIsArchived BIT NOT NULL,
        OldArchivedAt DATETIME2(7) NULL,
        MigratedParentWorkItemId INT NULL,
        MigratedCustomerId INT NULL,
        MigratedSiteId INT NULL,
        MigratedTaskCategory NVARCHAR(20) NOT NULL,
        MigratedMilestoneId INT NULL,
        MigratedAt DATETIME2(7) NOT NULL CONSTRAINT DF__InternalContextMigrationAudit_MigratedAt DEFAULT SYSUTCDATETIME()
    );
END;
IF OBJECT_ID(N'dbo._InternalContextContainerAudit',N'U') IS NULL
BEGIN
    CREATE TABLE dbo._InternalContextContainerAudit
    (
        InternalProjectId INT NOT NULL CONSTRAINT PK__InternalContextContainerAudit PRIMARY KEY,
        MigrationBatchId UNIQUEIDENTIFIER NOT NULL,
        OldIsArchived BIT NOT NULL,
        OldArchivedAt DATETIME2(7) NULL,
        MigratedArchivedAt DATETIME2(7) NOT NULL,
        RecordedAt DATETIME2(7) NOT NULL CONSTRAINT DF__InternalContextContainerAudit_RecordedAt DEFAULT SYSUTCDATETIME()
    );
END;
GO

/* Independent report lifecycle; Status remains the existing Hebrew workflow status. */
IF COL_LENGTH(N'dbo.WorkReports', N'LifecycleStatus') IS NULL
    ALTER TABLE dbo.WorkReports ADD LifecycleStatus NVARCHAR(20) NOT NULL
        CONSTRAINT DF_WorkReports_LifecycleStatus DEFAULT (N'Draft') WITH VALUES;
IF COL_LENGTH(N'dbo.WorkReports', N'FinalizedAt') IS NULL ALTER TABLE dbo.WorkReports ADD FinalizedAt DATETIME2(7) NULL;
IF COL_LENGTH(N'dbo.WorkReports', N'FinalizedByUserId') IS NULL ALTER TABLE dbo.WorkReports ADD FinalizedByUserId INT NULL;
IF COL_LENGTH(N'dbo.WorkReports', N'ReversedAt') IS NULL ALTER TABLE dbo.WorkReports ADD ReversedAt DATETIME2(7) NULL;
IF COL_LENGTH(N'dbo.WorkReports', N'ReversedByUserId') IS NULL ALTER TABLE dbo.WorkReports ADD ReversedByUserId INT NULL;
IF COL_LENGTH(N'dbo.WorkReports', N'ReversalReason') IS NULL ALTER TABLE dbo.WorkReports ADD ReversalReason NVARCHAR(500) NULL;
IF COL_LENGTH(N'dbo.WorkReports', N'AmendsWorkReportId') IS NULL ALTER TABLE dbo.WorkReports ADD AmendsWorkReportId INT NULL;
IF COL_LENGTH(N'dbo.WorkReports', N'UpdatedAt') IS NULL ALTER TABLE dbo.WorkReports ADD UpdatedAt DATETIME2(7) NULL;
IF COL_LENGTH(N'dbo.WorkReports', N'UpdatedByUserId') IS NULL ALTER TABLE dbo.WorkReports ADD UpdatedByUserId INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name=N'CK_WorkReports_LifecycleStatus')
    ALTER TABLE dbo.WorkReports WITH NOCHECK ADD CONSTRAINT CK_WorkReports_LifecycleStatus
        CHECK (LifecycleStatus IN (N'Draft',N'Finalized',N'Reversed'));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name=N'CK_WorkReports_LifecycleMetadata')
    ALTER TABLE dbo.WorkReports WITH NOCHECK ADD CONSTRAINT CK_WorkReports_LifecycleMetadata CHECK (
        (LifecycleStatus IN (N'Draft',N'Finalized') AND ReversedAt IS NULL AND ReversedByUserId IS NULL AND ReversalReason IS NULL) OR
        (LifecycleStatus=N'Reversed' AND ReversedAt IS NOT NULL AND LEN(LTRIM(RTRIM(ReversalReason)))>0)
    );
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name=N'CK_WorkReports_NotSelfAmend')
    ALTER TABLE dbo.WorkReports WITH NOCHECK ADD CONSTRAINT CK_WorkReports_NotSelfAmend
        CHECK (AmendsWorkReportId IS NULL OR AmendsWorkReportId<>WorkReportId);
GO

IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE class=1 AND major_id=OBJECT_ID(N'dbo.WorkReports') AND minor_id=0 AND name=N'ManageR2LifecycleBackfillComplete')
BEGIN
    IF EXISTS (SELECT 1 FROM dbo.WorkReports WHERE Status IS NULL OR Status NOT IN (N'טיוטה', N'הוגש', N'הועבר להנה״ח'))
    BEGIN
        SELECT Status, COUNT_BIG(*) AS [RowCount] FROM dbo.WorkReports
        WHERE Status IS NULL OR Status NOT IN (N'טיוטה', N'הוגש', N'הועבר להנה״ח')
        GROUP BY Status ORDER BY Status;
        THROW 51001, 'Unknown WorkReports.Status values found. Map them explicitly before lifecycle backfill.', 1;
    END;
    UPDATE dbo.WorkReports SET LifecycleStatus=CASE WHEN Status=N'טיוטה' THEN N'Draft' ELSE N'Finalized' END;
    ALTER TABLE dbo.WorkReports WITH CHECK CHECK CONSTRAINT CK_WorkReports_LifecycleStatus;
    ALTER TABLE dbo.WorkReports WITH CHECK CHECK CONSTRAINT CK_WorkReports_LifecycleMetadata;
    ALTER TABLE dbo.WorkReports WITH CHECK CHECK CONSTRAINT CK_WorkReports_NotSelfAmend;
    EXEC sys.sp_addextendedproperty @name=N'ManageR2LifecycleBackfillComplete',@value=N'2026-06-19',@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'WorkReports';
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_WorkReports_FinalizedByUser')
    ALTER TABLE dbo.WorkReports ADD CONSTRAINT FK_WorkReports_FinalizedByUser FOREIGN KEY(FinalizedByUserId) REFERENCES dbo.Users(UserId);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_WorkReports_ReversedByUser')
    ALTER TABLE dbo.WorkReports ADD CONSTRAINT FK_WorkReports_ReversedByUser FOREIGN KEY(ReversedByUserId) REFERENCES dbo.Users(UserId);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_WorkReports_UpdatedByUser')
    ALTER TABLE dbo.WorkReports ADD CONSTRAINT FK_WorkReports_UpdatedByUser FOREIGN KEY(UpdatedByUserId) REFERENCES dbo.Users(UserId);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_WorkReports_AmendsWorkReport')
    ALTER TABLE dbo.WorkReports ADD CONSTRAINT FK_WorkReports_AmendsWorkReport FOREIGN KEY(AmendsWorkReportId) REFERENCES dbo.WorkReports(WorkReportId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.WorkReports') AND name=N'IX_WorkReports_LifecycleStatus')
    CREATE INDEX IX_WorkReports_LifecycleStatus ON dbo.WorkReports(LifecycleStatus, WorkReportId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.WorkReports') AND name=N'IX_WorkReports_AmendsWorkReportId')
    CREATE INDEX IX_WorkReports_AmendsWorkReportId ON dbo.WorkReports(AmendsWorkReportId) WHERE AmendsWorkReportId IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.WorkReports') AND name=N'IX_WorkReports_WorkItemId')
    CREATE INDEX IX_WorkReports_WorkItemId ON dbo.WorkReports(WorkItemId) WHERE WorkItemId IS NOT NULL;
GO

IF OBJECT_ID(N'dbo.WorkReportInventoryItems', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.WorkReportInventoryItems
    (
        WorkReportInventoryItemId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_WorkReportInventoryItems PRIMARY KEY,
        WorkReportId INT NOT NULL,
        InventoryItemId INT NOT NULL,
        Quantity DECIMAL(18,3) NOT NULL,
        UsageType NVARCHAR(20) NOT NULL,
        SkuSnapshot NVARCHAR(50) NOT NULL,
        ItemNameSnapshot NVARCHAR(200) NOT NULL,
        CreatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_WorkReportInventoryItems_CreatedAt DEFAULT SYSUTCDATETIME(),
        CreatedByUserId INT NULL,
        CONSTRAINT FK_WorkReportInventoryItems_Report FOREIGN KEY(WorkReportId) REFERENCES dbo.WorkReports(WorkReportId),
        CONSTRAINT FK_WorkReportInventoryItems_Item FOREIGN KEY(InventoryItemId) REFERENCES dbo.InventoryItems(InventoryItemId),
        CONSTRAINT FK_WorkReportInventoryItems_User FOREIGN KEY(CreatedByUserId) REFERENCES dbo.Users(UserId),
        CONSTRAINT CK_WorkReportInventoryItems_Quantity CHECK (Quantity > 0),
        CONSTRAINT CK_WorkReportInventoryItems_UsageType CHECK (UsageType IN (N'Sold',N'Installed',N'Used')),
        CONSTRAINT UQ_WorkReportInventoryItems_Report_Item_Usage UNIQUE(WorkReportId, InventoryItemId, UsageType)
    );
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.WorkReportInventoryItems') AND name=N'IX_WorkReportInventoryItems_Item')
    CREATE INDEX IX_WorkReportInventoryItems_Item ON dbo.WorkReportInventoryItems(InventoryItemId, WorkReportId);
GO

IF OBJECT_ID(N'dbo.WorkReportAttachments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.WorkReportAttachments
    (
        WorkReportAttachmentId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_WorkReportAttachments PRIMARY KEY,
        WorkReportId INT NOT NULL,
        MediaType NVARCHAR(20) NOT NULL,
        OriginalFileName NVARCHAR(255) NOT NULL,
        StoredFileName NVARCHAR(255) NOT NULL,
        FilePath NVARCHAR(500) NOT NULL,
        ContentType NVARCHAR(100) NOT NULL,
        FileSizeBytes BIGINT NOT NULL,
        UploadedAt DATETIME2(7) NOT NULL CONSTRAINT DF_WorkReportAttachments_UploadedAt DEFAULT SYSUTCDATETIME(),
        UploadedByUserId INT NULL,
        CONSTRAINT FK_WorkReportAttachments_Report FOREIGN KEY(WorkReportId) REFERENCES dbo.WorkReports(WorkReportId),
        CONSTRAINT FK_WorkReportAttachments_User FOREIGN KEY(UploadedByUserId) REFERENCES dbo.Users(UserId),
        CONSTRAINT CK_WorkReportAttachments_MediaType CHECK (MediaType IN (N'Image',N'Video')),
        CONSTRAINT CK_WorkReportAttachments_FileSize CHECK (FileSizeBytes > 0),
        CONSTRAINT UQ_WorkReportAttachments_StoredFileName UNIQUE(StoredFileName)
    );
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.WorkReportAttachments') AND name=N'IX_WorkReportAttachments_Report')
    CREATE INDEX IX_WorkReportAttachments_Report ON dbo.WorkReportAttachments(WorkReportId, UploadedAt, WorkReportAttachmentId);
GO

IF OBJECT_ID(N'dbo.InventoryStockMovements', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.InventoryStockMovements
    (
        InventoryStockMovementId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_InventoryStockMovements PRIMARY KEY,
        InventoryItemId INT NOT NULL,
        WorkReportInventoryItemId INT NULL,
        QuantityDelta DECIMAL(18,3) NOT NULL,
        MovementType NVARCHAR(30) NOT NULL,
        SourceType NVARCHAR(50) NULL,
        SourceId INT NULL,
        UsageType NVARCHAR(20) NULL,
        CreatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_InventoryStockMovements_CreatedAt DEFAULT SYSUTCDATETIME(),
        CreatedByUserId INT NULL,
        CONSTRAINT FK_InventoryStockMovements_Item FOREIGN KEY(InventoryItemId) REFERENCES dbo.InventoryItems(InventoryItemId),
        CONSTRAINT FK_InventoryStockMovements_ReportLine FOREIGN KEY(WorkReportInventoryItemId) REFERENCES dbo.WorkReportInventoryItems(WorkReportInventoryItemId),
        CONSTRAINT FK_InventoryStockMovements_User FOREIGN KEY(CreatedByUserId) REFERENCES dbo.Users(UserId),
        CONSTRAINT CK_InventoryStockMovements_NonZero CHECK (QuantityDelta <> 0),
        CONSTRAINT CK_InventoryStockMovements_Type CHECK (MovementType IN (N'ReportUsage',N'ReportReversal')),
        CONSTRAINT CK_InventoryStockMovements_Sign CHECK (
            (MovementType=N'ReportUsage' AND QuantityDelta < 0) OR
            (MovementType=N'ReportReversal' AND QuantityDelta > 0)
        ),
        CONSTRAINT CK_InventoryStockMovements_UsageType CHECK (UsageType IS NULL OR UsageType IN (N'Sold',N'Installed',N'Used'))
        ,CONSTRAINT CK_InventoryStockMovements_SourcePair CHECK ((SourceType IS NULL AND SourceId IS NULL) OR (SourceType IS NOT NULL AND SourceId IS NOT NULL))
        ,CONSTRAINT CK_InventoryStockMovements_ReportSource CHECK (SourceType IS NULL OR (SourceType=N'WorkReport' AND WorkReportInventoryItemId IS NOT NULL AND UsageType IS NOT NULL))
    );
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.InventoryStockMovements') AND name=N'UX_InventoryStockMovements_Line_Type')
    CREATE UNIQUE INDEX UX_InventoryStockMovements_Line_Type
        ON dbo.InventoryStockMovements(WorkReportInventoryItemId, MovementType)
        WHERE WorkReportInventoryItemId IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.InventoryStockMovements') AND name=N'IX_InventoryStockMovements_Source')
    CREATE INDEX IX_InventoryStockMovements_Source ON dbo.InventoryStockMovements(SourceType, SourceId, InventoryStockMovementId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.InventoryStockMovements') AND name=N'IX_InventoryStockMovements_Item')
    CREATE INDEX IX_InventoryStockMovements_Item ON dbo.InventoryStockMovements(InventoryItemId, InventoryStockMovementId);
GO

/* Required diagnostics. A non-zero count blocks CHECK enabling in the legacy package. */
SELECT WorkType, TaskCategory, ParentWorkItemId, MilestoneId, IsArchived, COUNT_BIG(*) AS [RowCount]
FROM dbo.WorkItems
WHERE CASE
    WHEN IsArchived = 1 THEN 1
    WHEN WorkType = N'Project' AND TaskCategory IS NULL AND ParentWorkItemId IS NULL AND MilestoneId IS NULL THEN 1
    WHEN WorkType = N'Task' AND TaskCategory = N'Regular' AND ParentWorkItemId IS NULL AND MilestoneId IS NULL THEN 1
    WHEN WorkType = N'Task' AND TaskCategory = N'Project' AND ParentWorkItemId IS NOT NULL THEN 1
    WHEN WorkType = N'ServiceCall' AND TaskCategory = N'ServiceCall' AND ParentWorkItemId IS NULL AND MilestoneId IS NULL THEN 1
    ELSE 0
END = 0
GROUP BY WorkType, TaskCategory, ParentWorkItemId, MilestoneId, IsArchived;

SELECT Status AS WorkflowStatus, LifecycleStatus, COUNT_BIG(*) AS [RowCount]
FROM dbo.WorkReports GROUP BY Status, LifecycleStatus ORDER BY Status, LifecycleStatus;

SELECT wi.WorkItemId,wi.ParentWorkItemId,p.WorkType AS ParentWorkType,p.IsArchived AS ParentIsArchived
FROM dbo.WorkItems wi LEFT JOIN dbo.WorkItems p ON p.WorkItemId=wi.ParentWorkItemId
WHERE wi.IsArchived=0 AND wi.TaskCategory=N'Project'
  AND (p.WorkItemId IS NULL OR p.WorkType<>N'Project' OR p.IsArchived=1);

SELECT wi.WorkItemId,wi.ParentWorkItemId,wi.MilestoneId,pm.ProjectId AS MilestoneProjectId
FROM dbo.WorkItems wi JOIN dbo.ProjectMilestones pm ON pm.ProjectMilestoneId=wi.MilestoneId
WHERE wi.ParentWorkItemId<>pm.ProjectId;
GO

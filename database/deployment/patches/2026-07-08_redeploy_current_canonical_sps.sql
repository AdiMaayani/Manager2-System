/*
================================================================================
ManageR2 — Redeploy canonical stored procedures (2026-07-08)
================================================================================

OPERATOR WARNINGS (read before executing):
  1. BACK UP the target database before applying this patch.
  2. Run the pre-check script first:
       database/deployment/patches/2026-07-08_precheck_redeploy_canonical_sps.sql
  3. Confirm DB_NAME() and @@SERVERNAME match the intended target.
  4. Use UTF-8-safe execution to preserve Hebrew literals:
       - SSMS: save script as UTF-8 with BOM or set correct file encoding before open
       - sqlcmd: sqlcmd -f 65001 -i 2026-07-08_redeploy_current_canonical_sps.sql
  5. This script contains CREATE OR ALTER PROCEDURE only — no schema/data changes.

-- USE [YourTargetDatabase];  -- uncomment and set before running

Procedures included (required):
  sp_ProjectBoq_Create, sp_ProjectBoq_Update, sp_ProjectBoq_GetByProject
  sp_ProjectEquipment_Create, sp_ProjectEquipment_Update, sp_ProjectEquipment_GetByProject
  sp_ProjectDrawings_Create, sp_ProjectDrawings_GetByProject
  sp_WorkItems_DeleteTask, sp_WorkReports_Update

Deferred (not included): sp_WorkItems_GetInternalContext — deprecated endpoint; optional only.

Repository commit reference: 3d3baa9 (canonical SP source of truth under database/SP/)
================================================================================
*/

-- =============================================================================
-- sp_ProjectBoq_Create
-- Source: database/SP/sp_ProjectBoq_Create.sql
-- =============================================================================

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectBoq_Create
    @ProjectId INT,
    @SystemName NVARCHAR(100) = NULL,
    @InventoryItemId INT = NULL,
    @ItemDescription NVARCHAR(300),
    @Quantity DECIMAL(18,3),
    @Unit NVARCHAR(20),
    @UnitPrice DECIMAL(18,2) = NULL,
    @SortOrder INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.WorkItems
        WHERE WorkItemId = @ProjectId
          AND WorkType = 'Project'
    )
    BEGIN
        THROW 51100, 'Project was not found.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@ItemDescription)), N'') IS NULL
    BEGIN
        THROW 51101, 'ItemDescription is required.', 1;
    END;

    IF @Quantity <= 0
    BEGIN
        THROW 51102, 'Quantity must be greater than zero.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@Unit)), N'') IS NULL
    BEGIN
        THROW 51103, 'Unit is required.', 1;
    END;

    IF @InventoryItemId IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM dbo.InventoryItems
           WHERE InventoryItemId = @InventoryItemId
             AND IsActive = 1
       )
    BEGIN
        THROW 51105, 'Inventory item was not found.', 1;
    END;

    IF @UnitPrice IS NOT NULL AND @UnitPrice < 0
    BEGIN
        THROW 51106, 'UnitPrice must be non-negative.', 1;
    END;

    IF @SortOrder IS NULL
    BEGIN
        SELECT @SortOrder = ISNULL(MAX(SortOrder), 0) + 1
        FROM dbo.ProjectBoqItems
        WHERE ProjectId = @ProjectId
          AND IsActive = 1;
    END;

    INSERT INTO dbo.ProjectBoqItems
    (
        ProjectId,
        SystemName,
        InventoryItemId,
        ItemDescription,
        Quantity,
        Unit,
        UnitPrice,
        SortOrder,
        CreatedAt
    )
    VALUES
    (
        @ProjectId,
        NULLIF(LTRIM(RTRIM(@SystemName)), N''),
        @InventoryItemId,
        LTRIM(RTRIM(@ItemDescription)),
        @Quantity,
        LTRIM(RTRIM(@Unit)),
        @UnitPrice,
        @SortOrder,
        SYSUTCDATETIME()
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS ProjectBoqItemId;
END
GO


-- =============================================================================
-- sp_ProjectBoq_Update
-- Source: database/SP/sp_ProjectBoq_Update.sql
-- =============================================================================

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectBoq_Update
    @ProjectBoqItemId INT,
    @ProjectId INT,
    @SystemName NVARCHAR(100) = NULL,
    @InventoryItemId INT = NULL,
    @ItemDescription NVARCHAR(300),
    @Quantity DECIMAL(18,3),
    @Unit NVARCHAR(20),
    @UnitPrice DECIMAL(18,2) = NULL,
    @SortOrder INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.WorkItems
        WHERE WorkItemId = @ProjectId
          AND WorkType = 'Project'
    )
    BEGIN
        THROW 51100, 'Project was not found.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@ItemDescription)), N'') IS NULL
    BEGIN
        THROW 51101, 'ItemDescription is required.', 1;
    END;

    IF @Quantity <= 0
    BEGIN
        THROW 51102, 'Quantity must be greater than zero.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@Unit)), N'') IS NULL
    BEGIN
        THROW 51103, 'Unit is required.', 1;
    END;

    IF @InventoryItemId IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM dbo.InventoryItems
           WHERE InventoryItemId = @InventoryItemId
             AND IsActive = 1
       )
    BEGIN
        THROW 51105, 'Inventory item was not found.', 1;
    END;

    IF @UnitPrice IS NOT NULL AND @UnitPrice < 0
    BEGIN
        THROW 51106, 'UnitPrice must be non-negative.', 1;
    END;

    UPDATE dbo.ProjectBoqItems
    SET
        SystemName = NULLIF(LTRIM(RTRIM(@SystemName)), N''),
        InventoryItemId = @InventoryItemId,
        ItemDescription = LTRIM(RTRIM(@ItemDescription)),
        Quantity = @Quantity,
        Unit = LTRIM(RTRIM(@Unit)),
        UnitPrice = @UnitPrice,
        SortOrder = @SortOrder,
        UpdatedAt = SYSUTCDATETIME()
    WHERE ProjectBoqItemId = @ProjectBoqItemId
      AND ProjectId = @ProjectId
      AND IsActive = 1;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO


-- =============================================================================
-- sp_ProjectBoq_GetByProject
-- Source: database/SP/sp_ProjectBoq_GetByProject.sql
-- =============================================================================

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectBoq_GetByProject
    @ProjectId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.WorkItems
        WHERE WorkItemId = @ProjectId
          AND WorkType = 'Project'
    )
    BEGIN
        THROW 51100, 'Project was not found.', 1;
    END;

    SELECT
        b.ProjectBoqItemId,
        b.ProjectId,
        b.SystemName,
        b.InventoryItemId,
        i.SkuCode AS InventorySkuCode,
        i.ItemName AS InventoryItemName,
        i.Category AS InventoryCategory,
        b.ItemDescription,
        b.Quantity,
        b.Unit,
        b.UnitPrice,
        b.SortOrder,
        b.CreatedAt,
        b.UpdatedAt
    FROM dbo.ProjectBoqItems b
    LEFT JOIN dbo.InventoryItems i
        ON b.InventoryItemId = i.InventoryItemId
    WHERE b.ProjectId = @ProjectId
      AND b.IsActive = 1
    ORDER BY b.SortOrder ASC, b.ProjectBoqItemId ASC;
END
GO


-- =============================================================================
-- sp_ProjectEquipment_Create
-- Source: database/SP/sp_ProjectEquipment_Create.sql
-- =============================================================================

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectEquipment_Create
    @ProjectId INT,
    @InventoryItemId INT = NULL,
    @EquipmentName NVARCHAR(200),
    @Status NVARCHAR(50),
    @Location NVARCHAR(200) = NULL,
    @SortOrder INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.WorkItems
        WHERE WorkItemId = @ProjectId
          AND WorkType = 'Project'
    )
    BEGIN
        THROW 51000, 'Project was not found.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@EquipmentName)), N'') IS NULL
    BEGIN
        THROW 51001, 'EquipmentName is required.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@Status)), N'') IS NULL
    BEGIN
        THROW 51002, 'Status is required.', 1;
    END;

    IF @InventoryItemId IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM dbo.InventoryItems
           WHERE InventoryItemId = @InventoryItemId
             AND IsActive = 1
       )
    BEGIN
        THROW 51003, 'Inventory item was not found.', 1;
    END;

    IF @SortOrder IS NULL
    BEGIN
        SELECT @SortOrder = ISNULL(MAX(SortOrder), 0) + 1
        FROM dbo.ProjectEquipmentItems
        WHERE ProjectId = @ProjectId;
    END;

    INSERT INTO dbo.ProjectEquipmentItems
    (
        ProjectId,
        InventoryItemId,
        EquipmentName,
        Status,
        Location,
        SortOrder,
        CreatedAt
    )
    VALUES
    (
        @ProjectId,
        @InventoryItemId,
        LTRIM(RTRIM(@EquipmentName)),
        LTRIM(RTRIM(@Status)),
        NULLIF(LTRIM(RTRIM(@Location)), N''),
        @SortOrder,
        SYSUTCDATETIME()
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS ProjectEquipmentItemId;
END
GO


-- =============================================================================
-- sp_ProjectEquipment_Update
-- Source: database/SP/sp_ProjectEquipment_Update.sql
-- =============================================================================

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectEquipment_Update
    @ProjectEquipmentItemId INT,
    @ProjectId INT,
    @InventoryItemId INT = NULL,
    @EquipmentName NVARCHAR(200),
    @Status NVARCHAR(50),
    @Location NVARCHAR(200) = NULL,
    @SortOrder INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.WorkItems
        WHERE WorkItemId = @ProjectId
          AND WorkType = 'Project'
    )
    BEGIN
        THROW 51000, 'Project was not found.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@EquipmentName)), N'') IS NULL
    BEGIN
        THROW 51001, 'EquipmentName is required.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@Status)), N'') IS NULL
    BEGIN
        THROW 51002, 'Status is required.', 1;
    END;

    IF @InventoryItemId IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM dbo.InventoryItems
           WHERE InventoryItemId = @InventoryItemId
             AND IsActive = 1
       )
    BEGIN
        THROW 51003, 'Inventory item was not found.', 1;
    END;

    UPDATE dbo.ProjectEquipmentItems
    SET
        InventoryItemId = @InventoryItemId,
        EquipmentName = LTRIM(RTRIM(@EquipmentName)),
        Status = LTRIM(RTRIM(@Status)),
        Location = NULLIF(LTRIM(RTRIM(@Location)), N''),
        SortOrder = @SortOrder,
        UpdatedAt = SYSUTCDATETIME()
    WHERE ProjectEquipmentItemId = @ProjectEquipmentItemId
      AND ProjectId = @ProjectId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO


-- =============================================================================
-- sp_ProjectEquipment_GetByProject
-- Source: database/SP/sp_ProjectEquipment_GetByProject.sql
-- =============================================================================

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectEquipment_GetByProject
    @ProjectId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.WorkItems
        WHERE WorkItemId = @ProjectId
          AND WorkType = 'Project'
    )
    BEGIN
        THROW 51000, 'Project was not found.', 1;
    END;

    SELECT
        e.ProjectEquipmentItemId,
        e.ProjectId,
        e.InventoryItemId,
        i.SkuCode AS InventorySkuCode,
        i.ItemName AS InventoryItemName,
        i.Category AS InventoryCategory,
        e.EquipmentName,
        e.Status,
        e.Location,
        e.SortOrder,
        e.CreatedAt,
        e.UpdatedAt
    FROM dbo.ProjectEquipmentItems e
    LEFT JOIN dbo.InventoryItems i
        ON e.InventoryItemId = i.InventoryItemId
    WHERE e.ProjectId = @ProjectId
    ORDER BY e.SortOrder ASC, e.ProjectEquipmentItemId ASC;
END
GO


-- =============================================================================
-- sp_ProjectDrawings_Create
-- Source: database/SP/sp_ProjectDrawings_Create.sql
-- =============================================================================

CREATE OR ALTER PROCEDURE dbo.sp_ProjectDrawings_Create
    @ProjectId INT,
    @Name NVARCHAR(200),
    @Type NVARCHAR(20),
    @DrawingDate DATE,
    @Note NVARCHAR(500) = NULL,
    @OriginalFileName NVARCHAR(260) = NULL,
    @StoredFileName NVARCHAR(260) = NULL,
    @FilePath NVARCHAR(500) = NULL,
    @ContentType NVARCHAR(120) = NULL,
    @FileSizeBytes BIGINT = NULL,
    @SortOrder INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.WorkItems
        WHERE WorkItemId = @ProjectId
          AND WorkType = 'Project'
    )
    BEGIN
        THROW 51000, 'Project was not found.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@Name)), N'') IS NULL
    BEGIN
        THROW 51001, 'Name is required.', 1;
    END;

    SET @Type = UPPER(LTRIM(RTRIM(@Type)));

    IF @Type NOT IN (N'PDF', N'DWG')
    BEGIN
        THROW 51002, 'Type must be PDF or DWG.', 1;
    END;

    IF @DrawingDate IS NULL
    BEGIN
        THROW 51003, 'DrawingDate is required.', 1;
    END;

    IF @SortOrder IS NULL
    BEGIN
        SELECT @SortOrder = ISNULL(MAX(SortOrder), 0) + 1
        FROM dbo.ProjectDrawings
        WHERE ProjectId = @ProjectId
          AND IsActive = 1;
    END;

    INSERT INTO dbo.ProjectDrawings
    (
        ProjectId,
        [Name],
        [Type],
        DrawingDate,
        Note,
        OriginalFileName,
        StoredFileName,
        FilePath,
        ContentType,
        FileSizeBytes,
        SortOrder,
        CreatedAt
    )
    VALUES
    (
        @ProjectId,
        LTRIM(RTRIM(@Name)),
        @Type,
        @DrawingDate,
        NULLIF(LTRIM(RTRIM(@Note)), N''),
        NULLIF(LTRIM(RTRIM(@OriginalFileName)), N''),
        NULLIF(LTRIM(RTRIM(@StoredFileName)), N''),
        NULLIF(LTRIM(RTRIM(@FilePath)), N''),
        NULLIF(LTRIM(RTRIM(@ContentType)), N''),
        @FileSizeBytes,
        @SortOrder,
        SYSUTCDATETIME()
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT);
END
GO


-- =============================================================================
-- sp_ProjectDrawings_GetByProject
-- Source: database/SP/sp_ProjectDrawings_GetByProject.sql
-- =============================================================================

CREATE OR ALTER PROCEDURE dbo.sp_ProjectDrawings_GetByProject
    @ProjectId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.WorkItems
        WHERE WorkItemId = @ProjectId
          AND WorkType = 'Project'
    )
    BEGIN
        THROW 51000, 'Project was not found.', 1;
    END;

    SELECT
        ProjectDrawingId,
        ProjectId,
        [Name],
        [Type],
        DrawingDate,
        Note,
        OriginalFileName,
        StoredFileName,
        FilePath,
        ContentType,
        FileSizeBytes,
        SortOrder,
        CreatedAt,
        UpdatedAt
    FROM dbo.ProjectDrawings
    WHERE ProjectId = @ProjectId
      AND IsActive = 1
    ORDER BY SortOrder ASC, ProjectDrawingId ASC;
END
GO


-- =============================================================================
-- sp_WorkItems_DeleteTask
-- Source: database/SP/sp_WorkItems_DeleteTask.sql
-- =============================================================================

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_WorkItems_DeleteTask]
    @WorkItemId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @WorkType NVARCHAR(50);
    DECLARE @IsLocked BIT;
    DECLARE @TaskCategory NVARCHAR(20);
    DECLARE @IsArchived BIT;
    DECLARE @RowsAffected INT = 0;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT
            @WorkType = WorkType,
            @IsLocked = IsLocked,
            @TaskCategory = TaskCategory,
            @IsArchived = IsArchived
        FROM dbo.WorkItems WITH (XLOCK, HOLDLOCK)
        WHERE WorkItemId = @WorkItemId;

        IF @WorkType IS NULL
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT
                CAST(1 AS INT) AS ResultCode,
                N'המשימה לא נמצאה.' AS [Message],
                CAST(0 AS INT) AS RowsAffected;
            RETURN;
        END;

        IF @WorkType = N'Project'
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT
                CAST(2 AS INT) AS ResultCode,
                N'לא ניתן למחוק פרויקט דרך פעולה זו.' AS [Message],
                CAST(0 AS INT) AS RowsAffected;
            RETURN;
        END;

        IF @WorkType <> N'Task'
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT
                CAST(3 AS INT) AS ResultCode,
                N'ניתן למחוק דרך פעולה זו רק משימות תוכנית עבודה.' AS [Message],
                CAST(0 AS INT) AS RowsAffected;
            RETURN;
        END;

        IF @IsArchived = 1 OR @TaskCategory NOT IN (N'Regular', N'Project')
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(8 AS INT) AS ResultCode,
                N'לא ניתן למחוק רשומת מורשת או משימה ללא קטגוריה תקינה.' AS [Message],
                CAST(0 AS INT) AS RowsAffected;
            RETURN;
        END;

        IF @IsLocked = 1
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT
                CAST(4 AS INT) AS ResultCode,
                N'משימה נעולה — לא ניתן למחוק.' AS [Message],
                CAST(0 AS INT) AS RowsAffected;
            RETURN;
        END;

        IF EXISTS (SELECT 1 FROM dbo.WorkItems WITH (UPDLOCK, HOLDLOCK) WHERE ParentWorkItemId = @WorkItemId)
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT
                CAST(5 AS INT) AS ResultCode,
                N'לא ניתן למחוק משימה הכוללת משימות משנה.' AS [Message],
                CAST(0 AS INT) AS RowsAffected;
            RETURN;
        END;

        IF EXISTS (SELECT 1 FROM dbo.WorkReports WITH (UPDLOCK, HOLDLOCK) WHERE WorkItemId = @WorkItemId)
           OR EXISTS (SELECT 1 FROM dbo.Rec_EmployeeLocationEvents WITH (UPDLOCK, HOLDLOCK) WHERE WorkItemId = @WorkItemId)
           OR EXISTS (SELECT 1 FROM dbo.Rec_EmployeePlannedStops WITH (UPDLOCK, HOLDLOCK) WHERE WorkItemId = @WorkItemId)
           OR EXISTS (SELECT 1 FROM dbo.Rec_RecommendationRuns WITH (UPDLOCK, HOLDLOCK) WHERE ProjectId = @WorkItemId)
           OR EXISTS (SELECT 1 FROM dbo.ProjectEquipmentItems WITH (UPDLOCK, HOLDLOCK) WHERE ProjectId = @WorkItemId)
           OR EXISTS (SELECT 1 FROM dbo.ProjectBoqItems WITH (UPDLOCK, HOLDLOCK) WHERE ProjectId = @WorkItemId)
           OR EXISTS (SELECT 1 FROM dbo.ProjectDrawings WITH (UPDLOCK, HOLDLOCK) WHERE ProjectId = @WorkItemId)
           OR EXISTS (SELECT 1 FROM dbo.Quotes WITH (UPDLOCK, HOLDLOCK) WHERE ProjectId = @WorkItemId)
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT
                CAST(6 AS INT) AS ResultCode,
                N'לא ניתן למחוק את המשימה משום שקיימים עבורה דיווחים או נתונים תפעוליים.' AS [Message],
                CAST(0 AS INT) AS RowsAffected;
            RETURN;
        END;

        IF EXISTS (
            SELECT 1
            FROM dbo.Rec_RecommendationRuns AS recommendationRuns WITH (UPDLOCK, HOLDLOCK)
            INNER JOIN dbo.Rec_TaskAssignmentRecommendations AS recommendations WITH (UPDLOCK, HOLDLOCK)
                ON recommendations.RecommendationRunId = recommendationRuns.RecommendationRunId
            WHERE recommendationRuns.TaskId = @WorkItemId
              AND recommendations.TaskId <> @WorkItemId
        )
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT
                CAST(7 AS INT) AS ResultCode,
                N'מחיקת המשימה נכשלה משום שנתוני ההמלצות אינם עקביים.' AS [Message],
                CAST(0 AS INT) AS RowsAffected;
            RETURN;
        END;

        DELETE FROM dbo.WorkEmployeeAssignments
        WHERE WorkItemId = @WorkItemId;

        DELETE FROM dbo.WorkContractorAssignments
        WHERE WorkItemId = @WorkItemId;

        DELETE FROM dbo.Rec_WorkItemRequiredSkills
        WHERE WorkItemId = @WorkItemId;

        DELETE FROM dbo.Rec_WorkItemAlgorithmProfile
        WHERE WorkItemId = @WorkItemId;

        DELETE FROM dbo.Rec_TaskAssignmentRecommendations
        WHERE TaskId = @WorkItemId;

        DELETE FROM dbo.Rec_RecommendationRuns
        WHERE TaskId = @WorkItemId;

        DELETE FROM dbo.WorkItems
        WHERE WorkItemId = @WorkItemId
          AND WorkType = N'Task';

        SET @RowsAffected = @@ROWCOUNT;

        IF @RowsAffected = 0
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT
                CAST(7 AS INT) AS ResultCode,
                N'מחיקת המשימה נכשלה. נסה שוב.' AS [Message],
                CAST(0 AS INT) AS RowsAffected;
            RETURN;
        END;

        COMMIT TRANSACTION;

        SELECT
            CAST(0 AS INT) AS ResultCode,
            N'המשימה נמחקה בהצלחה.' AS [Message],
            @RowsAffected AS RowsAffected;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
        BEGIN
            ROLLBACK TRANSACTION;
        END;

        SELECT
            CAST(7 AS INT) AS ResultCode,
            N'מחיקת המשימה נכשלה. נסה שוב.' AS [Message],
            CAST(0 AS INT) AS RowsAffected;
    END CATCH;
END
GO


-- =============================================================================
-- sp_WorkReports_Update
-- Source: database/SP/sp_WorkReports_Update.sql
-- =============================================================================

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_WorkReports_Update
    @WorkReportId INT,
    @WorkItemId INT = NULL,
    @ReportType NVARCHAR(50) = NULL,
    @ReportDate DATETIME = NULL,
    @ProjectName NVARCHAR(150) = NULL,
    @CustomerName NVARCHAR(150) = NULL,
    @Site NVARCHAR(200) = NULL,
    @StartTime NVARCHAR(10) = NULL,
    @EndTime NVARCHAR(10) = NULL,
    @Summary NVARCHAR(1000) = NULL,
    @Notes NVARCHAR(2000) = NULL,
    @ReporterEmployeeId INT = NULL,
    @ReporterName NVARCHAR(100) = NULL,
    @ReporterRole NVARCHAR(100) = NULL,
    @WorkersCount INT = NULL,
    @Status NVARCHAR(50) = N'טיוטה',
    @FollowUpRequired BIT = NULL,
    @FollowUpReason NVARCHAR(1000) = NULL,
    @UpdatedByUserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.WorkReports WHERE WorkReportId=@WorkReportId AND LifecycleStatus=N'Reversed')
        THROW 51360, 'Reversed reports are read-only.', 1;

    UPDATE dbo.WorkReports
    SET
        WorkItemId = @WorkItemId,
        ReportType = @ReportType,
        ReportDate = @ReportDate,
        ProjectName = @ProjectName,
        CustomerName = @CustomerName,
        Site = @Site,
        StartTime = @StartTime,
        EndTime = @EndTime,
        Summary = @Summary,
        Notes = @Notes,
        ReporterEmployeeId = @ReporterEmployeeId,
        ReporterName = @ReporterName,
        ReporterRole = @ReporterRole,
        WorkersCount = @WorkersCount,
        Status = @Status,
        FollowUpRequired = @FollowUpRequired,
        FollowUpReason = @FollowUpReason,
        UpdatedAt = SYSUTCDATETIME(),
        UpdatedByUserId = @UpdatedByUserId
    WHERE WorkReportId = @WorkReportId
      AND LifecycleStatus IN (N'Draft', N'Finalized');

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO



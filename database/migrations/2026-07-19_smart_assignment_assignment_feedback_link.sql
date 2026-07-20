/*
    Links an employee assignment to the exact Smart Assignment recommendation that produced it
    and promotes recommendation feedback from one row per user to one shared row per recommendation.

    Additive assignment change: existing rows are intentionally not backfilled or reclassified.
    Apply manually, then redeploy the canonical procedures that accompany this migration.
*/

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.WorkEmployeeAssignments', N'U') IS NULL
    THROW 54100, 'dbo.WorkEmployeeAssignments is required.', 1;

IF OBJECT_ID(N'dbo.Rec_TaskAssignmentRecommendations', N'U') IS NULL
    THROW 54101, 'dbo.Rec_TaskAssignmentRecommendations is required.', 1;

IF OBJECT_ID(N'dbo.Rec_RecommendationFeedback', N'U') IS NULL
    THROW 54102, 'dbo.Rec_RecommendationFeedback is required.', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH(N'dbo.WorkEmployeeAssignments', N'SmartAssignmentRecommendationId') IS NULL
    BEGIN
        ALTER TABLE dbo.WorkEmployeeAssignments
        ADD SmartAssignmentRecommendationId INT NULL;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.columns AS columnDefinition
        INNER JOIN sys.types AS typeDefinition
            ON typeDefinition.user_type_id = columnDefinition.user_type_id
        WHERE columnDefinition.object_id = OBJECT_ID(N'dbo.WorkEmployeeAssignments')
          AND columnDefinition.name = N'SmartAssignmentRecommendationId'
          AND typeDefinition.name = N'int'
          AND columnDefinition.is_nullable = 1
    )
    BEGIN
        THROW 54103, 'SmartAssignmentRecommendationId must be INT NULL.', 1;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.foreign_keys
        WHERE parent_object_id = OBJECT_ID(N'dbo.WorkEmployeeAssignments')
          AND name = N'FK_WorkEmployeeAssignments_SmartAssignmentRecommendation'
    )
    BEGIN
        /*
            Dynamic DDL is required because the nullable link column may have been added earlier in
            this same batch. SQL Server otherwise binds the later column reference before executing
            the ALTER TABLE ADD COLUMN statement.
        */
        EXEC sys.sp_executesql N'
            ALTER TABLE dbo.WorkEmployeeAssignments WITH CHECK
            ADD CONSTRAINT FK_WorkEmployeeAssignments_SmartAssignmentRecommendation
                FOREIGN KEY (SmartAssignmentRecommendationId)
                REFERENCES dbo.Rec_TaskAssignmentRecommendations (RecommendationId);';

        ALTER TABLE dbo.WorkEmployeeAssignments
        CHECK CONSTRAINT FK_WorkEmployeeAssignments_SmartAssignmentRecommendation;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WorkEmployeeAssignments')
          AND name = N'IX_WorkEmployeeAssignments_SmartAssignmentRecommendationId'
    )
    BEGIN
        EXEC sys.sp_executesql N'
            CREATE NONCLUSTERED INDEX IX_WorkEmployeeAssignments_SmartAssignmentRecommendationId
                ON dbo.WorkEmployeeAssignments (SmartAssignmentRecommendationId)
                INCLUDE (WorkItemId, EmployeeId, IsManualAssignment)
                WHERE SmartAssignmentRecommendationId IS NOT NULL;';
    END;

    IF EXISTS
    (
        SELECT feedback.RecommendationId
        FROM dbo.Rec_RecommendationFeedback AS feedback
        GROUP BY feedback.RecommendationId
        HAVING COUNT_BIG(*) > 1
    )
    BEGIN
        THROW 54104, 'Multiple feedback rows exist for one recommendation; resolve them before applying shared feedback uniqueness.', 1;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM sys.key_constraints
        WHERE parent_object_id = OBJECT_ID(N'dbo.Rec_RecommendationFeedback')
          AND name = N'UQ_Rec_RecommendationFeedback_Recommendation_User'
          AND type = N'UQ'
    )
    BEGIN
        ALTER TABLE dbo.Rec_RecommendationFeedback
        DROP CONSTRAINT UQ_Rec_RecommendationFeedback_Recommendation_User;
    END;
    ELSE IF EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.Rec_RecommendationFeedback')
          AND name = N'UQ_Rec_RecommendationFeedback_Recommendation_User'
    )
    BEGIN
        DROP INDEX UQ_Rec_RecommendationFeedback_Recommendation_User
            ON dbo.Rec_RecommendationFeedback;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.Rec_RecommendationFeedback')
          AND name = N'UQ_Rec_RecommendationFeedback_Recommendation'
          AND is_unique = 1
    )
    BEGIN
        CREATE UNIQUE NONCLUSTERED INDEX UQ_Rec_RecommendationFeedback_Recommendation
            ON dbo.Rec_RecommendationFeedback (RecommendationId);
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
GO

PRINT N'Smart Assignment assignment link and shared feedback migration completed.';
GO

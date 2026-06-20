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

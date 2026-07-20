SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_UpdateEmployeeWorkAssignment
    @WorkItemId INT,
    @WorkEmployeeAssignmentId INT,
    @EmployeeId INT,
    -- Optional. When supplied, the replacement is recorded as a Smart Assignment: the completed
    -- recommendation for this run + work item + replacement employee is resolved and stored, and
    -- IsManualAssignment is cleared. When NULL, the manual replacement behavior is preserved.
    @RecommendationRunId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ExistingEmployeeId INT;
    DECLARE @WorkItemIsArchived BIT;
    DECLARE @WorkItemIsLocked BIT;
    DECLARE @SmartAssignmentRecommendationId INT = NULL;
    DECLARE @IsManualAssignment BIT = 1;
    DECLARE @RowsAffected INT = 0;

    IF @WorkItemId IS NULL OR @WorkItemId < 1
       OR @WorkEmployeeAssignmentId IS NULL OR @WorkEmployeeAssignmentId < 1
       OR @EmployeeId IS NULL OR @EmployeeId < 1
        THROW 55000, 'Work item, assignment, and employee identifiers must be positive.', 1;

    IF @RecommendationRunId IS NOT NULL AND @RecommendationRunId < 1
        THROW 55009, 'RecommendationRunId must be positive when supplied.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT
            @WorkItemIsArchived = workItem.IsArchived,
            @WorkItemIsLocked = workItem.IsLocked
        FROM dbo.WorkItems AS workItem WITH (UPDLOCK, HOLDLOCK)
        WHERE workItem.WorkItemId = @WorkItemId;

        IF @WorkItemIsArchived IS NULL
        BEGIN
            THROW 55002, 'Work item was not found.', 1;
        END;

        IF @WorkItemIsArchived = 1
            THROW 55007, 'Archived work items cannot be reassigned.', 1;

        IF @WorkItemIsLocked = 1
            THROW 55008, 'Locked work items cannot be reassigned.', 1;

        SELECT
            @ExistingEmployeeId = assignment.EmployeeId
        FROM dbo.WorkEmployeeAssignments AS assignment WITH (UPDLOCK, HOLDLOCK)
        WHERE assignment.WorkEmployeeAssignmentId = @WorkEmployeeAssignmentId
          AND assignment.WorkItemId = @WorkItemId;

        IF @ExistingEmployeeId IS NULL
        BEGIN
            THROW 55003, 'Employee assignment was not found for this work item.', 1;
        END;

        IF @ExistingEmployeeId = @EmployeeId
        BEGIN
            THROW 55004, 'The replacement employee must differ from the currently assigned employee.', 1;
        END;

        IF NOT EXISTS
        (
            SELECT 1
            FROM dbo.Employees AS employee WITH (UPDLOCK, HOLDLOCK)
            WHERE employee.EmployeeId = @EmployeeId
              AND employee.IsActive = 1
        )
        BEGIN
            THROW 55005, 'The replacement employee must be active.', 1;
        END;

        IF EXISTS
        (
            SELECT 1
            FROM dbo.WorkEmployeeAssignments AS duplicateAssignment WITH (UPDLOCK, HOLDLOCK)
            WHERE duplicateAssignment.WorkItemId = @WorkItemId
              AND duplicateAssignment.EmployeeId = @EmployeeId
              AND duplicateAssignment.WorkEmployeeAssignmentId <> @WorkEmployeeAssignmentId
        )
        BEGIN
            THROW 55006, 'The replacement employee is already assigned to this work item.', 1;
        END;

        -- Smart replacement: resolve the exact recommendation using the same invariants as
        -- sp_AssignEmployeeToWork (matching run, work item, replacement employee, completed run).
        IF @RecommendationRunId IS NOT NULL
        BEGIN
            SELECT @SmartAssignmentRecommendationId = recommendation.RecommendationId
            FROM dbo.Rec_TaskAssignmentRecommendations AS recommendation
            INNER JOIN dbo.Rec_RecommendationRuns AS recommendationRun
                ON recommendationRun.RecommendationRunId = recommendation.RecommendationRunId
            WHERE recommendation.RecommendationRunId = @RecommendationRunId
              AND recommendation.TaskId = @WorkItemId
              AND recommendation.EmployeeId = @EmployeeId
              AND recommendationRun.RunStatus = N'Completed'
              AND (recommendationRun.TaskId IS NULL OR recommendationRun.TaskId = @WorkItemId);

            IF @SmartAssignmentRecommendationId IS NULL
                THROW 55010, 'The completed recommendation run does not contain this work item and replacement employee.', 1;

            SET @IsManualAssignment = 0;
        END;

        UPDATE dbo.WorkEmployeeAssignments
        SET
            EmployeeId = @EmployeeId,
            AssignedAt = SYSUTCDATETIME(),
            IsManualAssignment = @IsManualAssignment,
            SmartAssignmentRecommendationId = @SmartAssignmentRecommendationId
        WHERE WorkEmployeeAssignmentId = @WorkEmployeeAssignmentId
          AND WorkItemId = @WorkItemId;

        SET @RowsAffected = @@ROWCOUNT;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        THROW;
    END CATCH;

    SELECT @RowsAffected;
END
GO

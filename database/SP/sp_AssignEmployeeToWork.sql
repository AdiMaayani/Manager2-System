SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_AssignEmployeeToWork]
    @WorkItemId INT,
    @EmployeeId INT,
    @AssignmentRole NVARCHAR(100),
    @RecommendationRunId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @SmartAssignmentRecommendationId INT;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.WorkItems
        WHERE WorkItemId = @WorkItemId
    )
    BEGIN
        THROW 50001, 'Work item was not found.', 1;
    END

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.Employees
        WHERE EmployeeId = @EmployeeId
    )
    BEGIN
        THROW 50002, 'Employee was not found.', 1;
    END

    IF NULLIF(LTRIM(RTRIM(@AssignmentRole)), '') IS NULL
    BEGIN
        THROW 50003, 'Assignment role is required.', 1;
    END


    IF @RecommendationRunId IS NOT NULL
    BEGIN
        IF @RecommendationRunId < 1
        BEGIN
            THROW 50005, 'RecommendationRunId must be positive when supplied.', 1;
        END

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
        BEGIN
            THROW 50006, 'The completed recommendation run does not contain this task and employee.', 1;
        END
    END

    IF EXISTS (
        SELECT 1
        FROM dbo.WorkEmployeeAssignments
        WHERE WorkItemId = @WorkItemId
          AND EmployeeId = @EmployeeId
    )
    BEGIN
        THROW 50004, 'Employee is already assigned to this work item.', 1;
    END

    INSERT INTO dbo.WorkEmployeeAssignments
    (
        WorkItemId,
        EmployeeId,
        AssignmentRole,
        AssignedHours,
        IsManualAssignment,
        SmartAssignmentRecommendationId
    )
    VALUES
    (
        @WorkItemId,
        @EmployeeId,
        @AssignmentRole,
        NULL,
        CASE WHEN @SmartAssignmentRecommendationId IS NULL THEN 1 ELSE 0 END,
        @SmartAssignmentRecommendationId
    );

    SELECT @@ROWCOUNT;
END
GO

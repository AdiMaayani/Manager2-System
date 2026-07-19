SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.Rec_GetTaskAssignmentFeedbackState
    @WorkItemId INT,
    @AssignedEmployeeId INT,
    @ActingUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @WorkEmployeeAssignmentId INT;
    DECLARE @IsManualAssignment BIT;
    DECLARE @LinkedRecommendationId INT;
    DECLARE @ResolvedRecommendationId INT;

    IF @WorkItemId IS NULL OR @WorkItemId < 1
       OR @AssignedEmployeeId IS NULL OR @AssignedEmployeeId < 1
        THROW 54000, 'Work item and assigned employee identifiers must be positive.', 1;

    IF @ActingUserId IS NULL OR @ActingUserId < 1
        THROW 54003, 'ActingUserId must identify an active user.', 1;

    IF NOT EXISTS
    (
        SELECT 1
        FROM dbo.Users
        WHERE UserId = @ActingUserId
          AND IsActive = 1
    )
    BEGIN
        THROW 54003, 'ActingUserId must identify an active user.', 1;
    END;

    SELECT TOP (1)
        @WorkEmployeeAssignmentId = assignment.WorkEmployeeAssignmentId,
        @IsManualAssignment = assignment.IsManualAssignment,
        @LinkedRecommendationId = assignment.SmartAssignmentRecommendationId
    FROM dbo.WorkEmployeeAssignments AS assignment
    WHERE assignment.WorkItemId = @WorkItemId
      AND assignment.EmployeeId = @AssignedEmployeeId
    ORDER BY assignment.AssignedAt DESC, assignment.WorkEmployeeAssignmentId DESC;

    IF @WorkEmployeeAssignmentId IS NULL
        RETURN;

    IF @IsManualAssignment = 0 AND @LinkedRecommendationId IS NOT NULL
    BEGIN
        SET @ResolvedRecommendationId = @LinkedRecommendationId;
    END;

    SELECT
        assignment.WorkItemId,
        assignment.EmployeeId AS AssignedEmployeeId,
        employee.FullName AS AssignedEmployeeName,
        assignment.IsManualAssignment,
        CASE WHEN assignment.IsManualAssignment = 0
            THEN N'SmartAssignment'
            ELSE N'Manual'
        END AS AssignmentMethod,
        recommendation.RecommendationId,
        recommendation.RecommendationRunId,
        COALESCE(feedback.PolicyProfileKey, recommendation.PolicyProfileKey) AS PolicyProfileKey,
        COALESCE(feedback.PolicyVersionNumber, recommendation.PolicyVersionNumber) AS PolicyVersion,
        recommendation.RankOrder,
        recommendation.TotalScore AS Score,
        recommendation.PolicyDisplayName,
        recommendation.TravelMinutes,
        recommendation.DistanceKm,
        recommendation.ProfessionalScore,
        recommendation.AvailabilityScore,
        recommendation.WorkloadScore,
        recommendation.GeographicScore,
        recommendation.ExperienceScore,
        recommendation.ContinuityScore,
        recommendation.PolicySnapshotJson,
        CAST(feedback.RecommendationFeedbackId AS BIGINT) AS RecommendationFeedbackId,
        recommendation.TaskId AS FeedbackWorkItemId,
        recommendation.EmployeeId AS RecommendedEmployeeId,
        CAST(feedback.Rating AS INT) AS Rating,
        feedback.Comment,
        feedback.ActingUserId,
        feedback.CreatedAtUtc,
        feedback.UpdatedAtUtc,
        CAST(0 AS BIT) AS WasCreated,
        CAST(0 AS BIT) AS WasChanged
    FROM dbo.WorkEmployeeAssignments AS assignment
    INNER JOIN dbo.Employees AS employee
        ON employee.EmployeeId = assignment.EmployeeId
    LEFT JOIN dbo.Rec_TaskAssignmentRecommendations AS recommendation
        ON recommendation.RecommendationId = @ResolvedRecommendationId
    LEFT JOIN dbo.Rec_RecommendationFeedback AS feedback
        ON feedback.RecommendationId = recommendation.RecommendationId
    WHERE assignment.WorkEmployeeAssignmentId = @WorkEmployeeAssignmentId;
END
GO

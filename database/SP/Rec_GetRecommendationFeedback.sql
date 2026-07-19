SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.Rec_GetRecommendationFeedback
    @RecommendationRunId INT,
    @WorkItemId INT,
    @RecommendedEmployeeId INT,
    @PolicyProfileKey NVARCHAR(30),
    @PolicyVersion INT,
    @ActingUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NormalizedPolicyProfileKey NVARCHAR(30) = NULLIF(LTRIM(RTRIM(@PolicyProfileKey)), N'');
    DECLARE @RecommendationId INT;

    IF @RecommendationRunId IS NULL OR @RecommendationRunId < 1
       OR @WorkItemId IS NULL OR @WorkItemId < 1
       OR @RecommendedEmployeeId IS NULL OR @RecommendedEmployeeId < 1
        THROW 54000, 'Recommendation run, work item, and employee identifiers must be positive.', 1;

    IF @NormalizedPolicyProfileKey IS NULL OR @PolicyVersion IS NULL OR @PolicyVersion < 1
        THROW 54002, 'Policy profile key and positive policy version are required.', 1;

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

    SELECT @RecommendationId = recommendation.RecommendationId
    FROM dbo.Rec_TaskAssignmentRecommendations AS recommendation
    INNER JOIN dbo.Rec_RecommendationRuns AS recommendationRun
        ON recommendationRun.RecommendationRunId = recommendation.RecommendationRunId
    WHERE recommendation.RecommendationRunId = @RecommendationRunId
      AND recommendation.TaskId = @WorkItemId
      AND recommendation.EmployeeId = @RecommendedEmployeeId
      AND recommendation.PolicyProfileKey = @NormalizedPolicyProfileKey
      AND recommendation.PolicyVersionNumber = @PolicyVersion
      AND recommendationRun.RunStatus = N'Completed'
      AND (recommendationRun.TaskId IS NULL OR recommendationRun.TaskId = @WorkItemId);

    IF @RecommendationId IS NULL
    BEGIN
        THROW 54004, 'The persisted recommendation is not eligible for feedback or its metadata does not match.', 1;
    END;

    SELECT
        CAST(feedback.RecommendationFeedbackId AS BIGINT) AS RecommendationFeedbackId,
        recommendation.RecommendationRunId,
        recommendation.TaskId AS WorkItemId,
        recommendation.EmployeeId AS RecommendedEmployeeId,
        feedback.PolicyProfileKey,
        feedback.PolicyVersionNumber AS PolicyVersion,
        CAST(feedback.Rating AS INT) AS Rating,
        feedback.Comment,
        feedback.ActingUserId,
        feedback.CreatedAtUtc,
        feedback.UpdatedAtUtc,
        CAST(0 AS BIT) AS WasCreated,
        CAST(0 AS BIT) AS WasChanged
    FROM dbo.Rec_RecommendationFeedback AS feedback
    INNER JOIN dbo.Rec_TaskAssignmentRecommendations AS recommendation
        ON recommendation.RecommendationId = feedback.RecommendationId
    WHERE feedback.RecommendationId = @RecommendationId;
END
GO

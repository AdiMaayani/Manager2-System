SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.Rec_UpsertRecommendationFeedback
    @RecommendationRunId INT,
    @WorkItemId INT,
    @RecommendedEmployeeId INT,
    @PolicyProfileKey NVARCHAR(30),
    @PolicyVersion INT,
    @Rating TINYINT,
    @Comment NVARCHAR(1000) = NULL,
    @ActingUserId INT,
    @ClientIp NVARCHAR(64) = NULL,
    @UserAgent NVARCHAR(512) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @NormalizedPolicyProfileKey NVARCHAR(30) = NULLIF(LTRIM(RTRIM(@PolicyProfileKey)), N'');
    DECLARE @NormalizedComment NVARCHAR(1000) = NULLIF(LTRIM(RTRIM(@Comment)), N'');
    DECLARE @RecommendationId INT;
    DECLARE @PolicyDisplayName NVARCHAR(150);
    DECLARE @RecommendationFeedbackId INT;
    DECLARE @FeedbackOwnerUserId INT;
    DECLARE @ExistingRating TINYINT;
    DECLARE @ExistingComment NVARCHAR(1000);
    DECLARE @ExistingPolicyProfileKey NVARCHAR(30);
    DECLARE @ExistingPolicyVersion INT;
    DECLARE @CreatedAtUtc DATETIME2(0);
    DECLARE @UpdatedAtUtc DATETIME2(0);
    DECLARE @WasCreated BIT = 0;
    DECLARE @WasChanged BIT = 0;

    IF @RecommendationRunId IS NULL OR @RecommendationRunId < 1
       OR @WorkItemId IS NULL OR @WorkItemId < 1
       OR @RecommendedEmployeeId IS NULL OR @RecommendedEmployeeId < 1
        THROW 54000, 'Recommendation run, work item, and employee identifiers must be positive.', 1;

    IF @Rating IS NULL OR @Rating NOT BETWEEN 1 AND 10
        THROW 54001, 'Rating must be between 1 and 10.', 1;

    IF @NormalizedPolicyProfileKey IS NULL OR @PolicyVersion IS NULL OR @PolicyVersion < 1
        THROW 54002, 'Policy profile key and positive policy version are required.', 1;

    IF @ActingUserId IS NULL OR @ActingUserId < 1
        THROW 54003, 'ActingUserId must identify an active user.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS
        (
            SELECT 1
            FROM dbo.Users WITH (UPDLOCK, HOLDLOCK)
            WHERE UserId = @ActingUserId
              AND IsActive = 1
        )
        BEGIN
            THROW 54003, 'ActingUserId must identify an active user.', 1;
        END;

        SELECT
            @RecommendationId = recommendation.RecommendationId,
            @PolicyDisplayName = recommendation.PolicyDisplayName
        FROM dbo.Rec_TaskAssignmentRecommendations AS recommendation WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.Rec_RecommendationRuns AS recommendationRun WITH (UPDLOCK, HOLDLOCK)
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
            @RecommendationFeedbackId = feedback.RecommendationFeedbackId,
            @FeedbackOwnerUserId = feedback.ActingUserId,
            @ExistingRating = feedback.Rating,
            @ExistingComment = feedback.Comment,
            @ExistingPolicyProfileKey = feedback.PolicyProfileKey,
            @ExistingPolicyVersion = feedback.PolicyVersionNumber,
            @CreatedAtUtc = feedback.CreatedAtUtc,
            @UpdatedAtUtc = feedback.UpdatedAtUtc
        FROM dbo.Rec_RecommendationFeedback AS feedback WITH (UPDLOCK, HOLDLOCK)
        WHERE feedback.RecommendationId = @RecommendationId;

        IF @RecommendationFeedbackId IS NULL
        BEGIN
            SET @CreatedAtUtc = SYSUTCDATETIME();
            SET @UpdatedAtUtc = @CreatedAtUtc;

            INSERT INTO dbo.Rec_RecommendationFeedback
            (
                RecommendationId,
                ActingUserId,
                Rating,
                Comment,
                PolicyProfileKey,
                PolicyVersionNumber,
                PolicyDisplayName,
                CreatedAtUtc,
                UpdatedAtUtc
            )
            VALUES
            (
                @RecommendationId,
                @ActingUserId,
                @Rating,
                @NormalizedComment,
                @NormalizedPolicyProfileKey,
                @PolicyVersion,
                @PolicyDisplayName,
                @CreatedAtUtc,
                @UpdatedAtUtc
            );

            SET @RecommendationFeedbackId = CONVERT(INT, SCOPE_IDENTITY());
            SET @FeedbackOwnerUserId = @ActingUserId;
            SET @WasCreated = 1;
            SET @WasChanged = 1;
        END
        ELSE IF @ExistingRating <> @Rating
             OR NOT
             (
                 @ExistingComment = @NormalizedComment
                 OR (@ExistingComment IS NULL AND @NormalizedComment IS NULL)
             )
             OR @ExistingPolicyProfileKey <> @NormalizedPolicyProfileKey
             OR @ExistingPolicyVersion <> @PolicyVersion
        BEGIN
            SET @UpdatedAtUtc = SYSUTCDATETIME();

            UPDATE dbo.Rec_RecommendationFeedback
            SET
                Rating = @Rating,
                Comment = @NormalizedComment,
                PolicyProfileKey = @NormalizedPolicyProfileKey,
                PolicyVersionNumber = @PolicyVersion,
                PolicyDisplayName = @PolicyDisplayName,
                UpdatedAtUtc = @UpdatedAtUtc
            WHERE RecommendationFeedbackId = @RecommendationFeedbackId;

            SET @WasChanged = 1;
        END;

        IF @WasChanged = 1
        BEGIN
            DECLARE @EscapedPolicyProfileKey NVARCHAR(120) = REPLACE(
                REPLACE(@NormalizedPolicyProfileKey, N'\', N'\\'),
                N'"',
                N'\"');
            DECLARE @AuditMetadataJson NVARCHAR(MAX) =
                N'{"recommendationId":' + CONVERT(NVARCHAR(20), @RecommendationId)
                + N',"recommendationRunId":' + CONVERT(NVARCHAR(20), @RecommendationRunId)
                + N',"workItemId":' + CONVERT(NVARCHAR(20), @WorkItemId)
                + N',"recommendedEmployeeId":' + CONVERT(NVARCHAR(20), @RecommendedEmployeeId)
                + N',"policyProfileKey":"' + @EscapedPolicyProfileKey + N'"'
                + N',"policyVersion":' + CONVERT(NVARCHAR(20), @PolicyVersion)
                + N',"oldRating":' + COALESCE(CONVERT(NVARCHAR(3), @ExistingRating), N'null')
                + N',"newRating":' + CONVERT(NVARCHAR(3), @Rating)
                + N',"feedbackOwnerUserId":' + CONVERT(NVARCHAR(20), @FeedbackOwnerUserId)
                + N',"editedByUserId":' + CONVERT(NVARCHAR(20), @ActingUserId)
                + N'}';
            DECLARE @AuditResult TABLE (AuditLogId BIGINT NOT NULL);
            DECLARE @AuditAction NVARCHAR(100) = CASE WHEN @WasCreated = 1
                THEN N'RecommendationFeedbackCreated'
                ELSE N'RecommendationFeedbackUpdated'
            END;
            DECLARE @AuditSummary NVARCHAR(500) = CASE WHEN @WasCreated = 1
                THEN N'Recommendation feedback created.'
                ELSE N'Recommendation feedback updated.'
            END;

            INSERT INTO @AuditResult (AuditLogId)
            EXEC dbo.sp_AuditLog_Create
                @UserId = @ActingUserId,
                @Action = @AuditAction,
                @EntityType = N'RecommendationFeedback',
                @EntityId = @RecommendationFeedbackId,
                @Severity = N'Info',
                @Summary = @AuditSummary,
                @MetadataJson = @AuditMetadataJson,
                @ClientIp = @ClientIp,
                @UserAgent = @UserAgent;
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        THROW;
    END CATCH;

    SELECT
        CAST(@RecommendationFeedbackId AS BIGINT) AS RecommendationFeedbackId,
        @RecommendationRunId AS RecommendationRunId,
        @WorkItemId AS WorkItemId,
        @RecommendedEmployeeId AS RecommendedEmployeeId,
        @NormalizedPolicyProfileKey AS PolicyProfileKey,
        @PolicyVersion AS PolicyVersion,
        CAST(@Rating AS INT) AS Rating,
        @NormalizedComment AS Comment,
        @FeedbackOwnerUserId AS ActingUserId,
        @CreatedAtUtc AS CreatedAtUtc,
        @UpdatedAtUtc AS UpdatedAtUtc,
        @WasCreated AS WasCreated,
        @WasChanged AS WasChanged;
END
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[Rec_SaveTaskAssignmentRecommendation]
    @RecommendationRunId INT,
    @TaskId INT,
    @EmployeeId INT,
    @UrgencyClass NVARCHAR(20) = NULL,
    @OriginTypeUsed NVARCHAR(30) = NULL,
    @RankOrder INT,
    @TotalScore DECIMAL(10,2),
    @ProfessionalScore DECIMAL(10,2) = NULL,
    @AvailabilityScore DECIMAL(10,2) = NULL,
    @WorkloadScore DECIMAL(10,2) = NULL,
    @ExperienceScore DECIMAL(10,2) = NULL,
    @GeographicScore DECIMAL(10,2) = NULL,
    @ContinuityScore DECIMAL(10,2) = NULL,
    @DistanceKm DECIMAL(10,2) = NULL,
    @TravelMinutes INT = NULL,
    @MatchedSkillsCount INT = NULL,
    @MissingSkillsCount INT = NULL,
    @OpenAssignmentsCount INT = NULL,
    @CurrentWorkloadHours DECIMAL(10,2) = NULL,
    @ZoneMatch BIT = NULL,
    @WorkedWithCustomerBefore BIT = NULL,
    @WorkedAtSiteBefore BIT = NULL,
    @RecommendationSummary NVARCHAR(1000) = NULL,
    @WarningsJson NVARCHAR(MAX) = NULL,
    @PolicyProfileKey NVARCHAR(30) = NULL,
    @PolicyVersionNumber INT = NULL,
    @PolicyDisplayName NVARCHAR(150) = NULL,
    @PolicySnapshotJson NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @RunStatus NVARCHAR(30);
    DECLARE @RunTaskId INT;
    DECLARE @ExistingRecommendationId INT;

    IF @RecommendationRunId < 1 OR @TaskId < 1 OR @EmployeeId < 1
        THROW 53350, 'Recommendation run, task, and employee identifiers must be positive.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT
            @RunStatus = recommendationRun.RunStatus,
            @RunTaskId = recommendationRun.TaskId
        FROM dbo.Rec_RecommendationRuns AS recommendationRun WITH (UPDLOCK, HOLDLOCK)
        WHERE recommendationRun.RecommendationRunId = @RecommendationRunId;

        IF @RunStatus IS NULL
            THROW 53351, 'Recommendation run was not found.', 1;

        IF @RunStatus <> N'Partial'
            THROW 53352, 'Recommendations can only be saved while the run is in Partial status.', 1;

        IF @RunTaskId IS NOT NULL AND @RunTaskId <> @TaskId
            THROW 53353, 'Recommendation task does not match the task-scoped run.', 1;

        SELECT @ExistingRecommendationId = recommendation.RecommendationId
        FROM dbo.Rec_TaskAssignmentRecommendations AS recommendation WITH (UPDLOCK, HOLDLOCK)
        WHERE recommendation.RecommendationRunId = @RecommendationRunId
          AND recommendation.TaskId = @TaskId
          AND recommendation.EmployeeId = @EmployeeId;

        IF @ExistingRecommendationId IS NOT NULL
        BEGIN
            /* An exact replay is a successful no-op; a conflicting replay is rejected. */
            IF EXISTS
            (
                SELECT
                    @UrgencyClass,
                    @OriginTypeUsed,
                    @RankOrder,
                    @TotalScore,
                    @ProfessionalScore,
                    @AvailabilityScore,
                    @WorkloadScore,
                    @ExperienceScore,
                    @GeographicScore,
                    @ContinuityScore,
                    @DistanceKm,
                    @TravelMinutes,
                    @MatchedSkillsCount,
                    @MissingSkillsCount,
                    @OpenAssignmentsCount,
                    @CurrentWorkloadHours,
                    @ZoneMatch,
                    @WorkedWithCustomerBefore,
                    @WorkedAtSiteBefore,
                    @RecommendationSummary,
                    @WarningsJson,
                    @PolicyProfileKey,
                    @PolicyVersionNumber,
                    @PolicyDisplayName,
                    @PolicySnapshotJson

                EXCEPT

                SELECT
                    recommendation.UrgencyClass,
                    recommendation.OriginTypeUsed,
                    recommendation.RankOrder,
                    recommendation.TotalScore,
                    recommendation.ProfessionalScore,
                    recommendation.AvailabilityScore,
                    recommendation.WorkloadScore,
                    recommendation.ExperienceScore,
                    recommendation.GeographicScore,
                    recommendation.ContinuityScore,
                    recommendation.DistanceKm,
                    recommendation.TravelMinutes,
                    recommendation.MatchedSkillsCount,
                    recommendation.MissingSkillsCount,
                    recommendation.OpenAssignmentsCount,
                    recommendation.CurrentWorkloadHours,
                    recommendation.ZoneMatch,
                    recommendation.WorkedWithCustomerBefore,
                    recommendation.WorkedAtSiteBefore,
                    recommendation.RecommendationSummary,
                    recommendation.WarningsJson,
                    recommendation.PolicyProfileKey,
                    recommendation.PolicyVersionNumber,
                    recommendation.PolicyDisplayName,
                    recommendation.PolicySnapshotJson
                FROM dbo.Rec_TaskAssignmentRecommendations AS recommendation
                WHERE recommendation.RecommendationId = @ExistingRecommendationId
            )
            BEGIN
                THROW 53354, 'A different recommendation already exists for this run, task, and employee.', 1;
            END;
        END
        ELSE
        BEGIN
            INSERT INTO dbo.Rec_TaskAssignmentRecommendations
            (
                RecommendationRunId,
                TaskId,
                EmployeeId,
                UrgencyClass,
                OriginTypeUsed,
                RankOrder,
                TotalScore,
                ProfessionalScore,
                AvailabilityScore,
                WorkloadScore,
                ExperienceScore,
                GeographicScore,
                ContinuityScore,
                DistanceKm,
                TravelMinutes,
                MatchedSkillsCount,
                MissingSkillsCount,
                OpenAssignmentsCount,
                CurrentWorkloadHours,
                ZoneMatch,
                WorkedWithCustomerBefore,
                WorkedAtSiteBefore,
                RecommendationSummary,
                WarningsJson,
                PolicyProfileKey,
                PolicyVersionNumber,
                PolicyDisplayName,
                PolicySnapshotJson,
                CreatedAt
            )
            VALUES
            (
                @RecommendationRunId,
                @TaskId,
                @EmployeeId,
                @UrgencyClass,
                @OriginTypeUsed,
                @RankOrder,
                @TotalScore,
                @ProfessionalScore,
                @AvailabilityScore,
                @WorkloadScore,
                @ExperienceScore,
                @GeographicScore,
                @ContinuityScore,
                @DistanceKm,
                @TravelMinutes,
                @MatchedSkillsCount,
                @MissingSkillsCount,
                @OpenAssignmentsCount,
                @CurrentWorkloadHours,
                @ZoneMatch,
                @WorkedWithCustomerBefore,
                @WorkedAtSiteBefore,
                @RecommendationSummary,
                @WarningsJson,
                @PolicyProfileKey,
                @PolicyVersionNumber,
                @PolicyDisplayName,
                @PolicySnapshotJson,
                SYSUTCDATETIME()
            );
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        THROW;
    END CATCH;
END
GO

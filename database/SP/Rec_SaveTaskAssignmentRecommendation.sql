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
    @WarningsJson NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;

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
        SYSUTCDATETIME()
    );
END
GO

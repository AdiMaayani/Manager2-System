SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[Rec_GetLatestRecommendationsForTask]
    @TaskId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @LatestRunId INT;

    SELECT TOP 1
        @LatestRunId = rr.RecommendationRunId
    FROM dbo.Rec_RecommendationRuns rr
    WHERE rr.TaskId = @TaskId
      AND rr.ScopeType = N'Task'
      AND rr.RunStatus = N'Completed'
    ORDER BY rr.CreatedAt DESC;

    SELECT
        r.RecommendationId,
        r.RecommendationRunId,
        r.TaskId,
        wi.Title AS TaskTitle,
        r.EmployeeId,
        e.FullName,
        e.PrimaryRole,
        r.UrgencyClass,
        r.OriginTypeUsed,
        r.RankOrder,
        r.TotalScore,
        r.ProfessionalScore,
        r.AvailabilityScore,
        r.WorkloadScore,
        r.ExperienceScore,
        r.GeographicScore,
        r.ContinuityScore,
        r.DistanceKm,
        r.TravelMinutes,
        r.MatchedSkillsCount,
        r.MissingSkillsCount,
        r.OpenAssignmentsCount,
        r.CurrentWorkloadHours,
        r.ZoneMatch,
        r.WorkedWithCustomerBefore,
        r.WorkedAtSiteBefore,
        r.RecommendationSummary,
        r.WarningsJson,
        r.CreatedAt
    FROM dbo.Rec_TaskAssignmentRecommendations r
    INNER JOIN dbo.Employees e
        ON e.EmployeeId = r.EmployeeId
    INNER JOIN dbo.WorkItems wi
        ON wi.WorkItemId = r.TaskId
    WHERE r.RecommendationRunId = @LatestRunId
    ORDER BY r.RankOrder ASC;
END
GO

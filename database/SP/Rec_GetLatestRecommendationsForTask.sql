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
        @LatestRunId = r.RecommendationRunId
    FROM dbo.Rec_TaskAssignmentRecommendations r
    INNER JOIN dbo.Rec_RecommendationRuns rr
        ON rr.RecommendationRunId = r.RecommendationRunId
    WHERE r.TaskId = @TaskId
      AND rr.RunStatus = N'Completed'
    ORDER BY rr.CreatedAt DESC, r.RecommendationRunId DESC;

    SELECT
        r.RecommendationId,
        r.RecommendationRunId,
        r.TaskId,
        wi.Title AS TaskTitle,
        CASE WHEN EXISTS
        (
            SELECT 1 FROM dbo.WorkItemRequiredRoles AS requiredRole
            WHERE requiredRole.WorkItemId = r.TaskId
        ) THEN (
            SELECT requiredRole.RoleName AS [Role]
            FROM dbo.WorkItemRequiredRoles AS requiredRole
            WHERE requiredRole.WorkItemId = r.TaskId
            ORDER BY requiredRole.RoleName
            FOR XML PATH(''), ROOT('Roles'), TYPE
        ) ELSE CAST(NULL AS XML) END AS RequiredRolesXml,
        r.EmployeeId,
        e.FullName,
        e.PrimaryRole,
        CASE WHEN EXISTS
        (
            SELECT 1 FROM dbo.EmployeeProfessions AS profession
            WHERE profession.EmployeeId = r.EmployeeId
        ) THEN (
            SELECT profession.RoleName AS [Role]
            FROM dbo.EmployeeProfessions AS profession
            WHERE profession.EmployeeId = r.EmployeeId
            ORDER BY profession.RoleName
            FOR XML PATH(''), ROOT('Roles'), TYPE
        ) ELSE CAST(NULL AS XML) END AS ProfessionsXml,
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
        r.PolicyProfileKey,
        r.PolicyVersionNumber,
        r.PolicyDisplayName,
        r.PolicySnapshotJson,
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

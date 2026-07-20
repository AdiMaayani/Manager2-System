SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.Rec_GetSmartAssignmentPolicyProfiles
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        p.ProfileKey,
        p.TaskCategory,
        p.IsActive,
        v.VersionNumber,
        v.DisplayName,
        v.Description,
        v.ProfessionalFitWeight,
        v.AvailabilityWeight,
        v.WorkloadWeight,
        v.GeographyWeight,
        v.ExperienceWeight,
        v.MissingCriticalSkillRejects,
        v.ExactRequiredRoleMandatory,
        v.MissingAvailabilityMode,
        v.MissingAvailabilityScore,
        v.MissingRouteScore,
        v.MissingWorkloadScore,
        v.MissingExperienceScore,
        v.NoRequirementsProfessionalFitScore,
        v.UseContinuityAsTieBreak,
        v.EnableBatchSimulatedLoadBalancing,
        v.ChangeReason,
        v.CreatedAtUtc AS UpdatedAtUtc,
        v.CreatedByUserId AS UpdatedByUserId
    FROM dbo.Rec_SmartAssignmentPolicyProfiles AS p
    INNER JOIN dbo.Rec_SmartAssignmentPolicyVersions AS v
        ON v.PolicyProfileId = p.PolicyProfileId
       AND v.VersionNumber = p.ActiveVersionNumber
    ORDER BY
        CASE p.ProfileKey
            WHEN N'Default' THEN 0
            WHEN N'Regular' THEN 1
            WHEN N'Project' THEN 2
            WHEN N'ServiceCall' THEN 3
            ELSE 4
        END,
        p.ProfileKey;
END
GO

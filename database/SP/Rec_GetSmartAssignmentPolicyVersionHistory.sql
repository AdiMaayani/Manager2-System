SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.Rec_GetSmartAssignmentPolicyVersionHistory
    @ProfileKey NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NormalizedProfileKey NVARCHAR(30) = NULLIF(LTRIM(RTRIM(@ProfileKey)), N'');

    SELECT
        p.ProfileKey,
        p.TaskCategory,
        p.IsActive,
        CAST(CASE WHEN v.VersionNumber = p.ActiveVersionNumber THEN 1 ELSE 0 END AS BIT) AS IsCurrentVersion,
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
    WHERE p.ProfileKey = @NormalizedProfileKey
    ORDER BY v.VersionNumber DESC;
END
GO

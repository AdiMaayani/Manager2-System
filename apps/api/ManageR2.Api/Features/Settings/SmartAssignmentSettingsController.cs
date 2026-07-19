using ManageR2.Api.Authorization;
using ManageR2.Api.Features.Settings.DTOs;
using ManageR2.Domain.Features.SmartAssignment;
using ManageR2.Infrastructure.Features.SmartAssignment.Repositories;
using ManageR2.Infrastructure.Services.SmartAssignment;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Features.Settings;

[ApiController]
[Route("api/Settings/smart-assignment")]
[Authorize]
public sealed class SmartAssignmentSettingsController : ControllerBase
{
    private readonly ISmartAssignmentPolicyManagementService _service;

    public SmartAssignmentSettingsController(ISmartAssignmentPolicyManagementService service)
    {
        _service = service;
    }

    [HttpGet]
    [Authorize(Policy = Policies.CanViewSettings)]
    public async Task<ActionResult<IReadOnlyList<SmartAssignmentPolicyResponseDto>>> GetProfiles()
    {
        var profiles = await _service.GetProfilesAsync();
        return Ok(profiles.Select(MapProfile).ToList());
    }

    [HttpGet("{profileKey}/versions")]
    [Authorize(Policy = Policies.CanViewSettings)]
    public async Task<ActionResult<IReadOnlyList<SmartAssignmentPolicyVersionResponseDto>>> GetVersionHistory(
        string profileKey)
    {
        if (!TryParseProfileKey(profileKey, out var parsedKey))
        {
            return BadRequest(new { message = "ProfileKey is invalid." });
        }

        var versions = await _service.GetVersionHistoryAsync(parsedKey);
        return Ok(versions.Select(MapVersion).ToList());
    }

    [HttpPut("{profileKey}")]
    [Authorize(Policy = Policies.CanManageSettings)]
    public async Task<ActionResult<SmartAssignmentPolicyResponseDto>> Update(
        string profileKey,
        [FromBody] UpdateSmartAssignmentPolicyRequestDto request)
    {
        if (!TryParseProfileKey(profileKey, out var parsedKey))
        {
            return BadRequest(new { message = "ProfileKey is invalid." });
        }

        var policy = MapPolicy(parsedKey, request, request.ExpectedVersion);

        try
        {
            var saved = await _service.UpdateAsync(
                parsedKey,
                policy,
                request.IsActive,
                request.ExpectedVersion,
                request.ChangeReason,
                GetActor());
            return Ok(MapProfile(saved));
        }
        catch (SmartAssignmentPolicyConcurrencyException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("{profileKey}/reset")]
    [Authorize(Policy = Policies.CanManageSettings)]
    public async Task<ActionResult<SmartAssignmentPolicyResponseDto>> Reset(string profileKey)
    {
        if (!TryParseProfileKey(profileKey, out var parsedKey))
        {
            return BadRequest(new { message = "ProfileKey is invalid." });
        }

        try
        {
            var saved = await _service.ResetAsync(parsedKey, GetActor());
            return Ok(MapProfile(saved));
        }
        catch (SmartAssignmentPolicyConcurrencyException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("preview")]
    [Authorize(Policy = Policies.CanManageSettings)]
    public ActionResult<SmartAssignmentPolicyPreviewResponseDto> Preview(
        [FromBody] SmartAssignmentPolicyPreviewRequestDto request)
    {
        if (!TryParseProfileKey(request.Policy.ProfileKey, out var parsedKey))
        {
            return BadRequest(new { message = "ProfileKey is invalid." });
        }

        var policy = MapPolicy(parsedKey, request.Policy, version: 0);
        var result = _service.Preview(
            policy,
            new SmartAssignmentPolicyPreviewScores(
                request.SampleScores.ProfessionalFit,
                request.SampleScores.Availability,
                request.SampleScores.Workload,
                request.SampleScores.Geography,
                request.SampleScores.Experience));

        return Ok(new SmartAssignmentPolicyPreviewResponseDto
        {
            TotalScore = result.TotalScore,
            Contributions = result.Contributions.Select(contribution =>
                new SmartAssignmentPolicyPreviewContributionDto
                {
                    FactorCode = contribution.FactorCode,
                    Key = contribution.FactorCode,
                    Score = contribution.Score,
                    WeightPercent = contribution.WeightPercent,
                    WeightedContribution = contribution.WeightedContribution
                }).ToList()
        });
    }

    private SmartAssignmentPolicyActor GetActor()
    {
        var claim = User.FindFirst("userId")?.Value;
        if (!int.TryParse(claim, out var userId) || userId < 1)
        {
            throw new InvalidOperationException("The authenticated user token does not contain a valid userId.");
        }

        var userAgent = Request.Headers.UserAgent.ToString();
        return new SmartAssignmentPolicyActor(
            userId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            string.IsNullOrWhiteSpace(userAgent) ? null : userAgent);
    }

    private static SmartAssignmentPolicyResponseDto MapProfile(SmartAssignmentPolicyProfileRecord record)
    {
        var dto = MapPolicyResponse(record.Policy);
        dto.IsActive = record.IsActive;
        dto.ChangeReason = record.ChangeReason;
        return dto;
    }

    private static SmartAssignmentPolicyVersionResponseDto MapVersion(
        SmartAssignmentPolicyVersionRecord record)
    {
        var policy = record.Policy;
        return new SmartAssignmentPolicyVersionResponseDto
        {
            ProfileKey = policy.ProfileKey.ToString(),
            DisplayName = policy.DisplayName,
            Description = policy.Description,
            IsActive = record.IsProfileActive,
            Version = policy.Version,
            IsPersisted = policy.Version > 0,
            UpdatedAtUtc = policy.UpdatedAtUtc,
            UpdatedByUserId = policy.UpdatedByUserId,
            ChangeReason = record.ChangeReason,
            IsCurrentVersion = record.IsCurrentVersion,
            Weights = MapWeights(policy.Weights),
            MissingCriticalSkillRejects = policy.MissingCriticalSkillRejects,
            ExactRequiredRoleMandatory = policy.ExactRequiredRoleMandatory,
            MissingAvailabilityMode = policy.MissingAvailabilityMode.ToString(),
            MissingAvailabilityScore = policy.MissingAvailabilityScore,
            MissingRouteScore = policy.MissingRouteScore,
            MissingWorkloadScore = policy.MissingWorkloadScore,
            MissingExperienceScore = policy.MissingExperienceScore,
            NoRequirementsProfessionalFitScore = policy.NoRequirementsProfessionalFitScore,
            UseContinuityAsTieBreak = policy.UseContinuityAsTieBreak,
            EnableBatchSimulatedLoadBalancing = policy.EnableBatchSimulatedLoadBalancing
        };
    }

    private static SmartAssignmentPolicyResponseDto MapPolicyResponse(
        SmartAssignmentPolicySnapshot policy) =>
        new()
        {
            ProfileKey = policy.ProfileKey.ToString(),
            DisplayName = policy.DisplayName,
            Description = policy.Description,
            Version = policy.Version,
            IsPersisted = policy.Version > 0,
            UpdatedAtUtc = policy.UpdatedAtUtc,
            UpdatedByUserId = policy.UpdatedByUserId,
            Weights = MapWeights(policy.Weights),
            MissingCriticalSkillRejects = policy.MissingCriticalSkillRejects,
            ExactRequiredRoleMandatory = policy.ExactRequiredRoleMandatory,
            MissingAvailabilityMode = policy.MissingAvailabilityMode.ToString(),
            MissingAvailabilityScore = policy.MissingAvailabilityScore,
            MissingRouteScore = policy.MissingRouteScore,
            MissingWorkloadScore = policy.MissingWorkloadScore,
            MissingExperienceScore = policy.MissingExperienceScore,
            NoRequirementsProfessionalFitScore = policy.NoRequirementsProfessionalFitScore,
            UseContinuityAsTieBreak = policy.UseContinuityAsTieBreak,
            EnableBatchSimulatedLoadBalancing = policy.EnableBatchSimulatedLoadBalancing
        };

    private static SmartAssignmentPolicyWeightsDto MapWeights(SmartAssignmentWeights weights) =>
        new()
        {
            ProfessionalFit = weights.ProfessionalFit,
            Availability = weights.Availability,
            Workload = weights.Workload,
            Geography = weights.Geography,
            Experience = weights.Experience
        };

    private static SmartAssignmentPolicySnapshot MapPolicy(
        SmartAssignmentProfileKey profileKey,
        SmartAssignmentPolicyEditableDto request,
        int version)
    {
        if (!Enum.TryParse<MissingAvailabilityMode>(request.MissingAvailabilityMode, true, out var mode)
            || !Enum.IsDefined(mode))
        {
            mode = MissingAvailabilityMode.NeutralScore;
        }

        return new SmartAssignmentPolicySnapshot(
            profileKey,
            request.DisplayName.Trim(),
            string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            version,
            new SmartAssignmentWeights(
                request.Weights.ProfessionalFit,
                request.Weights.Availability,
                request.Weights.Workload,
                request.Weights.Geography,
                request.Weights.Experience),
            request.MissingCriticalSkillRejects,
            request.ExactRequiredRoleMandatory,
            mode,
            request.MissingAvailabilityScore,
            request.MissingRouteScore,
            request.MissingWorkloadScore,
            request.MissingExperienceScore,
            request.NoRequirementsProfessionalFitScore,
            request.UseContinuityAsTieBreak,
            request.EnableBatchSimulatedLoadBalancing);
    }

    private static bool TryParseProfileKey(string value, out SmartAssignmentProfileKey profileKey) =>
        Enum.TryParse(value, true, out profileKey) && Enum.IsDefined(profileKey);
}

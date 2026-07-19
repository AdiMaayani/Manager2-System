using System.Text.Json.Serialization;

namespace ManageR2.Api.Features.Settings.DTOs;

public class SmartAssignmentPolicyWeightsDto
{
    [JsonRequired]
    public decimal ProfessionalFit { get; set; }
    [JsonRequired]
    public decimal Availability { get; set; }
    [JsonRequired]
    public decimal Workload { get; set; }
    [JsonRequired]
    public decimal Geography { get; set; }
    [JsonRequired]
    public decimal Experience { get; set; }
}

public class SmartAssignmentPolicyEditableDto
{
    [JsonRequired]
    public string DisplayName { get; set; } = string.Empty;
    public string? Description { get; set; }
    [JsonRequired]
    public bool IsActive { get; set; } = true;
    [JsonRequired]
    public SmartAssignmentPolicyWeightsDto Weights { get; set; } = new();
    [JsonRequired]
    public bool MissingCriticalSkillRejects { get; set; }
    [JsonRequired]
    public bool ExactRequiredRoleMandatory { get; set; }
    [JsonRequired]
    public string MissingAvailabilityMode { get; set; } = string.Empty;
    [JsonRequired]
    public decimal MissingAvailabilityScore { get; set; }
    [JsonRequired]
    public decimal MissingRouteScore { get; set; }
    [JsonRequired]
    public decimal MissingWorkloadScore { get; set; }
    [JsonRequired]
    public decimal MissingExperienceScore { get; set; }
    [JsonRequired]
    public decimal NoRequirementsProfessionalFitScore { get; set; }
    [JsonRequired]
    public bool UseContinuityAsTieBreak { get; set; }
    [JsonRequired]
    public bool EnableBatchSimulatedLoadBalancing { get; set; }
}

public sealed class UpdateSmartAssignmentPolicyRequestDto : SmartAssignmentPolicyEditableDto
{
    [JsonRequired]
    public int ExpectedVersion { get; set; }
    public string? ChangeReason { get; set; }
}

public class SmartAssignmentPolicyResponseDto : SmartAssignmentPolicyEditableDto
{
    public string ProfileKey { get; set; } = string.Empty;
    public int Version { get; set; }
    public bool IsPersisted { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public int? UpdatedByUserId { get; set; }
    public string? ChangeReason { get; set; }
}

public sealed class SmartAssignmentPolicyVersionResponseDto : SmartAssignmentPolicyResponseDto
{
    public bool IsCurrentVersion { get; set; }
}

public sealed class SmartAssignmentPolicyPreviewPolicyDto : SmartAssignmentPolicyEditableDto
{
    [JsonRequired]
    public string ProfileKey { get; set; } = string.Empty;
}

public sealed class SmartAssignmentPolicyPreviewScoresDto
{
    [JsonRequired]
    public decimal ProfessionalFit { get; set; }
    [JsonRequired]
    public decimal Availability { get; set; }
    [JsonRequired]
    public decimal Workload { get; set; }
    [JsonRequired]
    public decimal Geography { get; set; }
    [JsonRequired]
    public decimal Experience { get; set; }
}

public sealed class SmartAssignmentPolicyPreviewRequestDto
{
    [JsonRequired]
    public SmartAssignmentPolicyPreviewPolicyDto Policy { get; set; } = new();
    [JsonRequired]
    public SmartAssignmentPolicyPreviewScoresDto SampleScores { get; set; } = new();
}

public sealed class SmartAssignmentPolicyPreviewContributionDto
{
    public string FactorCode { get; set; } = string.Empty;
    public string Key { get; set; } = string.Empty;
    public decimal Score { get; set; }
    public decimal WeightPercent { get; set; }
    public decimal WeightedContribution { get; set; }
}

public sealed class SmartAssignmentPolicyPreviewResponseDto
{
    public decimal TotalScore { get; set; }
    public List<SmartAssignmentPolicyPreviewContributionDto> Contributions { get; set; } = [];
}

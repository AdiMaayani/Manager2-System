using FluentValidation;
using ManageR2.Api.Features.Settings.DTOs;
using ManageR2.Domain.Features.SmartAssignment;

namespace ManageR2.Api.Features.Settings.Validators;

public sealed class UpdateSmartAssignmentPolicyRequestDtoValidator
    : AbstractValidator<UpdateSmartAssignmentPolicyRequestDto>
{
    public UpdateSmartAssignmentPolicyRequestDtoValidator()
    {
        Include(new SmartAssignmentPolicyEditableDtoValidator<UpdateSmartAssignmentPolicyRequestDto>());
        RuleFor(request => request.ExpectedVersion)
            .GreaterThan(0).WithMessage("ExpectedVersion must be positive.");
        RuleFor(request => request.ChangeReason)
            .MaximumLength(500).WithMessage("ChangeReason cannot exceed 500 characters.");
    }
}

public sealed class SmartAssignmentPolicyPreviewRequestDtoValidator
    : AbstractValidator<SmartAssignmentPolicyPreviewRequestDto>
{
    public SmartAssignmentPolicyPreviewRequestDtoValidator()
    {
        RuleFor(request => request.Policy)
            .NotNull()
            .SetValidator(new SmartAssignmentPolicyPreviewPolicyDtoValidator());
        RuleFor(request => request.SampleScores)
            .NotNull()
            .SetValidator(new SmartAssignmentPolicyPreviewScoresDtoValidator());
    }
}

internal sealed class SmartAssignmentPolicyPreviewPolicyDtoValidator
    : AbstractValidator<SmartAssignmentPolicyPreviewPolicyDto>
{
    public SmartAssignmentPolicyPreviewPolicyDtoValidator()
    {
        Include(new SmartAssignmentPolicyEditableDtoValidator<SmartAssignmentPolicyPreviewPolicyDto>());
        RuleFor(policy => policy.ProfileKey)
            .Must(IsProfileKey).WithMessage("ProfileKey is invalid.");
    }

    private static bool IsProfileKey(string profileKey) =>
        Enum.TryParse<SmartAssignmentProfileKey>(profileKey, true, out var parsed)
        && Enum.IsDefined(parsed);
}

internal sealed class SmartAssignmentPolicyEditableDtoValidator<TPolicy>
    : AbstractValidator<TPolicy>
    where TPolicy : SmartAssignmentPolicyEditableDto
{
    public SmartAssignmentPolicyEditableDtoValidator()
    {
        RuleFor(policy => policy.DisplayName)
            .NotEmpty().WithMessage("DisplayName is required.")
            .MaximumLength(150).WithMessage("DisplayName cannot exceed 150 characters.");
        RuleFor(policy => policy.Description)
            .MaximumLength(500).WithMessage("Description cannot exceed 500 characters.");
        RuleFor(policy => policy.Weights)
            .NotNull()
            .SetValidator(new SmartAssignmentPolicyWeightsDtoValidator());
        RuleFor(policy => policy.MissingAvailabilityMode)
            .Must(IsMissingAvailabilityMode)
            .WithMessage("MissingAvailabilityMode is invalid.");
        ScoreRule(policy => policy.MissingAvailabilityScore, nameof(SmartAssignmentPolicyEditableDto.MissingAvailabilityScore));
        ScoreRule(policy => policy.MissingRouteScore, nameof(SmartAssignmentPolicyEditableDto.MissingRouteScore));
        ScoreRule(policy => policy.MissingWorkloadScore, nameof(SmartAssignmentPolicyEditableDto.MissingWorkloadScore));
        ScoreRule(policy => policy.MissingExperienceScore, nameof(SmartAssignmentPolicyEditableDto.MissingExperienceScore));
        ScoreRule(
            policy => policy.NoRequirementsProfessionalFitScore,
            nameof(SmartAssignmentPolicyEditableDto.NoRequirementsProfessionalFitScore));
    }

    private void ScoreRule(
        System.Linq.Expressions.Expression<Func<TPolicy, decimal>> selector,
        string fieldName)
    {
        RuleFor(selector)
            .InclusiveBetween(0m, 100m)
            .WithMessage($"{fieldName} must be between 0 and 100.")
            .Must(HasAtMostTwoDecimalPlaces)
            .WithMessage($"{fieldName} cannot have more than two decimal places.");
    }

    private static bool IsMissingAvailabilityMode(string value) =>
        Enum.TryParse<MissingAvailabilityMode>(value, true, out var parsed)
        && Enum.IsDefined(parsed);

    private static bool HasAtMostTwoDecimalPlaces(decimal value) =>
        decimal.Round(value, 2) == value;
}

internal sealed class SmartAssignmentPolicyWeightsDtoValidator
    : AbstractValidator<SmartAssignmentPolicyWeightsDto>
{
    public SmartAssignmentPolicyWeightsDtoValidator()
    {
        RuleFor(weights => weights.ProfessionalFit).InclusiveBetween(0m, 100m);
        RuleFor(weights => weights.Availability).InclusiveBetween(0m, 100m);
        RuleFor(weights => weights.Workload).InclusiveBetween(0m, 100m);
        RuleFor(weights => weights.Geography).InclusiveBetween(0m, 100m);
        RuleFor(weights => weights.Experience).InclusiveBetween(0m, 100m);
        RuleFor(weights => weights)
            .Must(weights => Math.Abs(
                weights.ProfessionalFit
                + weights.Availability
                + weights.Workload
                + weights.Geography
                + weights.Experience
                - 100m) <= SmartAssignmentPolicyDefaults.WeightTolerance)
            .WithMessage("Scoring weights must total 100%.");
        RuleFor(weights => weights)
            .Must(weights => new[]
            {
                weights.ProfessionalFit,
                weights.Availability,
                weights.Workload,
                weights.Geography,
                weights.Experience
            }.All(value => decimal.Round(value, 2) == value))
            .WithMessage("Scoring weights cannot have more than two decimal places.");
    }
}

internal sealed class SmartAssignmentPolicyPreviewScoresDtoValidator
    : AbstractValidator<SmartAssignmentPolicyPreviewScoresDto>
{
    public SmartAssignmentPolicyPreviewScoresDtoValidator()
    {
        RuleFor(scores => scores.ProfessionalFit).InclusiveBetween(0m, 100m);
        RuleFor(scores => scores.Availability).InclusiveBetween(0m, 100m);
        RuleFor(scores => scores.Workload).InclusiveBetween(0m, 100m);
        RuleFor(scores => scores.Geography).InclusiveBetween(0m, 100m);
        RuleFor(scores => scores.Experience).InclusiveBetween(0m, 100m);
    }
}

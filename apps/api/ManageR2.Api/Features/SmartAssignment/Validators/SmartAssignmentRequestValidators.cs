using FluentValidation;
using ManageR2.Api.DTOs;
using ManageR2.Domain.Features.SmartAssignment;
using ManageR2.Domain.Features.WorkItems;

namespace ManageR2.Api.Features.SmartAssignment.Validators;

public sealed class SmartAssignmentRequestDtoValidator : AbstractValidator<SmartAssignmentRequestDto>
{
    public SmartAssignmentRequestDtoValidator()
    {
        RuleFor(request => request)
            .Must(request => request.ProjectId.HasValue
                || (request.WorkItemIds != null && request.WorkItemIds.Count > 0))
            .WithName(nameof(SmartAssignmentRequestDto.ProjectId))
            .WithMessage("Either ProjectId or WorkItemIds must be provided.");

        RuleFor(request => request.Weights!)
            .SetValidator(new SmartAssignmentWeightsDtoValidator())
            .When(request => request.Weights is not null);
    }
}

public sealed class DraftTaskRecommendationRequestDtoValidator
    : AbstractValidator<DraftTaskRecommendationRequestDto>
{
    public DraftTaskRecommendationRequestDtoValidator()
    {
        RuleFor(request => request.TaskCategory)
            .NotEmpty().WithMessage("TaskCategory is required.")
            .Must(category => category is WorkItemTaskCategories.Regular
                or WorkItemTaskCategories.Project
                or WorkItemTaskCategories.ServiceCall)
            .WithMessage("TaskCategory must be Regular, Project, or ServiceCall.");

        RuleFor(request => request.ProjectId)
            .NotNull().GreaterThan(0)
            .When(request => request.TaskCategory == WorkItemTaskCategories.Project)
            .WithMessage("ProjectId is required for Project tasks.");

        RuleFor(request => request)
            .Must(request => request.PlannedEnd > request.PlannedStart)
            .WithName(nameof(DraftTaskRecommendationRequestDto.PlannedEnd))
            .WithMessage("PlannedEnd must be after PlannedStart.");

        RuleFor(request => request.RequiredRole)
            .MaximumLength(100)
            .WithMessage("RequiredRole must be at most 100 characters.")
            .When(request => request.RequiredRole is not null);

        RuleForEach(request => request.RequiredRoles!)
            .NotEmpty().WithMessage("RequiredRoles cannot contain blank values.")
            .MaximumLength(100).WithMessage("Each required role must be at most 100 characters.")
            .When(request => request.RequiredRoles is not null);

        RuleFor(request => request.RequiredRoles)
            .Must(HaveDistinctRoles)
            .WithMessage("RequiredRoles cannot contain duplicate values.")
            .When(request => request.RequiredRoles is not null);

        RuleFor(request => request.Weights!)
            .SetValidator(new SmartAssignmentWeightsDtoValidator())
            .When(request => request.Weights is not null);
    }

    private static bool HaveDistinctRoles(List<string>? roles)
    {
        if (roles is null)
        {
            return true;
        }

        return roles
            .Select(role => role?.Trim())
            .Where(role => !string.IsNullOrWhiteSpace(role))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count() == roles.Count;
    }
}

public sealed class SmartAssignmentWeightsDtoValidator
    : AbstractValidator<SmartAssignmentWeightsDto>
{
    public SmartAssignmentWeightsDtoValidator()
    {
        AddWeightRule(weights => weights.ProfessionalFit, nameof(SmartAssignmentWeightsDto.ProfessionalFit));
        AddWeightRule(weights => weights.Availability, nameof(SmartAssignmentWeightsDto.Availability));
        AddWeightRule(weights => weights.Workload, nameof(SmartAssignmentWeightsDto.Workload));
        AddWeightRule(weights => weights.Geography, nameof(SmartAssignmentWeightsDto.Geography));
        AddWeightRule(weights => weights.Experience, nameof(SmartAssignmentWeightsDto.Experience));

        RuleFor(weights => weights)
            .Must(weights => Math.Abs(GetTotal(weights) - 100m)
                <= SmartAssignmentPolicyDefaults.WeightTolerance)
            .WithName("Weights")
            .WithMessage("Scoring weights must total 100%.");
    }

    private void AddWeightRule(
        System.Linq.Expressions.Expression<Func<SmartAssignmentWeightsDto, decimal>> selector,
        string fieldName)
    {
        RuleFor(selector)
            .InclusiveBetween(0m, 100m)
            .WithMessage($"{fieldName} weight must be between 0 and 100.")
            .Must(HaveAtMostTwoDecimalPlaces)
            .WithMessage($"{fieldName} weight cannot have more than two decimal places.");
    }

    private static bool HaveAtMostTwoDecimalPlaces(decimal value) =>
        decimal.Round(value, 2) == value;

    private static decimal GetTotal(SmartAssignmentWeightsDto weights) =>
        weights.ProfessionalFit
        + weights.Availability
        + weights.Workload
        + weights.Geography
        + weights.Experience;
}

public sealed class UpsertRecommendationFeedbackRequestDtoValidator
    : AbstractValidator<UpsertRecommendationFeedbackRequestDto>
{
    public UpsertRecommendationFeedbackRequestDtoValidator()
    {
        RuleFor(request => request.RecommendationRunId).GreaterThan(0);
        RuleFor(request => request.WorkItemId).GreaterThan(0);
        RuleFor(request => request.RecommendedEmployeeId).GreaterThan(0);
        RuleFor(request => request.PolicyProfileKey)
            .NotEmpty()
            .MaximumLength(30);
        RuleFor(request => request.PolicyVersion).GreaterThan(0);
        RuleFor(request => request.Rating)
            .InclusiveBetween(1, 10)
            .WithMessage("Rating must be between 1 and 10.");
        RuleFor(request => request.Comment)
            .MaximumLength(1000)
            .When(request => request.Comment is not null);
    }
}

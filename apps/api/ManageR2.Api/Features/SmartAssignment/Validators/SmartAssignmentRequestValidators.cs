using FluentValidation;
using ManageR2.Api.DTOs;
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
    }
}

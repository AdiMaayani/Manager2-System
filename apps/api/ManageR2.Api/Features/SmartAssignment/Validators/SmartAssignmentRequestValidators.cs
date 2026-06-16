using FluentValidation;
using ManageR2.Api.DTOs;

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
        RuleFor(request => request.ProjectId)
            .GreaterThan(0).WithMessage("ProjectId is required.");

        RuleFor(request => request)
            .Must(request => request.PlannedEnd > request.PlannedStart)
            .WithName(nameof(DraftTaskRecommendationRequestDto.PlannedEnd))
            .WithMessage("PlannedEnd must be after PlannedStart.");
    }
}

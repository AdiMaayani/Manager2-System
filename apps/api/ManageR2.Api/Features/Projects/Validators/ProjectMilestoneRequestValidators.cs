using FluentValidation;
using ManageR2.Api.Features.Projects.DTOs;

namespace ManageR2.Api.Features.Projects.Validators;

public sealed class CreateProjectMilestoneRequestDtoValidator
    : AbstractValidator<CreateProjectMilestoneRequestDto>
{
    public CreateProjectMilestoneRequestDtoValidator()
    {
        RuleFor(request => request.Title)
            .NotEmpty().WithMessage("Title is required.");

        RuleFor(request => request.Status)
            .NotEmpty().WithMessage("Status is required.");

        RuleFor(request => request.ManagerEmployeeId)
            .GreaterThan(0).WithMessage("ManagerEmployeeId is required.");

        RuleFor(request => request)
            .Must(request => !request.PlannedStart.HasValue || !request.PlannedEnd.HasValue || request.PlannedEnd > request.PlannedStart)
            .WithName(nameof(CreateProjectMilestoneRequestDto.PlannedEnd))
            .WithMessage("PlannedEnd must be after PlannedStart.");
    }
}

public sealed class UpdateProjectMilestoneRequestDtoValidator
    : AbstractValidator<UpdateProjectMilestoneRequestDto>
{
    public UpdateProjectMilestoneRequestDtoValidator()
    {
        RuleFor(request => request.Title)
            .NotEmpty().WithMessage("Title is required.");

        RuleFor(request => request.Status)
            .NotEmpty().WithMessage("Status is required.");

        RuleFor(request => request.ProgressPercent)
            .InclusiveBetween(0, 100).WithMessage("ProgressPercent must be between 0 and 100.");

        RuleFor(request => request.ManagerEmployeeId)
            .Must(id => !id.HasValue || id.Value > 0)
            .WithMessage("ManagerEmployeeId must be greater than 0 when supplied.");

        RuleFor(request => request)
            .Must(request => !request.PlannedStart.HasValue || !request.PlannedEnd.HasValue || request.PlannedEnd > request.PlannedStart)
            .WithName(nameof(UpdateProjectMilestoneRequestDto.PlannedEnd))
            .WithMessage("PlannedEnd must be after PlannedStart.");

        RuleFor(request => request)
            .Must(request => !request.ActualStart.HasValue || !request.ActualEnd.HasValue || request.ActualEnd > request.ActualStart)
            .WithName(nameof(UpdateProjectMilestoneRequestDto.ActualEnd))
            .WithMessage("ActualEnd must be after ActualStart.");
    }
}

public sealed class ReorderProjectMilestonesRequestDtoValidator
    : AbstractValidator<ReorderProjectMilestonesRequestDto>
{
    public ReorderProjectMilestonesRequestDtoValidator()
    {
        RuleFor(request => request.Items)
            .NotEmpty().WithMessage("At least one milestone sort item is required.");

        RuleForEach(request => request.Items).ChildRules(item =>
        {
            item.RuleFor(sortItem => sortItem.ProjectMilestoneId)
                .GreaterThan(0).WithMessage("ProjectMilestoneId must be greater than 0.");

            item.RuleFor(sortItem => sortItem.SortOrder)
                .GreaterThanOrEqualTo(0).WithMessage("SortOrder must be zero or greater.");
        });
    }
}

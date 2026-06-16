using FluentValidation;
using ManageR2.Api.DTOs;

namespace ManageR2.Api.Features.WorkItems.Validators;

public sealed class CreateMilestoneRequestValidator : AbstractValidator<CreateMilestoneRequest>
{
    public CreateMilestoneRequestValidator()
    {
        RuleFor(milestone => milestone.EstimatedHours)
            .Must(hours => hours is > 0 and <= 999.99m)
            .WithMessage("EstimatedHours must be greater than 0 and less than or equal to 999.99.")
            .When(milestone => milestone.EstimatedHours.HasValue);
    }
}

public sealed class UpdateMilestoneRequestValidator : AbstractValidator<UpdateMilestoneRequest>
{
    public UpdateMilestoneRequestValidator()
    {
        RuleFor(milestone => milestone.EstimatedHours)
            .Must(hours => hours is > 0 and <= 999.99m)
            .WithMessage("EstimatedHours must be greater than 0 and less than or equal to 999.99.")
            .When(milestone => milestone.EstimatedHours.HasValue);
    }
}

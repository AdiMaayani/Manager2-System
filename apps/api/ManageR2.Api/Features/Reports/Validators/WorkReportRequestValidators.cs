using FluentValidation;
using ManageR2.Api.Features.Reports.DTOs;
using ManageR2.Domain.Features.Inventory;

namespace ManageR2.Api.Features.Reports.Validators;

public sealed class ReverseWorkReportRequestDtoValidator : AbstractValidator<ReverseWorkReportRequestDto>
{
    public ReverseWorkReportRequestDtoValidator()
    {
        RuleFor(request => request.ReversalReason)
            .NotEmpty().WithMessage("Reversal reason is required.");
    }
}

public sealed class AddWorkReportInventoryLineRequestDtoValidator
    : AbstractValidator<AddWorkReportInventoryLineRequestDto>
{
    public AddWorkReportInventoryLineRequestDtoValidator()
    {
        RuleFor(request => request.InventoryItemId)
            .GreaterThan(0).WithMessage("InventoryItemId must be greater than 0.");

        RuleFor(request => request.Quantity)
            .GreaterThan(0).WithMessage("Quantity must be greater than 0.");

        RuleFor(request => request.UsageType)
            .Must(usageType => usageType is InventoryUsageTypes.Sold
                or InventoryUsageTypes.Installed
                or InventoryUsageTypes.Used)
            .WithMessage("UsageType must be Sold, Installed, or Used.");
    }
}

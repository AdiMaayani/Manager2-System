using FluentValidation;
using ManageR2.Api.DTOs;

namespace ManageR2.Api.Features.Inventory.Validators;

public sealed class InventoryItemDtoValidator : AbstractValidator<InventoryItemDto>
{
    public InventoryItemDtoValidator()
    {
        RuleFor(item => item.SkuCode)
            .NotEmpty().WithMessage("SkuCode is required.");

        RuleFor(item => item.ItemName)
            .NotEmpty().WithMessage("ItemName is required.");

        RuleFor(item => item.Unit)
            .NotEmpty().WithMessage("Unit is required.");

        RuleFor(item => item.QuantityOnHand)
            .GreaterThanOrEqualTo(0).WithMessage("QuantityOnHand cannot be negative.");

        RuleFor(item => item.MinimumQuantity)
            .GreaterThanOrEqualTo(0).WithMessage("MinimumQuantity cannot be negative.")
            .When(item => item.MinimumQuantity.HasValue);
    }
}

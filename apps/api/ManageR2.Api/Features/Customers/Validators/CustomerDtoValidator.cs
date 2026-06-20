using FluentValidation;
using ManageR2.Api.DTOs;

namespace ManageR2.Api.Features.Customers.Validators;

public sealed class CustomerDtoValidator : AbstractValidator<CustomerDto>
{
    public CustomerDtoValidator()
    {
        RuleFor(customer => customer.CustomerName)
            .NotEmpty().WithMessage("CustomerName is required.");

        RuleFor(customer => customer.CustomerType)
            .NotEmpty().WithMessage("CustomerType is required.");
    }
}

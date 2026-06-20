using FluentValidation;
using ManageR2.Api.Features.CustomerSystems.DTOs;

namespace ManageR2.Api.Features.CustomerSystems.Validators;

public sealed class CreateCustomerSystemRequestDtoValidator : AbstractValidator<CreateCustomerSystemRequestDto>
{
    public CreateCustomerSystemRequestDtoValidator()
    {
        RuleFor(system => system.CustomerId)
            .GreaterThan(0).WithMessage("CustomerId is required.");

        RuleFor(system => system.SystemType)
            .NotEmpty().WithMessage("SystemType is required.");

        RuleFor(system => system.SystemName)
            .NotEmpty().WithMessage("SystemName is required.");
    }
}

public sealed class UpdateCustomerSystemRequestDtoValidator : AbstractValidator<UpdateCustomerSystemRequestDto>
{
    public UpdateCustomerSystemRequestDtoValidator()
    {
        RuleFor(system => system.SystemType)
            .NotEmpty().WithMessage("SystemType is required.");

        RuleFor(system => system.SystemName)
            .NotEmpty().WithMessage("SystemName is required.");
    }
}

public sealed class CreateCustomerSystemSecretRequestDtoValidator
    : AbstractValidator<CreateCustomerSystemSecretRequestDto>
{
    public CreateCustomerSystemSecretRequestDtoValidator()
    {
        RuleFor(secret => secret.SecretType)
            .NotEmpty().WithMessage("SecretType is required.");

        RuleFor(secret => secret.SecretValue)
            .NotEmpty().WithMessage("SecretValue is required.");
    }
}

public sealed class UpdateCustomerSystemSecretRequestDtoValidator
    : AbstractValidator<UpdateCustomerSystemSecretRequestDto>
{
    public UpdateCustomerSystemSecretRequestDtoValidator()
    {
        // SecretValue stays optional on update: null/empty preserves the existing encrypted secret.
        RuleFor(secret => secret.SecretType)
            .NotEmpty().WithMessage("SecretType is required.");
    }
}

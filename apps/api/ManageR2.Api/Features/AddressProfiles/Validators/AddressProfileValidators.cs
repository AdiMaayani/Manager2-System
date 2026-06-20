using FluentValidation;
using ManageR2.Api.Features.AddressProfiles.DTOs;
using ManageR2.Domain.Features.Geo;

namespace ManageR2.Api.Features.AddressProfiles.Validators;

public class UpsertAddressProfileRequestDtoValidator : AbstractValidator<UpsertAddressProfileRequestDto>
{
    public UpsertAddressProfileRequestDtoValidator()
    {
        RuleFor(dto => dto.InputAddress)
            .NotEmpty()
            .MaximumLength(300);

        RuleFor(dto => dto.ValidationStatus)
            .NotEmpty()
            .Must(status => AddressValidationConstants.PersistedStatuses.Contains(status))
            .WithMessage("Validation status is not allowed for persistence.");
    }
}

public class SaveSiteWithAddressProfileRequestDtoValidator : AbstractValidator<SaveSiteWithAddressProfileRequestDto>
{
    public SaveSiteWithAddressProfileRequestDtoValidator()
    {
        RuleFor(dto => dto.CustomerId).GreaterThan(0);
        RuleFor(dto => dto.SiteName).NotEmpty().MaximumLength(100);

        When(dto => dto.AddressProfile is not null, () =>
        {
            RuleFor(dto => dto.AddressProfile!)
                .SetValidator(new UpsertAddressProfileRequestDtoValidator());
        });
    }
}

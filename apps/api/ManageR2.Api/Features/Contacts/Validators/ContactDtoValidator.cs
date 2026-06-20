using FluentValidation;
using ManageR2.Api.DTOs;

namespace ManageR2.Api.Features.Contacts.Validators;

public sealed class ContactDtoValidator : AbstractValidator<ContactDto>
{
    public ContactDtoValidator()
    {
        RuleFor(contact => contact.FullName)
            .NotEmpty().WithMessage("FullName is required.");

        RuleFor(contact => contact.ContactCategory)
            .NotEmpty().WithMessage("ContactCategory is required.");

        // At least one reachable channel must be supplied.
        RuleFor(contact => contact)
            .Must(contact => !string.IsNullOrWhiteSpace(contact.Phone) || !string.IsNullOrWhiteSpace(contact.Email))
            .WithName(nameof(ContactDto.Phone))
            .WithMessage("Phone or Email is required.");
    }
}

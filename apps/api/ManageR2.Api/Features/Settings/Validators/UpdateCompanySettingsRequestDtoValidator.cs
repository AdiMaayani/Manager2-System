using System.Net.Mail;
using FluentValidation;
using ManageR2.Api.DTOs;

namespace ManageR2.Api.Features.Settings.Validators;

public sealed class UpdateCompanySettingsRequestDtoValidator : AbstractValidator<UpdateCompanySettingsRequestDto>
{
    public UpdateCompanySettingsRequestDtoValidator()
    {
        RuleFor(settings => settings.CompanyName)
            .NotEmpty().WithMessage("CompanyName is required.");

        RuleFor(settings => settings.Email!)
            .Must(IsValidEmail).WithMessage("Email is invalid.")
            .When(settings => !string.IsNullOrWhiteSpace(settings.Email));

        RuleFor(settings => settings.Website!)
            .Must(IsValidWebsite).WithMessage("Website is invalid.")
            .When(settings => !string.IsNullOrWhiteSpace(settings.Website));
    }

    private static bool IsValidEmail(string email)
    {
        try
        {
            var address = new MailAddress(email.Trim());
            return string.Equals(address.Address, email.Trim(), StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    private static bool IsValidWebsite(string website)
    {
        return Uri.TryCreate(website.Trim(), UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
    }
}

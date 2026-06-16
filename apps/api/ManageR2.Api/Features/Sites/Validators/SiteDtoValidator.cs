using FluentValidation;
using ManageR2.Api.DTOs;

namespace ManageR2.Api.Features.Sites.Validators;

public sealed class SiteDtoValidator : AbstractValidator<SiteDto>
{
    public SiteDtoValidator()
    {
        RuleFor(site => site.CustomerId)
            .GreaterThan(0).WithMessage("CustomerId is required.");

        RuleFor(site => site.SiteName)
            .NotEmpty().WithMessage("SiteName is required.");
    }
}

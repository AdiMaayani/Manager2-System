using FluentValidation;
using ManageR2.Api.DTOs;

namespace ManageR2.Api.Features.Quotes.Validators;

public sealed class CreateQuoteRequestDtoValidator : AbstractValidator<CreateQuoteRequestDto>
{
    public CreateQuoteRequestDtoValidator()
    {
        RuleFor(quote => quote.CustomerId)
            .GreaterThan(0).WithMessage("Customer is required.");

        RuleFor(quote => quote.Status)
            .Must(QuoteValidationRules.IsAllowedStatus).WithMessage("Status is invalid.");

        RuleFor(quote => quote.VatRate)
            .GreaterThanOrEqualTo(0).WithMessage("VatRate cannot be negative.");

        RuleForEach(quote => quote.LineItems).SetValidator(new QuoteLineItemRequestDtoValidator());
    }
}

public sealed class UpdateQuoteRequestDtoValidator : AbstractValidator<UpdateQuoteRequestDto>
{
    public UpdateQuoteRequestDtoValidator()
    {
        RuleFor(quote => quote.CustomerId)
            .GreaterThan(0).WithMessage("Customer is required.");

        RuleFor(quote => quote.Status)
            .Must(QuoteValidationRules.IsAllowedStatus).WithMessage("Status is invalid.");

        RuleFor(quote => quote.VatRate)
            .GreaterThanOrEqualTo(0).WithMessage("VatRate cannot be negative.");

        RuleForEach(quote => quote.LineItems).SetValidator(new QuoteLineItemRequestDtoValidator());
    }
}

public sealed class QuoteLineItemRequestDtoValidator : AbstractValidator<QuoteLineItemRequestDto>
{
    public QuoteLineItemRequestDtoValidator()
    {
        RuleFor(lineItem => lineItem.Description)
            .NotEmpty().WithMessage("Each line item requires a description.");

        RuleFor(lineItem => lineItem.Unit)
            .NotEmpty().WithMessage("Each line item requires a unit.");

        RuleFor(lineItem => lineItem.Quantity)
            .GreaterThanOrEqualTo(0).WithMessage("Line quantity cannot be negative.");

        RuleFor(lineItem => lineItem.UnitPrice)
            .GreaterThanOrEqualTo(0).WithMessage("Line unit price cannot be negative.");
    }
}

internal static class QuoteValidationRules
{
    private static readonly string[] AllowedStatuses =
    {
        "Draft", "Sent", "Tracking", "Approved", "Rejected"
    };

    public static bool IsAllowedStatus(string status)
    {
        return !string.IsNullOrWhiteSpace(status) && AllowedStatuses.Contains(status);
    }
}

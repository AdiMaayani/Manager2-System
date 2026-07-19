using System.Net.Mail;
using FluentValidation;
using ManageR2.Api.DTOs;

namespace ManageR2.Api.Features.Employees.Validators;

public sealed class UpsertEmployeeRequestDtoValidator : AbstractValidator<UpsertEmployeeRequestDto>
{
    public UpsertEmployeeRequestDtoValidator()
    {
        RuleFor(employee => employee.FullName)
            .NotEmpty().WithMessage("FullName is required.");

        RuleFor(employee => employee.PrimaryRole)
            .NotEmpty().WithMessage("PrimaryRole is required.")
            .MaximumLength(100).WithMessage("PrimaryRole must be at most 100 characters.");

        RuleForEach(employee => employee.Professions!)
            .NotEmpty().WithMessage("Professions cannot contain blank values.")
            .MaximumLength(100).WithMessage("Each profession must be at most 100 characters.")
            .When(employee => employee.Professions is not null);

        RuleFor(employee => employee.Professions)
            .Must(professions => professions is null || professions
                .Select(value => value?.Trim())
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Count() == professions.Count)
            .WithMessage("Professions cannot contain duplicate values.");

        RuleFor(employee => employee.Email!)
            .Must(IsValidEmail).WithMessage("Email is invalid.")
            .When(employee => !string.IsNullOrWhiteSpace(employee.Email));

        RuleFor(employee => employee.DailyCapacityHours)
            .Must(capacity => capacity is > 0 and <= 24)
            .WithMessage("DailyCapacityHours must be greater than 0 and up to 24.")
            .When(employee => employee.DailyCapacityHours.HasValue);
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
}

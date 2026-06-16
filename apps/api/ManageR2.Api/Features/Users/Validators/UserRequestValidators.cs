using FluentValidation;
using ManageR2.Api.DTOs;

namespace ManageR2.Api.Features.Users.Validators;

public sealed class CreateUserDtoValidator : AbstractValidator<CreateUserDto>
{
    public CreateUserDtoValidator()
    {
        RuleFor(user => user.EmployeeId)
            .GreaterThan(0).WithMessage("EmployeeId must be greater than 0.");

        RuleFor(user => user.Username)
            .NotEmpty().WithMessage("Username is required.");

        RuleFor(user => user.Email)
            .NotEmpty().WithMessage("Email is required.");

        RuleFor(user => user.Password)
            .NotEmpty().WithMessage("Password is required.");

        RuleFor(user => user.Roles)
            .Must(UserRequestValidationRules.HasAtLeastOneName)
            .WithMessage("At least one role is required.");

        RuleFor(user => user.Departments)
            .Must(UserRequestValidationRules.HasAtLeastOneName)
            .WithMessage("At least one department is required.");
    }
}

public sealed class UpdateUserDtoValidator : AbstractValidator<UpdateUserDto>
{
    public UpdateUserDtoValidator()
    {
        RuleFor(user => user.EmployeeId)
            .GreaterThan(0).WithMessage("EmployeeId must be greater than 0.");

        RuleFor(user => user.Username)
            .NotEmpty().WithMessage("Username is required.");

        RuleFor(user => user.Email)
            .NotEmpty().WithMessage("Email is required.");

        RuleFor(user => user.Roles)
            .Must(UserRequestValidationRules.HasAtLeastOneName)
            .WithMessage("At least one role is required.");

        RuleFor(user => user.Departments)
            .Must(UserRequestValidationRules.HasAtLeastOneName)
            .WithMessage("At least one department is required.");
    }
}

public sealed class LoginRequestDtoValidator : AbstractValidator<LoginRequestDto>
{
    public LoginRequestDtoValidator()
    {
        RuleFor(login => login.Email)
            .NotEmpty().WithMessage("Email is required.");

        RuleFor(login => login.Password)
            .NotEmpty().WithMessage("Password is required.");
    }
}

internal static class UserRequestValidationRules
{
    // Mirrors NormalizeNamesList: at least one non-blank entry must remain after trimming.
    public static bool HasAtLeastOneName(List<string> names)
    {
        return names is not null && names.Any(name => !string.IsNullOrWhiteSpace(name));
    }
}

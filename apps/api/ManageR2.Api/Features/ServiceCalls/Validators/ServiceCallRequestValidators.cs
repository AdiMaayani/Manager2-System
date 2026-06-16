using FluentValidation;
using ManageR2.Api.Features.ServiceCalls.DTOs;

namespace ManageR2.Api.Features.ServiceCalls.Validators;

// Shared rule set for create/update service call requests (Update inherits Create), so both bodies validate identically.
public abstract class ServiceCallRequestValidator<TRequest> : AbstractValidator<TRequest>
    where TRequest : CreateServiceCallRequestDto
{
    protected ServiceCallRequestValidator()
    {
        RuleFor(request => request.Title)
            .NotEmpty().WithMessage("Title is required.");

        RuleFor(request => request.Status)
            .NotEmpty().WithMessage("Status is required.");

        RuleFor(request => request.BillingType)
            .NotEmpty().WithMessage("BillingType is required.");

        RuleFor(request => request.CustomerId)
            .GreaterThan(0).WithMessage("CustomerId must be greater than 0.");

        RuleFor(request => request.SiteId)
            .GreaterThan(0).WithMessage("SiteId must be greater than 0.");
    }
}

public sealed class CreateServiceCallRequestDtoValidator : ServiceCallRequestValidator<CreateServiceCallRequestDto>
{
}

public sealed class UpdateServiceCallRequestDtoValidator : ServiceCallRequestValidator<UpdateServiceCallRequestDto>
{
}

public sealed class AssignServiceCallEmployeeRequestDtoValidator
    : AbstractValidator<AssignServiceCallEmployeeRequestDto>
{
    public AssignServiceCallEmployeeRequestDtoValidator()
    {
        RuleFor(request => request)
            .Must(request => request.EmployeeId > 0 && !string.IsNullOrWhiteSpace(request.AssignmentRole))
            .WithName(nameof(AssignServiceCallEmployeeRequestDto.EmployeeId))
            .WithMessage("Valid EmployeeId and AssignmentRole are required.");
    }
}

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

        RuleFor(request => request.BillingType)
            .NotEmpty().WithMessage("BillingType is required.");

        RuleFor(request => request.CustomerId)
            .GreaterThan(0).WithMessage("CustomerId must be greater than 0.");

        RuleFor(request => request.SiteId)
            .Must(siteId => !siteId.HasValue || siteId.Value > 0)
            .WithMessage("SiteId must be greater than 0 when supplied.");

        RuleFor(request => request)
            .Must(request => !request.PlannedStart.HasValue || !request.PlannedEnd.HasValue || request.PlannedEnd > request.PlannedStart)
            .WithName(nameof(CreateServiceCallRequestDto.PlannedEnd))
            .WithMessage("PlannedEnd must be after PlannedStart.");
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

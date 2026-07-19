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

        RuleFor(request => request.RequiredRole)
            .MaximumLength(100)
            .When(request => request.RequiredRole is not null);

        RuleForEach(request => request.RequiredRoles!)
            .NotEmpty().MaximumLength(100)
            .When(request => request.RequiredRoles is not null);
        RuleFor(request => request.RequiredRoles)
            .Must(roles => roles is null || roles
                .Select(role => role?.Trim())
                .Where(role => !string.IsNullOrWhiteSpace(role))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Count() == roles.Count)
            .WithMessage("RequiredRoles cannot contain duplicate values.");
    }
}

public sealed class CreateServiceCallRequestDtoValidator : ServiceCallRequestValidator<CreateServiceCallRequestDto>
{
}

public sealed class UpdateServiceCallRequestDtoValidator : ServiceCallRequestValidator<UpdateServiceCallRequestDto>
{
    public UpdateServiceCallRequestDtoValidator()
    {
        RuleForEach(request => request.EmployeeReplacements!)
            .ChildRules(replacement =>
            {
                replacement.RuleFor(value => value.WorkEmployeeAssignmentId)
                    .GreaterThan(0);
                replacement.RuleFor(value => value.EmployeeId)
                    .GreaterThan(0);
            })
            .When(request => request.EmployeeReplacements is not null);
        RuleFor(request => request.EmployeeReplacements)
            .Must(replacements => replacements is null ||
                (replacements.Select(value => value.WorkEmployeeAssignmentId).Distinct().Count() == replacements.Count
                 && replacements.Select(value => value.EmployeeId).Distinct().Count() == replacements.Count))
            .WithMessage("EmployeeReplacements must contain unique assignment and employee identifiers.");
    }
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
        RuleFor(request => request.RecommendationRunId)
            .GreaterThan(0)
            .When(request => request.RecommendationRunId.HasValue);
    }
}

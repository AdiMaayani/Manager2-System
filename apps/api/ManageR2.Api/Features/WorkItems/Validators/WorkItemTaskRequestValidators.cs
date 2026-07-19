using FluentValidation;
using ManageR2.Api.DTOs;
using ManageR2.Domain.Features.WorkItems;

namespace ManageR2.Api.Features.WorkItems.Validators;

public sealed class CreateTaskRequestValidator : AbstractValidator<CreateTaskRequest>
{
    public CreateTaskRequestValidator()
    {
        RuleFor(request => request.Title)
            .NotEmpty().WithMessage("Title is required.");

        RuleFor(request => request.BillingType)
            .NotEmpty().WithMessage("BillingType is required.");

        RuleFor(request => request.TaskCategory)
            .NotEmpty().WithMessage("TaskCategory is required.")
            .Must(category => category is WorkItemTaskCategories.Regular or WorkItemTaskCategories.Project)
            .WithMessage("TaskCategory must be Regular or Project.");

        RuleFor(request => request.ParentWorkItemId)
            .NotNull().GreaterThan(0)
            .When(request => request.TaskCategory == WorkItemTaskCategories.Project)
            .WithMessage("ParentWorkItemId is required for Project tasks.");

        RuleFor(request => request.ParentWorkItemId)
            .Null()
            .When(request => request.TaskCategory == WorkItemTaskCategories.Regular)
            .WithMessage("Regular tasks cannot have a project parent.");

        AddRequiredRoleRules();
    }

    private void AddRequiredRoleRules()
    {
        RuleFor(request => request.RequiredRole)
            .MaximumLength(100)
            .When(request => request.RequiredRole is not null);
        RuleForEach(request => request.RequiredRoles!)
            .NotEmpty().MaximumLength(100)
            .When(request => request.RequiredRoles is not null);
        RuleFor(request => request.RequiredRoles)
            .Must(RoleListIsDistinct)
            .WithMessage("RequiredRoles cannot contain duplicate values.");
    }

    private static bool RoleListIsDistinct(List<string>? roles) => roles is null ||
        roles.Select(role => role?.Trim())
            .Where(role => !string.IsNullOrWhiteSpace(role))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count() == roles.Count;
}

public sealed class UpdateTaskRequestValidator : AbstractValidator<UpdateTaskRequest>
{
    public UpdateTaskRequestValidator()
    {
        RuleFor(request => request.Title)
            .NotEmpty().WithMessage("Title is required.");

        RuleFor(request => request.BillingType)
            .NotEmpty().WithMessage("BillingType is required.");

        RuleFor(request => request.TaskCategory)
            .NotEmpty().WithMessage("TaskCategory is required.")
            .Must(category => category is WorkItemTaskCategories.Regular or WorkItemTaskCategories.Project)
            .WithMessage("TaskCategory must be Regular or Project.");

        RuleFor(request => request.ParentWorkItemId)
            .NotNull().GreaterThan(0)
            .When(request => request.TaskCategory == WorkItemTaskCategories.Project)
            .WithMessage("ParentWorkItemId is required for Project tasks.");

        RuleFor(request => request.ParentWorkItemId)
            .Null()
            .When(request => request.TaskCategory == WorkItemTaskCategories.Regular)
            .WithMessage("Regular tasks cannot have a project parent.");

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
            .Must(ReplacementsAreUnique)
            .WithMessage("EmployeeReplacements must contain unique assignment and employee identifiers.");
    }

    private static bool ReplacementsAreUnique(List<EmployeeAssignmentReplacementRequest>? replacements) =>
        replacements is null ||
        (replacements.Select(value => value.WorkEmployeeAssignmentId).Distinct().Count() == replacements.Count
         && replacements.Select(value => value.EmployeeId).Distinct().Count() == replacements.Count);
}

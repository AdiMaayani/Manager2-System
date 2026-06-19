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
    }
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
    }
}

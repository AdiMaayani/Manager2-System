using FluentValidation;
using ManageR2.Api.DTOs;

namespace ManageR2.Api.Features.Projects.Validators;

public sealed class CreateProjectBoqItemRequestDtoValidator : AbstractValidator<CreateProjectBoqItemRequestDto>
{
    public CreateProjectBoqItemRequestDtoValidator()
    {
        ProjectValidationRules.ApplyBoqRules(this, item => item.ItemDescription, item => item.Quantity,
            item => item.Unit, item => item.UnitPrice);
    }
}

public sealed class UpdateProjectBoqItemRequestDtoValidator : AbstractValidator<UpdateProjectBoqItemRequestDto>
{
    public UpdateProjectBoqItemRequestDtoValidator()
    {
        ProjectValidationRules.ApplyBoqRules(this, item => item.ItemDescription, item => item.Quantity,
            item => item.Unit, item => item.UnitPrice);
    }
}

public sealed class CreateProjectEquipmentItemRequestDtoValidator
    : AbstractValidator<CreateProjectEquipmentItemRequestDto>
{
    public CreateProjectEquipmentItemRequestDtoValidator()
    {
        RuleFor(item => item.EquipmentName).NotEmpty().WithMessage("EquipmentName is required.");
        RuleFor(item => item.Status).NotEmpty().WithMessage("Status is required.");
    }
}

public sealed class UpdateProjectEquipmentItemRequestDtoValidator
    : AbstractValidator<UpdateProjectEquipmentItemRequestDto>
{
    public UpdateProjectEquipmentItemRequestDtoValidator()
    {
        RuleFor(item => item.EquipmentName).NotEmpty().WithMessage("EquipmentName is required.");
        RuleFor(item => item.Status).NotEmpty().WithMessage("Status is required.");
    }
}

public sealed class CreateProjectDrawingRequestDtoValidator : AbstractValidator<CreateProjectDrawingRequestDto>
{
    public CreateProjectDrawingRequestDtoValidator()
    {
        ProjectValidationRules.ApplyDrawingMetadataRules(this, d => d.Name, d => d.Type, d => d.DrawingDate);
    }
}

public sealed class UpdateProjectDrawingRequestDtoValidator : AbstractValidator<UpdateProjectDrawingRequestDto>
{
    public UpdateProjectDrawingRequestDtoValidator()
    {
        ProjectValidationRules.ApplyDrawingMetadataRules(this, d => d.Name, d => d.Type, d => d.DrawingDate);
    }
}

// Multipart upload metadata; the file stream itself is validated in the controller (size/extension).
public sealed class UploadProjectDrawingRequestDtoValidator : AbstractValidator<UploadProjectDrawingRequestDto>
{
    public UploadProjectDrawingRequestDtoValidator()
    {
        ProjectValidationRules.ApplyDrawingMetadataRules(this, d => d.Name, d => d.Type, d => d.DrawingDate);
    }
}

internal static class ProjectValidationRules
{
    public static void ApplyBoqRules<T>(
        AbstractValidator<T> validator,
        System.Linq.Expressions.Expression<Func<T, string>> itemDescription,
        System.Linq.Expressions.Expression<Func<T, decimal>> quantity,
        System.Linq.Expressions.Expression<Func<T, string>> unit,
        System.Linq.Expressions.Expression<Func<T, decimal?>> unitPrice)
    {
        validator.RuleFor(itemDescription).NotEmpty().WithMessage("ItemDescription is required.");
        validator.RuleFor(quantity).GreaterThan(0).WithMessage("Quantity must be greater than zero.");
        validator.RuleFor(unit).NotEmpty().WithMessage("Unit is required.");
        validator.RuleFor(unitPrice)
            .GreaterThanOrEqualTo(0).WithMessage("UnitPrice must be non-negative.")
            .When(model => unitPrice.Compile()(model).HasValue);
    }

    public static void ApplyDrawingMetadataRules<T>(
        AbstractValidator<T> validator,
        System.Linq.Expressions.Expression<Func<T, string>> name,
        System.Linq.Expressions.Expression<Func<T, string>> type,
        System.Linq.Expressions.Expression<Func<T, DateOnly>> drawingDate)
    {
        validator.RuleFor(name).NotEmpty().WithMessage("Name is required.");
        validator.RuleFor(type)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Type is required.")
            .Must(IsPdfOrDwg).WithMessage("Type must be PDF or DWG.");
        validator.RuleFor(drawingDate)
            .Must(date => date != default).WithMessage("DrawingDate is required.");
    }

    private static bool IsPdfOrDwg(string type)
    {
        var normalizedType = type.Trim().ToUpperInvariant();
        return normalizedType is "PDF" or "DWG";
    }
}

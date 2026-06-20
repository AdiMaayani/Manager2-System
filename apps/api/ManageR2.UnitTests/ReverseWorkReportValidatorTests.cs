using FluentValidation.TestHelper;
using ManageR2.Api.Features.Reports.DTOs;
using ManageR2.Api.Features.Reports.Validators;

namespace ManageR2.UnitTests;

public class ReverseWorkReportValidatorTests
{
    private readonly ReverseWorkReportRequestDtoValidator _validator = new();

    [Fact]
    public void Reverse_RequiresReason()
    {
        var result = _validator.TestValidate(new ReverseWorkReportRequestDto { ReversalReason = "" });

        result.ShouldHaveValidationErrorFor(dto => dto.ReversalReason);
    }
}

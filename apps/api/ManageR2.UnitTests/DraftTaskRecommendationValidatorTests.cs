using FluentValidation.TestHelper;
using ManageR2.Api.DTOs;
using ManageR2.Api.Features.SmartAssignment.Validators;
using ManageR2.Domain.Features.WorkItems;

namespace ManageR2.UnitTests;

public class DraftTaskRecommendationValidatorTests
{
    private readonly DraftTaskRecommendationRequestDtoValidator _validator = new();

    [Fact]
    public void RegularDraft_AllowsMissingProjectId()
    {
        var request = new DraftTaskRecommendationRequestDto
        {
            TaskCategory = WorkItemTaskCategories.Regular,
            PlannedStart = DateTime.UtcNow,
            PlannedEnd = DateTime.UtcNow.AddHours(1)
        };

        var result = _validator.TestValidate(request);

        result.ShouldNotHaveValidationErrorFor(dto => dto.ProjectId);
    }

    [Fact]
    public void ProjectDraft_RequiresProjectId()
    {
        var request = new DraftTaskRecommendationRequestDto
        {
            TaskCategory = WorkItemTaskCategories.Project,
            PlannedStart = DateTime.UtcNow,
            PlannedEnd = DateTime.UtcNow.AddHours(1)
        };

        var result = _validator.TestValidate(request);

        result.ShouldHaveValidationErrorFor(dto => dto.ProjectId);
    }

    [Fact]
    public void ServiceCallDraft_AllowsCustomerAndSiteWithoutProject()
    {
        var request = new DraftTaskRecommendationRequestDto
        {
            TaskCategory = WorkItemTaskCategories.ServiceCall,
            CustomerId = 3,
            SiteId = 8,
            PlannedStart = DateTime.UtcNow,
            PlannedEnd = DateTime.UtcNow.AddHours(2)
        };

        var result = _validator.TestValidate(request);

        result.ShouldNotHaveValidationErrorFor(dto => dto.ProjectId);
        result.ShouldNotHaveValidationErrorFor(dto => dto.CustomerId);
    }
}

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

    [Fact]
    public void DraftRequest_AllowsValidOptionalRunWeights()
    {
        var request = CreateRegularDraft();
        request.Weights = CreateValidWeights();

        var result = _validator.TestValidate(request);

        result.ShouldNotHaveValidationErrorFor(dto => dto.Weights);
    }

    [Fact]
    public void BatchRequest_AllowsValidOptionalRunWeights()
    {
        var validator = new SmartAssignmentRequestDtoValidator();
        var request = new SmartAssignmentRequestDto
        {
            WorkItemIds = [1],
            Weights = CreateValidWeights()
        };

        var result = validator.TestValidate(request);

        result.ShouldNotHaveValidationErrorFor(dto => dto.Weights);
    }

    [Fact]
    public void DraftRequest_RejectsWeightOutsidePercentageRange()
    {
        var request = CreateRegularDraft();
        request.Weights = CreateValidWeights();
        request.Weights.ProfessionalFit = 101m;
        request.Weights.Availability = 4m;

        var result = _validator.TestValidate(request);

        Assert.Contains(result.Errors, error =>
            error.PropertyName == "Weights.ProfessionalFit"
            && error.ErrorMessage.Contains("between 0 and 100", StringComparison.Ordinal));
    }

    [Fact]
    public void DraftRequest_RejectsWeightWithMoreThanTwoDecimalPlaces()
    {
        var request = CreateRegularDraft();
        request.Weights = CreateValidWeights();
        request.Weights.ProfessionalFit = 35.001m;
        request.Weights.Availability = 24.999m;

        var result = _validator.TestValidate(request);

        Assert.Contains(result.Errors, error =>
            error.PropertyName == "Weights.ProfessionalFit"
            && error.ErrorMessage.Contains("two decimal places", StringComparison.Ordinal));
    }

    [Fact]
    public void DraftRequest_RejectsWeightsThatDoNotTotalOneHundred()
    {
        var request = CreateRegularDraft();
        request.Weights = CreateValidWeights();
        request.Weights.Experience = 9m;

        var result = _validator.TestValidate(request);

        Assert.Contains(result.Errors, error =>
            error.ErrorMessage == "Scoring weights must total 100%.");
    }

    private static DraftTaskRecommendationRequestDto CreateRegularDraft() =>
        new()
        {
            TaskCategory = WorkItemTaskCategories.Regular,
            PlannedStart = DateTime.UtcNow,
            PlannedEnd = DateTime.UtcNow.AddHours(1)
        };

    private static SmartAssignmentWeightsDto CreateValidWeights() =>
        new()
        {
            ProfessionalFit = 35m,
            Availability = 25m,
            Workload = 15m,
            Geography = 15m,
            Experience = 10m
        };
}

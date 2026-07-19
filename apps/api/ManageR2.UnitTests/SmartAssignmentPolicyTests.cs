using ManageR2.Domain.Features.SmartAssignment;

namespace ManageR2.UnitTests;

public class SmartAssignmentPolicyTests
{
    [Fact]
    public void Defaults_AreExactlyApprovedValues()
    {
        var policy = SmartAssignmentPolicyDefaults.Create();

        Assert.Equal(35m, policy.Weights.ProfessionalFit);
        Assert.Equal(25m, policy.Weights.Availability);
        Assert.Equal(15m, policy.Weights.Workload);
        Assert.Equal(15m, policy.Weights.Geography);
        Assert.Equal(10m, policy.Weights.Experience);
        Assert.Equal(100m, policy.Weights.Total);
        Assert.True(policy.MissingCriticalSkillRejects);
        Assert.True(policy.ExactRequiredRoleMandatory);
        Assert.Equal(MissingAvailabilityMode.NeutralScore, policy.MissingAvailabilityMode);
        Assert.Equal(50m, policy.MissingAvailabilityScore);
        Assert.Equal(50m, policy.MissingRouteScore);
        Assert.Equal(50m, policy.MissingWorkloadScore);
        Assert.Equal(40m, policy.MissingExperienceScore);
        Assert.Equal(50m, policy.NoRequirementsProfessionalFitScore);
        Assert.True(policy.UseContinuityAsTieBreak);
        Assert.True(policy.EnableBatchSimulatedLoadBalancing);
    }

    [Fact]
    public void Validate_AcceptsApplicationDefaults()
    {
        var result = SmartAssignmentPolicyValidator.Validate(SmartAssignmentPolicyDefaults.Create());

        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
    }

    [Fact]
    public void Validate_RejectsWeightTotalOtherThan100()
    {
        var policy = SmartAssignmentPolicyDefaults.Create() with
        {
            Weights = new SmartAssignmentWeights(34m, 25m, 15m, 15m, 10m)
        };

        var result = SmartAssignmentPolicyValidator.Validate(policy);

        Assert.Contains(result.Errors, error => error.Code == "WeightTotalMustEqual100");
    }

    [Fact]
    public void Validate_RejectsNegativeWeight()
    {
        var policy = SmartAssignmentPolicyDefaults.Create() with
        {
            Weights = new SmartAssignmentWeights(-1m, 41m, 20m, 20m, 20m)
        };

        var result = SmartAssignmentPolicyValidator.Validate(policy);

        Assert.Contains(result.Errors, error => error.Code == "WeightMustBeNonNegative");
    }

    [Fact]
    public void Validate_RejectsPolicyValuesWithMoreThanTwoDecimalPlaces()
    {
        var policy = SmartAssignmentPolicyDefaults.Create() with
        {
            Weights = new SmartAssignmentWeights(33.333m, 26.667m, 15m, 15m, 10m),
            MissingRouteScore = 50.001m
        };

        var result = SmartAssignmentPolicyValidator.Validate(policy);

        Assert.Contains(result.Errors, error => error.Code == "WeightScaleExceeded");
        Assert.Contains(result.Errors, error => error.Code == "ScoreScaleExceeded");
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(101)]
    public void Validate_RejectsMissingDataScoreOutsideRange(int invalidScore)
    {
        var policy = SmartAssignmentPolicyDefaults.Create() with
        {
            MissingAvailabilityScore = invalidScore
        };

        var result = SmartAssignmentPolicyValidator.Validate(policy);

        Assert.Contains(result.Errors, error =>
            error.Field == nameof(SmartAssignmentPolicySnapshot.MissingAvailabilityScore) &&
            error.Code == "ScoreOutOfRange");
    }

    [Fact]
    public void Validate_RejectsInvalidEnumValues()
    {
        var policy = SmartAssignmentPolicyDefaults.Create() with
        {
            ProfileKey = (SmartAssignmentProfileKey)999,
            MissingAvailabilityMode = (MissingAvailabilityMode)999
        };

        var result = SmartAssignmentPolicyValidator.Validate(policy);

        Assert.Contains(result.Errors, error => error.Code == "InvalidProfileKey");
        Assert.Contains(result.Errors, error => error.Code == "InvalidMissingAvailabilityMode");
    }

    [Fact]
    public void ValidateAndThrow_ExposesStructuredErrors()
    {
        var policy = SmartAssignmentPolicyDefaults.Create() with { DisplayName = "" };

        var exception = Assert.Throws<SmartAssignmentPolicyValidationException>(
            () => SmartAssignmentPolicyValidator.ValidateAndThrow(policy));

        Assert.Contains(exception.Errors, error => error.Code == "DisplayNameRequired");
    }
}

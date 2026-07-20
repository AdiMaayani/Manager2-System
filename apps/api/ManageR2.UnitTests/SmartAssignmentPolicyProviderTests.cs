using ManageR2.Domain.Exceptions;
using ManageR2.Domain.Features.SmartAssignment;
using ManageR2.Infrastructure.Features.SmartAssignment.Repositories;
using ManageR2.Infrastructure.Features.SmartAssignment.Scoring;
using ManageR2.Infrastructure.Services.SmartAssignment;
using Microsoft.Extensions.Logging;
using Moq;

namespace ManageR2.UnitTests;

public class SmartAssignmentPolicyProviderTests
{
    [Fact]
    public async Task ResolveAsync_UsesActiveSpecificProfileBeforeDefault()
    {
        var repository = new Mock<ISmartAssignmentPolicyRepository>();
        repository.Setup(item => item.GetProfilesAsync()).ReturnsAsync(
        [
            Profile(SmartAssignmentProfileKey.Default, version: 2, isActive: true),
            Profile(SmartAssignmentProfileKey.Project, version: 4, isActive: true)
        ]);
        var provider = CreateProvider(repository);

        var result = await provider.ResolveAsync("Project");

        Assert.Equal(SmartAssignmentProfileKey.Project, result.ProfileKey);
        Assert.Equal(4, result.Version);
    }

    [Fact]
    public async Task ResolveAsync_IgnoresInactiveSpecificProfileAndUsesPersistedDefault()
    {
        var repository = new Mock<ISmartAssignmentPolicyRepository>();
        repository.Setup(item => item.GetProfilesAsync()).ReturnsAsync(
        [
            Profile(SmartAssignmentProfileKey.Default, version: 3, isActive: true),
            Profile(SmartAssignmentProfileKey.Project, version: 7, isActive: false)
        ]);
        var provider = CreateProvider(repository);

        var result = await provider.ResolveAsync("Project");

        Assert.Equal(SmartAssignmentProfileKey.Default, result.ProfileKey);
        Assert.Equal(3, result.Version);
    }

    [Fact]
    public async Task ResolveAsync_UsesApplicationDefaultWhenPersistenceFails()
    {
        var repository = new Mock<ISmartAssignmentPolicyRepository>();
        repository.Setup(item => item.GetProfilesAsync()).ThrowsAsync(new InvalidOperationException("DB unavailable"));
        var provider = CreateProvider(repository);

        var result = await provider.ResolveAsync("Regular");

        Assert.Equal(SmartAssignmentProfileKey.Default, result.ProfileKey);
        Assert.Equal(0, result.Version);
        Assert.Equal(100m, result.Weights.Total);
    }

    [Fact]
    public async Task ManagementGetProfilesAsync_DoesNotMaskPersistenceFailureWithDefaults()
    {
        var repository = new Mock<ISmartAssignmentPolicyRepository>();
        repository.Setup(item => item.GetProfilesAsync())
            .ThrowsAsync(new UserValidationException("DB unavailable"));
        var service = CreateManagementService(repository);

        var exception = await Assert.ThrowsAsync<UserValidationException>(
            () => service.GetProfilesAsync());

        Assert.Equal("DB unavailable", exception.Message);
    }

    [Fact]
    public async Task ManagementGetProfilesAsync_RejectsIncompleteOrDuplicatePersistenceState()
    {
        var repository = new Mock<ISmartAssignmentPolicyRepository>();
        repository.Setup(item => item.GetProfilesAsync()).ReturnsAsync(
        [
            Profile(SmartAssignmentProfileKey.Default, version: 2, isActive: true),
            Profile(SmartAssignmentProfileKey.Default, version: 3, isActive: true)
        ]);
        var service = CreateManagementService(repository);

        await Assert.ThrowsAsync<UserValidationException>(() => service.GetProfilesAsync());
    }

    [Fact]
    public async Task ManagementGetProfilesAsync_ReturnsPersistedProfilesInCanonicalOrder()
    {
        var repository = new Mock<ISmartAssignmentPolicyRepository>();
        repository.Setup(item => item.GetProfilesAsync()).ReturnsAsync(
        [
            Profile(SmartAssignmentProfileKey.ServiceCall, version: 4, isActive: false),
            Profile(SmartAssignmentProfileKey.Project, version: 3, isActive: true),
            Profile(SmartAssignmentProfileKey.Default, version: 1, isActive: true),
            Profile(SmartAssignmentProfileKey.Regular, version: 2, isActive: true)
        ]);
        var service = CreateManagementService(repository);

        var result = await service.GetProfilesAsync();

        Assert.Equal(
            new[]
            {
                SmartAssignmentProfileKey.Default,
                SmartAssignmentProfileKey.Regular,
                SmartAssignmentProfileKey.Project,
                SmartAssignmentProfileKey.ServiceCall
            },
            result.Select(profile => profile.Policy.ProfileKey));
        Assert.Equal(4, result.Single(profile =>
            profile.Policy.ProfileKey == SmartAssignmentProfileKey.ServiceCall).Policy.Version);
    }

    [Fact]
    public void Preview_UsesSharedContributionArithmeticAndDoesNotPersist()
    {
        var repository = new Mock<ISmartAssignmentPolicyRepository>(MockBehavior.Strict);
        var service = CreateManagementService(repository);
        var policy = SmartAssignmentPolicyDefaults.Create();

        var result = service.Preview(
            policy,
            new SmartAssignmentPolicyPreviewScores(80m, 60m, 40m, 20m, 100m));

        Assert.Equal(62m, result.TotalScore);
        Assert.Equal(5, result.Contributions.Count);
        Assert.Equal(result.TotalScore, result.Contributions.Sum(item => item.WeightedContribution));
        repository.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task ResetAsync_CreatesANewDefaultVersionThroughSaveContract()
    {
        var repository = new Mock<ISmartAssignmentPolicyRepository>();
        repository.Setup(item => item.GetProfilesAsync()).ReturnsAsync(
        [
            Profile(SmartAssignmentProfileKey.Regular, version: 5, isActive: false)
        ]);
        SmartAssignmentPolicySaveCommand? captured = null;
        repository
            .Setup(item => item.SaveVersionAsync(It.IsAny<SmartAssignmentPolicySaveCommand>()))
            .Callback<SmartAssignmentPolicySaveCommand>(command => captured = command)
            .ReturnsAsync((SmartAssignmentPolicySaveCommand command) =>
                command.Policy with { Version = command.ExpectedVersionNumber + 1 });
        var service = CreateManagementService(repository);

        var result = await service.ResetAsync(
            SmartAssignmentProfileKey.Regular,
            new SmartAssignmentPolicyActor(12, "127.0.0.1", "test"));

        Assert.NotNull(captured);
        Assert.True(captured!.IsReset);
        Assert.False(captured.IsActive);
        Assert.Equal(5, captured.ExpectedVersionNumber);
        Assert.Equal(6, result.Policy.Version);
        Assert.False(result.IsActive);
        Assert.Equal(35m, result.Policy.Weights.ProfessionalFit);
    }

    [Fact]
    public async Task UpdateAsync_RejectsInvalidWeightTotalBeforeRepositoryWrite()
    {
        var repository = new Mock<ISmartAssignmentPolicyRepository>(MockBehavior.Strict);
        var service = CreateManagementService(repository);
        var invalid = SmartAssignmentPolicyDefaults.Create(version: 1) with
        {
            Weights = new SmartAssignmentWeights(35m, 25m, 15m, 15m, 9m)
        };

        await Assert.ThrowsAsync<UserValidationException>(() => service.UpdateAsync(
            SmartAssignmentProfileKey.Default,
            invalid,
            isActive: true,
            expectedVersion: 1,
            changeReason: null,
            new SmartAssignmentPolicyActor(12, null, null)));
        repository.VerifyNoOtherCalls();
    }

    private static PersistedSmartAssignmentPolicyProvider CreateProvider(
        Mock<ISmartAssignmentPolicyRepository> repository) =>
        new(repository.Object, Mock.Of<ILogger<PersistedSmartAssignmentPolicyProvider>>());

    private static SmartAssignmentPolicyManagementService CreateManagementService(
        Mock<ISmartAssignmentPolicyRepository> repository) =>
        new(
            repository.Object,
            new SmartAssignmentScoringEngine(),
            Mock.Of<ILogger<SmartAssignmentPolicyManagementService>>());

    private static SmartAssignmentPolicyProfileRecord Profile(
        SmartAssignmentProfileKey profileKey,
        int version,
        bool isActive) =>
        new(
            SmartAssignmentPolicyDefaults.Create(profileKey, version),
            isActive,
            ChangeReason: null);
}

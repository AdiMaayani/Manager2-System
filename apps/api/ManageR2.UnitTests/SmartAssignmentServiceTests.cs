using ManageR2.Domain.Features.SmartAssignment;
using ManageR2.Domain.Features.WorkItems;
using ManageR2.Infrastructure.Features.SmartAssignment.Scoring;
using ManageR2.Infrastructure.Models.SmartAssignment;
using ManageR2.Infrastructure.Repositories.SmartAssignment;
using ManageR2.Infrastructure.Services.SmartAssignment;
using Moq;

namespace ManageR2.UnitTests;

public class SmartAssignmentServiceTests
{
    private static readonly DateTime Start = new(2026, 7, 21, 8, 0, 0, DateTimeKind.Utc);

    [Theory]
    [InlineData("Task", null, WorkItemTaskCategories.Regular)]
    [InlineData("Task", 42, WorkItemTaskCategories.Project)]
    [InlineData("ServiceCall", null, WorkItemTaskCategories.ServiceCall)]
    public async Task EvaluateTaskAsync_ResolvesCanonicalCategoryFromCurrentTaskTaxonomy(
        string workType,
        int? parentWorkItemId,
        string expectedCategory)
    {
        var repository = new Mock<ISmartAssignmentRepository>();
        repository
            .Setup(item => item.GetTaskRecommendationInputAsync(100))
            .ReturnsAsync(CreateInput(workType, parentWorkItemId));
        var provider = new Mock<ISmartAssignmentPolicyProvider>();
        provider
            .Setup(item => item.ResolveAsync(expectedCategory))
            .ReturnsAsync(SmartAssignmentPolicyDefaults.Create());
        var service = CreateService(repository, provider);

        await service.EvaluateTaskAsync(100, SmartAssignmentEvaluationContext.Empty(Start.Date));

        provider.Verify(item => item.ResolveAsync(expectedCategory), Times.Once);
    }

    [Fact]
    public async Task EvaluateDraftAsync_UsesExplicitDraftCategoryAndExposesSkillContractGap()
    {
        var repository = new Mock<ISmartAssignmentRepository>();
        repository
            .Setup(item => item.GetDraftTaskRecommendationInputAsync(It.IsAny<DraftTaskRecommendationContextModel>()))
            .ReturnsAsync(CreateInput("Task", 42));
        var provider = new Mock<ISmartAssignmentPolicyProvider>();
        provider
            .Setup(item => item.ResolveAsync(WorkItemTaskCategories.Project))
            .ReturnsAsync(SmartAssignmentPolicyDefaults.Create());
        var service = CreateService(repository, provider);
        var draft = new DraftTaskRecommendationContextModel
        {
            TaskCategory = WorkItemTaskCategories.Project,
            PlannedStart = Start,
            PlannedEnd = Start.AddHours(2)
        };

        var evaluation = await service.EvaluateDraftAsync(
            draft,
            SmartAssignmentEvaluationContext.Empty(Start.Date));

        provider.Verify(item => item.ResolveAsync(WorkItemTaskCategories.Project), Times.Once);
        Assert.Contains(
            SmartAssignmentMissingInputCodes.MissingRequiredSkillInput,
            evaluation.Candidates.Single().MissingInputCodes);
    }

    [Fact]
    public async Task EvaluateTaskAsync_PolicyOverrideBypassesPersistedProvider()
    {
        var repository = new Mock<ISmartAssignmentRepository>();
        repository
            .Setup(item => item.GetTaskRecommendationInputAsync(100))
            .ReturnsAsync(CreateInput("Task", null));
        var provider = new Mock<ISmartAssignmentPolicyProvider>();
        var service = CreateService(repository, provider);
        var previewPolicy = SmartAssignmentPolicyDefaults.Create(
            SmartAssignmentProfileKey.Regular,
            version: 12) with
        {
            MissingRouteScore = 17m
        };

        var evaluation = await service.EvaluateTaskAsync(
            100,
            SmartAssignmentEvaluationContext.Empty(Start.Date),
            previewPolicy);

        provider.Verify(item => item.ResolveAsync(It.IsAny<string?>()), Times.Never);
        Assert.Same(previewPolicy, evaluation.Policy);
        Assert.Equal(12, evaluation.Candidates.Single().PolicyVersion);
    }

    [Fact]
    public async Task EvaluateTaskAsync_RunWeightsReplaceOnlyPersistedBaselineWeights()
    {
        var repository = new Mock<ISmartAssignmentRepository>();
        repository
            .Setup(item => item.GetTaskRecommendationInputAsync(100))
            .ReturnsAsync(CreateInput("Task", null));
        var baseline = SmartAssignmentPolicyDefaults.Create(
            SmartAssignmentProfileKey.Regular,
            version: 14) with
        {
            MissingRouteScore = 27m
        };
        var provider = new Mock<ISmartAssignmentPolicyProvider>();
        provider
            .Setup(item => item.ResolveAsync(WorkItemTaskCategories.Regular))
            .ReturnsAsync(baseline);
        var service = CreateService(repository, provider);
        var runWeights = new SmartAssignmentWeights(45m, 20m, 15m, 10m, 10m);
        var context = new SmartAssignmentEvaluationContext(
            Start.Date,
            new Dictionary<int, SimulatedWorkloadAdjustment>(),
            runWeights);

        var evaluation = await service.EvaluateTaskAsync(100, context);

        provider.Verify(item => item.ResolveAsync(WorkItemTaskCategories.Regular), Times.Once);
        Assert.NotSame(baseline, evaluation.Policy);
        Assert.Equal(runWeights, evaluation.Policy.Weights);
        Assert.Equal(baseline.ProfileKey, evaluation.Policy.ProfileKey);
        Assert.Equal(baseline.Version, evaluation.Policy.Version);
        Assert.Equal(baseline.MissingRouteScore, evaluation.Policy.MissingRouteScore);
    }

    [Fact]
    public async Task EvaluateDraftAsync_DraftRunWeightsReplaceOnlyPersistedBaselineWeights()
    {
        var repository = new Mock<ISmartAssignmentRepository>();
        repository
            .Setup(item => item.GetDraftTaskRecommendationInputAsync(It.IsAny<DraftTaskRecommendationContextModel>()))
            .ReturnsAsync(CreateInput("Task", null));
        var baseline = SmartAssignmentPolicyDefaults.Create(
            SmartAssignmentProfileKey.Regular,
            version: 15);
        var provider = new Mock<ISmartAssignmentPolicyProvider>();
        provider
            .Setup(item => item.ResolveAsync(WorkItemTaskCategories.Regular))
            .ReturnsAsync(baseline);
        var service = CreateService(repository, provider);
        var runWeights = new SmartAssignmentWeights(50m, 15m, 10m, 15m, 10m);
        var draft = new DraftTaskRecommendationContextModel
        {
            TaskCategory = WorkItemTaskCategories.Regular,
            PlannedStart = Start,
            PlannedEnd = Start.AddHours(2),
            WeightsOverride = runWeights
        };

        var evaluation = await service.EvaluateDraftAsync(
            draft,
            SmartAssignmentEvaluationContext.Empty(Start.Date));

        provider.Verify(item => item.ResolveAsync(WorkItemTaskCategories.Regular), Times.Once);
        Assert.Equal(runWeights, evaluation.Policy.Weights);
        Assert.Equal(baseline with { Weights = runWeights }, evaluation.Policy);
    }

    [Fact]
    public async Task ExistingListMethodDelegatesToDetailedSharedEngine()
    {
        var repository = new Mock<ISmartAssignmentRepository>();
        repository
            .Setup(item => item.GetTaskRecommendationInputAsync(100))
            .ReturnsAsync(CreateInput("Task", null));
        var provider = new Mock<ISmartAssignmentPolicyProvider>();
        provider
            .Setup(item => item.ResolveAsync(WorkItemTaskCategories.Regular))
            .ReturnsAsync(SmartAssignmentPolicyDefaults.Create());
        var service = CreateService(repository, provider);

        var candidates = await service.GetRecommendationsAsync(100);

        Assert.Single(candidates);
        Assert.Equal(1, candidates[0].RankOrder);
        Assert.Equal(SmartAssignmentProfileKey.Default.ToString(), candidates[0].PolicyProfileKey);
    }

    private static SmartAssignmentService CreateService(
        Mock<ISmartAssignmentRepository> repository,
        Mock<ISmartAssignmentPolicyProvider> provider) =>
        new(repository.Object, provider.Object, new SmartAssignmentScoringEngine());

    private static TaskRecommendationInputModel CreateInput(string workType, int? parentWorkItemId)
    {
        return new TaskRecommendationInputModel
        {
            Task = new TaskCoreDataModel
            {
                WorkItemId = 100,
                WorkType = workType,
                ParentWorkItemId = parentWorkItemId,
                PlannedStart = Start,
                PlannedEnd = Start.AddHours(2),
                EstimatedHours = 2m
            },
            Employees =
            {
                new EmployeeCandidateModel
                {
                    EmployeeId = 1,
                    FullName = "Test Employee",
                    IsActive = true,
                    IsAssignable = true,
                    DailyCapacityHours = 8m
                }
            },
            EmployeeAvailability =
            {
                new EmployeeAvailabilityModel
                {
                    EmployeeId = 1,
                    AvailableFrom = Start.AddHours(-1),
                    AvailableTo = Start.AddHours(3),
                    AvailabilityType = "Available"
                }
            },
            EmployeeCurrentLoads =
            {
                new EmployeeCurrentLoadModel
                {
                    EmployeeId = 1,
                    CurrentAssignedHours = 0m,
                    OpenAssignmentsCount = 0
                }
            }
        };
    }
}

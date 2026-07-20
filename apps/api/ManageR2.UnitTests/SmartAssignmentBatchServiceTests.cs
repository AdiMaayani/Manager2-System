using ManageR2.Domain.Entities;
using ManageR2.Domain.Features.SmartAssignment;
using ManageR2.Domain.Features.WorkItems;
using ManageR2.Infrastructure.Features.SmartAssignment.Scoring;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Models.SmartAssignment;
using ManageR2.Infrastructure.Repositories;
using ManageR2.Infrastructure.Repositories.SmartAssignment;
using ManageR2.Infrastructure.Services;
using ManageR2.Infrastructure.Services.SmartAssignment;
using Moq;

namespace ManageR2.UnitTests;

public class SmartAssignmentBatchServiceTests
{
    private static readonly DateTime TaskStart =
        new(2026, 7, 20, 8, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task GenerateRecommendationsAsync_EnabledSimulatedLoadChangesLaterRecommendation()
    {
        var policy = SmartAssignmentPolicyDefaults.Create(
            SmartAssignmentProfileKey.Regular,
            version: 7) with
        {
            EnableBatchSimulatedLoadBalancing = true
        };
        var harness = CreateHarness(
        [
            CreateWorkItem(1, TaskStart, estimatedHours: 7m),
            CreateWorkItem(2, TaskStart.AddHours(1), estimatedHours: 2m)
        ], policy);

        var result = await harness.Service.GenerateRecommendationsAsync(new SmartAssignmentRequestModel
        {
            WorkItemIds = [2, 1]
        });

        Assert.Equal([1, 2], result.TaskResults.Select(item => item.WorkItemId));
        Assert.Equal([1, 2], result.TaskResults.Select(item => item.RecommendedEmployeeId));
        Assert.All(result.TaskResults, item =>
        {
            Assert.Equal("Regular", item.PolicyProfileKey);
            Assert.Equal(7, item.PolicyVersion);
        });
        harness.PolicyProvider.Verify(
            provider => provider.ResolveAsync(WorkItemTaskCategories.Regular),
            Times.Exactly(2));
    }

    [Fact]
    public async Task GenerateRecommendationsAsync_DisabledSimulatedLoadPreservesNonSimulatedRanking()
    {
        var policy = SmartAssignmentPolicyDefaults.Create(
            SmartAssignmentProfileKey.Regular,
            version: 8) with
        {
            EnableBatchSimulatedLoadBalancing = false
        };
        var harness = CreateHarness(
        [
            CreateWorkItem(1, TaskStart, estimatedHours: 7m),
            CreateWorkItem(2, TaskStart.AddHours(1), estimatedHours: 2m)
        ], policy);

        var result = await harness.Service.GenerateRecommendationsAsync(new SmartAssignmentRequestModel
        {
            WorkItemIds = [1, 2]
        });

        Assert.Equal([1, 1], result.TaskResults.Select(item => item.RecommendedEmployeeId));
    }

    [Fact]
    public async Task GenerateRecommendationsAsync_ProcessesScheduledThenUnscheduledWithStableTieBreak()
    {
        var tasks = new[]
        {
            CreateWorkItem(40, TaskStart.AddDays(1)),
            CreateWorkItem(30, plannedStart: null),
            CreateWorkItem(20, TaskStart),
            CreateWorkItem(10, TaskStart)
        };
        var evaluatedWorkItemIds = new List<int>();
        var harness = CreateHarness(tasks, onInputLoaded: evaluatedWorkItemIds.Add);

        var result = await harness.Service.GenerateRecommendationsAsync(new SmartAssignmentRequestModel
        {
            WorkItemIds = [30, 40, 20, 10, 20]
        });

        Assert.Equal([10, 20, 40, 30], evaluatedWorkItemIds);
        Assert.Equal([10, 20, 40, 30], result.TaskResults.Select(item => item.WorkItemId));
    }

    [Fact]
    public async Task GenerateRecommendationsAsync_CriticalSkillGapStillReturnsRankedRecommendation()
    {
        var task = CreateWorkItem(1, TaskStart);
        var harness = CreateHarness(
            [task],
            inputFactory: workItem =>
            {
                var input = CreateRecommendationInput(workItem);
                input.RequiredSkills.Add(new RequiredSkillModel
                {
                    WorkItemId = workItem.WorkItemId,
                    SkillId = 99,
                    SkillName = "Critical skill",
                    RequiredLevel = 3,
                    ImportanceLevel = "Critical"
                });
                return input;
            });

        var result = await harness.Service.GenerateRecommendationsAsync(new SmartAssignmentRequestModel
        {
            WorkItemIds = [1]
        });

        var taskResult = Assert.Single(result.TaskResults);
        Assert.Equal(1, taskResult.RecommendedEmployeeId);
        Assert.Equal("Employee 1", taskResult.RecommendedEmployeeName);
        Assert.Equal(1, result.TasksWithRecommendations);
        Assert.Null(taskResult.BestIneligibleAlternative);
        Assert.Empty(taskResult.Violations);
        Assert.NotEmpty(taskResult.Warnings);
    }

    [Fact]
    public async Task GenerateRecommendationsAsync_SaveRunPersistsEveryRankedDecisionSupportCandidate()
    {
        var harness = CreateHarness(
            [CreateWorkItem(1, TaskStart)],
            inputFactory: workItem =>
            {
                var input = CreateRecommendationInputWithEmployees(workItem, Enumerable.Range(1, 7));
                input.RequiredSkills.Add(new RequiredSkillModel
                {
                    WorkItemId = workItem.WorkItemId,
                    SkillId = 99,
                    SkillName = "Critical skill",
                    RequiredLevel = 3,
                    ImportanceLevel = "Critical"
                });
                return input;
            });

        var result = await harness.Service.GenerateRecommendationsAsync(new SmartAssignmentRequestModel
        {
            WorkItemIds = [1],
            SaveRun = true
        });

        Assert.Equal(99, result.RecommendationRunId);
        Assert.Equal(1, Assert.Single(result.TaskResults).RecommendedEmployeeId);
        harness.Repository.Verify(repository => repository.SaveTaskAssignmentRecommendationAsync(
            99,
            1,
            It.Is<EmployeeCandidateModel>(candidate => candidate.IsEligible)), Times.Exactly(7));
        harness.Repository.Verify(repository => repository.CompleteRecommendationRunAsync(99), Times.Once);
    }

    [Fact]
    public async Task GenerateRecommendationsAsync_SurfacesFullRankedCandidateListPerTask()
    {
        var harness = CreateHarness(
            [CreateWorkItem(1, TaskStart)],
            inputFactory: workItem =>
                CreateRecommendationInputWithEmployees(workItem, Enumerable.Range(1, 5)));

        var result = await harness.Service.GenerateRecommendationsAsync(new SmartAssignmentRequestModel
        {
            WorkItemIds = [1]
        });

        var taskResult = Assert.Single(result.TaskResults);
        Assert.Equal(5, taskResult.Candidates.Count);
        // The top candidate matches the single recommended employee.
        Assert.Equal(taskResult.RecommendedEmployeeId, taskResult.Candidates[0].EmployeeId);
        // Every candidate is unique by employee id.
        Assert.Equal(
            taskResult.Candidates.Select(candidate => candidate.EmployeeId).Distinct().Count(),
            taskResult.Candidates.Count);
    }

    [Fact]
    public async Task GenerateRecommendationsAsync_SaveFailureDoesNotPublishPartialRun()
    {
        var harness = CreateHarness([CreateWorkItem(1, TaskStart)]);
        harness.Repository
            .Setup(repository => repository.SaveTaskAssignmentRecommendationAsync(
                It.IsAny<int>(),
                It.IsAny<int>(),
                It.IsAny<EmployeeCandidateModel>()))
            .ThrowsAsync(new InvalidOperationException("write failed"));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            harness.Service.GenerateRecommendationsAsync(new SmartAssignmentRequestModel
            {
                WorkItemIds = [1],
                SaveRun = true
            }));

        harness.Repository.Verify(
            repository => repository.CompleteRecommendationRunAsync(It.IsAny<int>()),
            Times.Never);
    }

    [Fact]
    public async Task GenerateRecommendationsAsync_LowScoringCandidateStillChangesLaterSimulatedLoad()
    {
        var harness = CreateHarness(
        [
            CreateWorkItem(1, TaskStart, estimatedHours: 7m),
            CreateWorkItem(2, TaskStart.AddHours(1), estimatedHours: 2m)
        ],
            inputFactory: workItem =>
            {
                var input = CreateRecommendationInput(workItem);
                if (workItem.WorkItemId == 1)
                {
                    input.RequiredSkills.Add(new RequiredSkillModel
                    {
                        WorkItemId = workItem.WorkItemId,
                        SkillId = 99,
                        SkillName = "Critical skill",
                        RequiredLevel = 3,
                        ImportanceLevel = "Critical"
                    });
                }

                return input;
            });

        var result = await harness.Service.GenerateRecommendationsAsync(new SmartAssignmentRequestModel
        {
            WorkItemIds = [1, 2]
        });

        Assert.Equal(1, result.TaskResults[0].RecommendedEmployeeId);
        Assert.Equal(2, result.TaskResults[1].RecommendedEmployeeId);
        Assert.Equal(2, result.TasksWithRecommendations);
    }

    [Fact]
    public async Task GenerateRecommendationsAsync_PlanningDateIsExplicitCompatibilityWarning()
    {
        var harness = CreateHarness([CreateWorkItem(1, TaskStart)]);

        var result = await harness.Service.GenerateRecommendationsAsync(new SmartAssignmentRequestModel
        {
            WorkItemIds = [1],
            PlanningDate = TaskStart.Date
        });

        Assert.Contains(
            SmartAssignmentBatchService.PlanningDateCompatibilityWarning,
            result.CompatibilityWarnings);
        Assert.Equal(
            result.TaskResults.Sum(item => item.Warnings.Count) + 1,
            result.WarningsCount);
    }

    [Fact]
    public async Task GenerateRecommendationsAsync_RequestWeightsOverrideAppliesOnlyToCurrentRun()
    {
        var baseline = SmartAssignmentPolicyDefaults.Create(
            SmartAssignmentProfileKey.Regular,
            version: 11);
        var harness = CreateHarness([CreateWorkItem(1, TaskStart)], baseline);
        var overrideWeights = new SmartAssignmentWeights(55m, 15m, 10m, 10m, 10m);

        var result = await harness.Service.GenerateRecommendationsAsync(new SmartAssignmentRequestModel
        {
            WorkItemIds = [1],
            WeightsOverride = overrideWeights
        });

        var factors = Assert.Single(result.TaskResults).Factors;
        Assert.Equal(55m, factors.Single(factor =>
            factor.Key == SmartAssignmentFactorCodes.ProfessionalFit).WeightPercent);
        Assert.Equal(15m, factors.Single(factor =>
            factor.Key == SmartAssignmentFactorCodes.Availability).WeightPercent);
        Assert.Equal(10m, factors.Single(factor =>
            factor.Key == SmartAssignmentFactorCodes.Geography).WeightPercent);
        Assert.Equal(35m, baseline.Weights.ProfessionalFit);
    }

    private static BatchHarness CreateHarness(
        IReadOnlyCollection<WorkItem> tasks,
        SmartAssignmentPolicySnapshot? policy = null,
        Func<WorkItem, TaskRecommendationInputModel>? inputFactory = null,
        Action<int>? onInputLoaded = null)
    {
        policy ??= SmartAssignmentPolicyDefaults.Create(SmartAssignmentProfileKey.Regular, version: 3);
        inputFactory ??= CreateRecommendationInput;
        var tasksById = tasks.ToDictionary(task => task.WorkItemId);

        var workItems = new Mock<IWorkItemRepository>();
        workItems
            .Setup(repository => repository.GetByIdAsync(It.IsAny<int>()))
            .ReturnsAsync((int workItemId) => tasksById.GetValueOrDefault(workItemId));

        var smartAssignmentRepository = new Mock<ISmartAssignmentRepository>();
        smartAssignmentRepository
            .Setup(repository => repository.GetTaskRecommendationInputAsync(It.IsAny<int>()))
            .ReturnsAsync((int workItemId) =>
            {
                onInputLoaded?.Invoke(workItemId);
                return inputFactory(tasksById[workItemId]);
            });
        smartAssignmentRepository
            .Setup(repository => repository.CreateRecommendationRunAsync(
                It.IsAny<string>(),
                It.IsAny<int?>(),
                It.IsAny<int?>(),
                It.IsAny<int?>(),
                It.IsAny<string>(),
                It.IsAny<string?>()))
            .ReturnsAsync(99);
        smartAssignmentRepository
            .Setup(repository => repository.CompleteRecommendationRunAsync(It.IsAny<int>()))
            .Returns(Task.CompletedTask);

        var policyProvider = new Mock<ISmartAssignmentPolicyProvider>();
        policyProvider
            .Setup(provider => provider.ResolveAsync(It.IsAny<string?>()))
            .ReturnsAsync(policy);

        var timeProvider = new FixedTimeProvider(
            new DateTimeOffset(2026, 7, 18, 9, 0, 0, TimeSpan.Zero));
        var advancedService = new SmartAssignmentService(
            smartAssignmentRepository.Object,
            policyProvider.Object,
            new SmartAssignmentScoringEngine(),
            timeProvider);
        var service = new SmartAssignmentBatchService(
            workItems.Object,
            advancedService,
            smartAssignmentRepository.Object,
            timeProvider);

        return new BatchHarness(service, policyProvider, smartAssignmentRepository);
    }

    private static WorkItem CreateWorkItem(
        int workItemId,
        DateTime? plannedStart,
        decimal estimatedHours = 2m) =>
        new()
        {
            WorkItemId = workItemId,
            Title = $"Task {workItemId}",
            WorkType = WorkItemWorkTypes.Task,
            PlannedStart = plannedStart,
            PlannedEnd = plannedStart?.AddHours((double)estimatedHours),
            EstimatedHours = estimatedHours
        };

    private static TaskRecommendationInputModel CreateRecommendationInput(WorkItem workItem) =>
        CreateRecommendationInputWithEmployees(workItem, [1, 2]);

    private static TaskRecommendationInputModel CreateRecommendationInputWithEmployees(
        WorkItem workItem,
        IEnumerable<int> employeeIds)
    {
        var plannedStart = workItem.PlannedStart ?? TaskStart.AddDays(2);
        var input = new TaskRecommendationInputModel
        {
            Task = new TaskCoreDataModel
            {
                WorkItemId = workItem.WorkItemId,
                WorkType = WorkItemWorkTypes.Task,
                PlannedStart = plannedStart,
                PlannedEnd = workItem.PlannedEnd ?? plannedStart.AddHours(2),
                EstimatedHours = workItem.EstimatedHours,
                SiteId = 50
            },
            SiteAddress = new SiteAddressModel
            {
                SiteId = 50,
                FormattedAddress = "Task site",
                Latitude = 31.77m,
                Longitude = 35.21m
            }
        };

        foreach (var employeeId in employeeIds)
        {
            input.Employees.Add(new EmployeeCandidateModel
            {
                EmployeeId = employeeId,
                FullName = $"Employee {employeeId}",
                PrimaryRole = "Technician",
                IsActive = true,
                IsAssignable = true,
                DailyCapacityHours = 8m
            });
            input.EmployeeAvailability.Add(new EmployeeAvailabilityModel
            {
                EmployeeId = employeeId,
                AvailableFrom = plannedStart.AddHours(-1),
                AvailableTo = (workItem.PlannedEnd ?? plannedStart.AddHours(2)).AddHours(1),
                AvailabilityType = "Available"
            });
            input.EmployeeCurrentLoads.Add(new EmployeeCurrentLoadModel
            {
                EmployeeId = employeeId,
                CurrentAssignedHours = 0m,
                OpenAssignmentsCount = 0
            });
            input.RouteEstimates.Add(new RouteEstimateModel
            {
                EmployeeId = employeeId,
                TargetSiteId = 50,
                OriginType = "HomeBase",
                EstimatedTravelMinutes = 15,
                EstimatedDistanceKm = 8m,
                RoutingProvider = "Geoapify"
            });
        }

        return input;
    }

    private sealed record BatchHarness(
        SmartAssignmentBatchService Service,
        Mock<ISmartAssignmentPolicyProvider> PolicyProvider,
        Mock<ISmartAssignmentRepository> Repository);

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;

        public override TimeZoneInfo LocalTimeZone => TimeZoneInfo.Utc;
    }
}

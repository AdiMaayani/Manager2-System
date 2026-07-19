using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Domain.Features.SmartAssignment;
using ManageR2.Domain.Features.WorkItems;
using ManageR2.Infrastructure.Features.Geo.Clients;
using ManageR2.Infrastructure.Features.Geo.Models;
using ManageR2.Infrastructure.Features.Geo.Services;
using ManageR2.Infrastructure.Features.SmartAssignment.Scoring;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Models.SmartAssignment;
using ManageR2.Infrastructure.Repositories;
using ManageR2.Infrastructure.Repositories.SmartAssignment;
using ManageR2.Infrastructure.Services;
using ManageR2.Infrastructure.Services.SmartAssignment;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace ManageR2.UnitTests;

public class SmartAssignmentRoutingIntegrationTests
{
    [Fact]
    public async Task SmartAssignmentService_EnrichesSavedAndDraftInputsBeforeScoring()
    {
        var savedInput = CreateInput();
        var draftInput = CreateInput();
        var repository = new Mock<ISmartAssignmentRepository>();
        repository
            .Setup(item => item.GetTaskRecommendationInputAsync(100))
            .ReturnsAsync(savedInput);
        repository
            .Setup(item => item.GetDraftTaskRecommendationInputAsync(
                It.IsAny<DraftTaskRecommendationContextModel>()))
            .ReturnsAsync(draftInput);
        var policyProvider = new Mock<ISmartAssignmentPolicyProvider>();
        policyProvider
            .Setup(item => item.ResolveAsync(It.IsAny<string?>()))
            .ReturnsAsync(SmartAssignmentPolicyDefaults.Create());
        var enricher = new Mock<ISmartAssignmentRouteEnricher>();
        enricher
            .Setup(item => item.EnrichAsync(
                It.IsAny<TaskRecommendationInputModel>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var service = new SmartAssignmentService(
            repository.Object,
            policyProvider.Object,
            new SmartAssignmentScoringEngine(),
            routeEnricher: enricher.Object);
        using var cancellation = new CancellationTokenSource();

        await service.EvaluateTaskAsync(100, null, null, cancellation.Token);
        await service.EvaluateDraftAsync(
            new DraftTaskRecommendationContextModel
            {
                TaskCategory = WorkItemTaskCategories.Regular,
                PlannedStart = Start,
                PlannedEnd = Start.AddHours(2)
            },
            null,
            null,
            cancellation.Token);

        enricher.Verify(item => item.EnrichAsync(savedInput, cancellation.Token), Times.Once);
        enricher.Verify(item => item.EnrichAsync(draftInput, cancellation.Token), Times.Once);
    }

    [Fact]
    public async Task BatchService_UsesCancellationAwareSharedEvaluation()
    {
        var workItems = new Mock<IWorkItemRepository>();
        workItems
            .Setup(item => item.GetByIdAsync(100))
            .ReturnsAsync(new WorkItem
            {
                WorkItemId = 100,
                WorkType = WorkItemWorkTypes.Task,
                Title = "Task",
                PlannedStart = Start,
                PlannedEnd = Start.AddHours(2)
            });
        var advanced = new Mock<IAdvancedSmartAssignmentService>();
        var policy = SmartAssignmentPolicyDefaults.Create();
        using var cancellation = new CancellationTokenSource();
        advanced
            .Setup(item => item.EvaluateTaskAsync(
                100,
                It.IsAny<SmartAssignmentEvaluationContext>(),
                null,
                cancellation.Token))
            .ReturnsAsync(new SmartAssignmentEvaluationResult(policy, []));
        var repository = new Mock<ISmartAssignmentRepository>();
        var batch = new SmartAssignmentBatchService(
            workItems.Object,
            advanced.Object,
            repository.Object);

        await batch.GenerateRecommendationsAsync(
            new SmartAssignmentRequestModel
            {
                WorkItemIds = [100],
                IncludeLockedTasks = true
            },
            cancellation.Token);

        advanced.Verify(item => item.EvaluateTaskAsync(
            100,
            It.IsAny<SmartAssignmentEvaluationContext>(),
            null,
            cancellation.Token), Times.Once);
    }

    [Fact]
    public async Task ProviderFailure_UsesExistingMissingRouteFallback()
    {
        var input = CreateInput();
        input.Task!.SiteId = 50;
        input.SiteAddress = new SiteAddressModel
        {
            SiteId = 50,
            Latitude = 31.77m,
            Longitude = 35.21m
        };
        input.EmployeeBaseAddresses.Add(new EmployeeBaseAddressModel
        {
            EmployeeId = 1,
            Latitude = 32.08m,
            Longitude = 34.78m
        });
        var repository = new Mock<ISmartAssignmentRepository>();
        repository
            .Setup(item => item.GetTaskRecommendationInputAsync(100))
            .ReturnsAsync(input);
        var policy = SmartAssignmentPolicyDefaults.Create() with { MissingRouteScore = 23m };
        var policyProvider = new Mock<ISmartAssignmentPolicyProvider>();
        policyProvider
            .Setup(item => item.ResolveAsync(WorkItemTaskCategories.Regular))
            .ReturnsAsync(policy);
        var client = new Mock<IGeoRoutingClient>();
        client
            .Setup(item => item.GetDrivingRouteAsync(
                It.IsAny<GeoCoordinateModel>(),
                It.IsAny<GeoCoordinateModel>(),
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new GeoProviderUnavailableException("provider unavailable"));
        using var routing = new GeoRoutingService(
            client.Object,
            new InMemoryGeoRouteLookupCache(),
            NullLogger<GeoRoutingService>.Instance);
        var service = new SmartAssignmentService(
            repository.Object,
            policyProvider.Object,
            new SmartAssignmentScoringEngine(),
            routeEnricher: new SmartAssignmentRouteEnricher(
                new SmartAssignmentRouteOriginResolver(),
                routing));

        var evaluation = await service.EvaluateTaskAsync(
            100,
            SmartAssignmentEvaluationContext.Empty(Start.Date));

        var candidate = Assert.Single(evaluation.Candidates);
        Assert.Equal(23m, candidate.GeographicScore);
        Assert.Contains(SmartAssignmentMissingInputCodes.RouteDataMissing, candidate.MissingInputCodes);
    }

    private static readonly DateTime Start =
        new(2026, 7, 21, 10, 0, 0, DateTimeKind.Utc);

    private static TaskRecommendationInputModel CreateInput() =>
        new()
        {
            Task = new TaskCoreDataModel
            {
                WorkItemId = 100,
                WorkType = WorkItemWorkTypes.Task,
                PlannedStart = Start,
                PlannedEnd = Start.AddHours(2)
            },
            Employees =
            {
                new EmployeeCandidateModel
                {
                    EmployeeId = 1,
                    IsActive = true,
                    IsAssignable = true
                }
            }
        };
}

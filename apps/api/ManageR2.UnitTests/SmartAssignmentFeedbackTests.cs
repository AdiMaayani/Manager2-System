using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using ManageR2.Api.Controllers;
using ManageR2.Api.DTOs;
using ManageR2.Api.Features.SmartAssignment.Validators;
using ManageR2.Domain.Exceptions;
using ManageR2.Domain.Features.SmartAssignment;
using ManageR2.Infrastructure.Features.SmartAssignment.Repositories;
using ManageR2.Infrastructure.Services;
using ManageR2.Infrastructure.Services.SmartAssignment;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace ManageR2.UnitTests;

public sealed class SmartAssignmentFeedbackTests
{
    [Theory]
    [InlineData(1)]
    [InlineData(10)]
    public void Validator_AcceptsBoundaryRatings(int rating)
    {
        var result = new UpsertRecommendationFeedbackRequestDtoValidator().Validate(CreateRequest(rating));

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(11)]
    public void Validator_RejectsRatingsOutsideOneThroughTen(int rating)
    {
        var result = new UpsertRecommendationFeedbackRequestDtoValidator().Validate(CreateRequest(rating));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, failure => failure.PropertyName == nameof(UpsertRecommendationFeedbackRequestDto.Rating));
    }

    [Fact]
    public async Task Service_NormalizesOptionalTextAndDelegatesIdempotencyToRepository()
    {
        var repository = new Mock<ISmartAssignmentFeedbackRepository>();
        var persisted = CreateRecord(wasCreated: true, wasChanged: true);
        repository
            .Setup(value => value.UpsertAsync(
                It.IsAny<RecommendationFeedbackCommand>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(persisted);
        var service = new SmartAssignmentFeedbackService(repository.Object);
        var command = new RecommendationFeedbackCommand(
            new RecommendationFeedbackIdentity(41, 17, 8, " Regular ", 3),
            9,
            "  useful recommendation  ",
            12,
            " 127.0.0.1 ",
            new string('a', 520));

        var first = await service.UpsertAsync(command);
        var second = await service.UpsertAsync(command);

        Assert.Equal(first.RecommendationFeedbackId, second.RecommendationFeedbackId);
        repository.Verify(value => value.UpsertAsync(
            It.Is<RecommendationFeedbackCommand>(actual =>
                actual.Identity.PolicyProfileKey == "Regular"
                && actual.Comment == "useful recommendation"
                && actual.ClientIp == "127.0.0.1"
                && actual.UserAgent != null
                && actual.UserAgent.Length == 512),
            It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task Service_RejectsInvalidRatingEvenWhenCalledOutsideApiValidation()
    {
        var service = new SmartAssignmentFeedbackService(Mock.Of<ISmartAssignmentFeedbackRepository>());
        var command = new RecommendationFeedbackCommand(
            new RecommendationFeedbackIdentity(41, 17, 8, "Regular", 3),
            11,
            null,
            12,
            null,
            null);

        await Assert.ThrowsAsync<UserValidationException>(() => service.UpsertAsync(command));
    }

    [Fact]
    public async Task Controller_UpsertsFeedbackForAuthenticatedActorAndMapsResponse()
    {
        RecommendationFeedbackCommand? captured = null;
        var feedbackService = new Mock<ISmartAssignmentFeedbackService>();
        feedbackService
            .Setup(value => value.UpsertAsync(
                It.IsAny<RecommendationFeedbackCommand>(),
                It.IsAny<CancellationToken>()))
            .Callback<RecommendationFeedbackCommand, CancellationToken>((command, _) => captured = command)
            .ReturnsAsync(CreateRecord(wasCreated: true, wasChanged: true));
        var controller = CreateController(feedbackService.Object, userId: 12);

        var result = await controller.UpsertFeedback(CreateRequest(10), CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<RecommendationFeedbackResponseDto>(ok.Value);
        Assert.Equal(93, response.FeedbackId);
        Assert.Equal(10, response.Rating);
        Assert.True(response.WasCreated);
        Assert.NotNull(captured);
        Assert.Equal(12, captured.ActingUserId);
        Assert.Equal("127.0.0.1", captured.ClientIp);
        Assert.Equal("test-agent", captured.UserAgent);
    }

    [Fact]
    public async Task Controller_DoesNotCallFeedbackServiceWithoutUserIdClaim()
    {
        var feedbackService = new Mock<ISmartAssignmentFeedbackService>();
        var controller = CreateController(feedbackService.Object, userId: null);

        var result = await controller.UpsertFeedback(CreateRequest(8), CancellationToken.None);

        Assert.IsType<ForbidResult>(result);
        feedbackService.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Service_LoadsAssignmentStateForPositiveIdentifiers()
    {
        var repository = new Mock<ISmartAssignmentFeedbackRepository>();
        var expected = CreateAssignmentState();
        repository
            .Setup(value => value.GetTaskAssignmentStateAsync(17, 8, 12, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);
        var service = new SmartAssignmentFeedbackService(repository.Object);

        var actual = await service.GetTaskAssignmentStateAsync(17, 8, 12);

        Assert.Same(expected, actual);
    }

    [Fact]
    public async Task Controller_ReturnsStableAssignmentFeedbackStateContract()
    {
        var feedbackService = new Mock<ISmartAssignmentFeedbackService>();
        feedbackService
            .Setup(value => value.GetTaskAssignmentStateAsync(17, 8, 12, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateAssignmentState());
        var controller = CreateController(feedbackService.Object, userId: 12);

        var result = await controller.GetTaskAssignmentFeedback(17, 8, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<TaskAssignmentFeedbackStateDto>(ok.Value);
        Assert.Equal("SmartAssignment", response.AssignmentMethod);
        Assert.False(response.IsManualAssignment);
        Assert.Equal(41, response.RecommendationRunId);
        Assert.Equal(10, response.Feedback?.Rating);
        Assert.Equal(501, response.Recommendation?.RecommendationId);
        Assert.Equal(91.5m, response.Recommendation?.TotalScore);
        Assert.Equal(6, response.Recommendation?.Factors.Count);
        Assert.True(response.Recommendation?.Factors[^1].IsTieBreaker);
        Assert.Equal("התאמה מקצועית", response.Recommendation?.Factors[0].Label);
    }

    [Fact]
    public void PersistedFactors_ReadTypedValidatedWeightsAndUseCanonicalContributionCalculator()
    {
        var policy = SmartAssignmentPolicyDefaults.Create(
            SmartAssignmentProfileKey.Regular,
            version: 3);
        var options = new JsonSerializerOptions
        {
            Converters = { new JsonStringEnumConverter() }
        };
        var factors = BuildPersistedFactors(JsonSerializer.Serialize(policy, options));

        Assert.Collection(
            factors,
            factor =>
            {
                Assert.Equal(SmartAssignmentFactorCodes.ProfessionalFit, factor.Key);
                Assert.Equal(35m, factor.WeightPercent);
                Assert.Equal(
                    SmartAssignmentPolicyScoreCalculator.CalculateContribution(80m, 35m),
                    factor.WeightedContribution);
                Assert.False(factor.IsTieBreak);
            },
            factor => Assert.Equal(25m, factor.WeightPercent),
            factor => Assert.Equal(15m, factor.WeightPercent),
            factor => Assert.Equal(15m, factor.WeightPercent),
            factor => Assert.Equal(10m, factor.WeightPercent),
            factor =>
            {
                Assert.Equal(SmartAssignmentFactorCodes.Continuity, factor.Key);
                Assert.Null(factor.WeightPercent);
                Assert.Null(factor.WeightedContribution);
                Assert.True(factor.IsTieBreak);
            });
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-json")]
    public void PersistedFactors_KeepWeightsAndContributionsNullWhenSnapshotCannotBeTrusted(
        string? policySnapshotJson)
    {
        var factors = BuildPersistedFactors(policySnapshotJson);

        Assert.All(
            factors.Take(5),
            factor =>
            {
                Assert.Null(factor.WeightPercent);
                Assert.Null(factor.WeightedContribution);
            });
        Assert.True(factors[^1].IsTieBreak);
    }

    [Fact]
    public void PersistedFactors_RejectTypedSnapshotWhoseWeightsDoNotPassPolicyValidation()
    {
        var invalidPolicy = SmartAssignmentPolicyDefaults.Create() with
        {
            Weights = new SmartAssignmentWeights(35m, 25m, 15m, 15m, 5m)
        };
        var options = new JsonSerializerOptions
        {
            Converters = { new JsonStringEnumConverter() }
        };

        var factors = BuildPersistedFactors(JsonSerializer.Serialize(invalidPolicy, options));

        Assert.All(factors.Take(5), factor => Assert.Null(factor.WeightPercent));
        Assert.All(factors.Take(5), factor => Assert.Null(factor.WeightedContribution));
    }

    [Fact]
    public void Controller_ExposesAssignmentFeedbackAtStableWorkItemRoute()
    {
        var method = typeof(SmartAssignmentController)
            .GetMethod(nameof(SmartAssignmentController.GetTaskAssignmentFeedback));

        var route = Assert.Single(method!.GetCustomAttributes<HttpGetAttribute>());
        Assert.Equal("work-items/{workItemId:int}/assignment-feedback", route.Template);
    }

    [Fact]
    public async Task Controller_ReturnsNotFoundWhenEmployeeIsNotDirectlyAssigned()
    {
        var feedbackService = new Mock<ISmartAssignmentFeedbackService>();
        feedbackService
            .Setup(value => value.GetTaskAssignmentStateAsync(17, 8, 12, It.IsAny<CancellationToken>()))
            .ReturnsAsync((TaskAssignmentFeedbackStateRecord?)null);
        var controller = CreateController(feedbackService.Object, userId: 12);

        var result = await controller.GetTaskAssignmentFeedback(17, 8, CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    private static UpsertRecommendationFeedbackRequestDto CreateRequest(int rating) =>
        new()
        {
            RecommendationRunId = 41,
            WorkItemId = 17,
            RecommendedEmployeeId = 8,
            PolicyProfileKey = "Regular",
            PolicyVersion = 3,
            Rating = rating,
            Comment = "useful recommendation"
        };

    private static RecommendationFeedbackRecord CreateRecord(bool wasCreated, bool wasChanged) =>
        new(
            93,
            41,
            17,
            8,
            "Regular",
            3,
            10,
            "useful recommendation",
            12,
            new DateTime(2026, 7, 19, 8, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 7, 19, 8, 5, 0, DateTimeKind.Utc),
            wasCreated,
            wasChanged);

    private static TaskAssignmentFeedbackStateRecord CreateAssignmentState() =>
        new(
            17,
            8,
            "Test Employee",
            false,
            "SmartAssignment",
            41,
            "Regular",
            3,
            1,
            91.5m,
            CreateRecord(wasCreated: false, wasChanged: false),
            new TaskAssignmentRecommendationRecord(
                501,
                41,
                1,
                91.5m,
                "Regular",
                3,
                "Regular tasks",
                24,
                18.4m,
                [
                    new(
                        SmartAssignmentFactorCodes.ProfessionalFit,
                        90m,
                        35m,
                        31.5m,
                        false),
                    new(SmartAssignmentFactorCodes.Availability, 100m, 25m, 25m, false),
                    new(SmartAssignmentFactorCodes.Workload, 80m, 15m, 12m, false),
                    new(SmartAssignmentFactorCodes.Geography, 70m, 15m, 10.5m, false),
                    new(SmartAssignmentFactorCodes.Experience, 80m, 10m, 8m, false),
                    new(SmartAssignmentFactorCodes.Continuity, 100m, null, null, true)
                ]));

    private static IReadOnlyList<TaskAssignmentRecommendationFactorRecord> BuildPersistedFactors(
        string? policySnapshotJson)
    {
        var method = typeof(SmartAssignmentFeedbackRepository).GetMethod(
            "BuildRecommendationFactors",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);

        var result = method.Invoke(
            null,
            [
                (decimal?)80m,
                (decimal?)70m,
                (decimal?)60m,
                (decimal?)50m,
                (decimal?)40m,
                (decimal?)90m,
                policySnapshotJson
            ]);
        return Assert.IsAssignableFrom<IReadOnlyList<TaskAssignmentRecommendationFactorRecord>>(result);
    }

    private static SmartAssignmentController CreateController(
        ISmartAssignmentFeedbackService feedbackService,
        int? userId)
    {
        var claims = userId.HasValue ? new[] { new Claim("userId", userId.Value.ToString()) } : [];
        var httpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(claims, authenticationType: "Test"))
        };
        httpContext.Connection.RemoteIpAddress = System.Net.IPAddress.Loopback;
        httpContext.Request.Headers.UserAgent = "test-agent";

        return new SmartAssignmentController(
            Mock.Of<ISmartAssignmentService>(),
            Mock.Of<IAdvancedSmartAssignmentService>(),
            feedbackService)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext }
        };
    }
}

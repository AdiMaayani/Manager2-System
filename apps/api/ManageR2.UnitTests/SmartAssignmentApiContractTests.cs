using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using ManageR2.Api.Authorization;
using ManageR2.Api.Controllers;
using ManageR2.Api.DTOs;
using ManageR2.Api.Features.Settings;
using ManageR2.Api.Features.Settings.DTOs;
using ManageR2.Domain.Features.SmartAssignment;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Models.SmartAssignment;
using ManageR2.Infrastructure.Services;
using ManageR2.Infrastructure.Services.SmartAssignment;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace ManageR2.UnitTests;

public class SmartAssignmentApiContractTests
{
    [Fact]
    public async Task Recommend_PreservesExistingFieldsAndMapsAdditivePolicyAndEligibilityDetails()
    {
        SmartAssignmentRequestModel? capturedRequest = null;
        var batchService = new Mock<ISmartAssignmentService>();
        batchService
            .Setup(service => service.GenerateRecommendationsAsync(
                It.IsAny<SmartAssignmentRequestModel>(),
                It.IsAny<CancellationToken>()))
            .Callback<SmartAssignmentRequestModel, CancellationToken>((request, _) => capturedRequest = request)
            .ReturnsAsync(CreateRunResult());
        var controller = CreateController(batchService);
        var request = new SmartAssignmentRequestDto
        {
            ProjectId = 17,
            WorkItemIds = [101, 102],
            PlanningDate = new DateTime(2026, 7, 20),
            IncludeLockedTasks = true,
            SaveRun = true,
            Weights = new SmartAssignmentWeightsDto
            {
                ProfessionalFit = 40m,
                Availability = 20m,
                Workload = 15m,
                Geography = 15m,
                Experience = 10m
            }
        };

        var actionResult = await controller.Recommend(request);

        var ok = Assert.IsType<OkObjectResult>(actionResult);
        var response = Assert.IsType<SmartAssignmentResponseDto>(ok.Value);
        Assert.Equal(44, response.RecommendationRunId);
        Assert.Equal(2, response.Summary.TotalTasks);
        Assert.Equal(1, response.Summary.TasksWithRecommendations);
        Assert.Equal("generated", response.Summary.Message);
        Assert.Equal("PlanningDateNotApplied", Assert.Single(response.CompatibilityWarnings));
        Assert.Equal(3, Assert.Single(response.EmployeeLoad).EmployeeId);

        var recommended = response.TaskResults[0];
        Assert.Equal(101, recommended.WorkItemId);
        Assert.Equal(3, recommended.RecommendedEmployeeId);
        Assert.Equal(88m, recommended.Score);
        Assert.Equal("Regular", recommended.PolicyProfileKey);
        Assert.Equal(7, recommended.PolicyVersion);
        var factor = Assert.Single(recommended.Factors);
        Assert.Equal("professional", factor.Key);
        Assert.Equal(31.5m, factor.WeightedContribution);
        Assert.False(factor.IsDefaulted);
        Assert.Equal(90m, factor.SourceValues["score"]);

        var noEligible = response.TaskResults[1];
        Assert.Null(noEligible.RecommendedEmployeeId);
        var alternative = Assert.IsType<SmartAssignmentCandidateDto>(noEligible.BestIneligibleAlternative);
        Assert.False(alternative.IsEligible);
        Assert.Equal("MissingCriticalSkill", Assert.Single(alternative.RejectionReasons).Code);
        Assert.Equal("ExperienceDataMissing", Assert.Single(alternative.MissingInputCodes));
        Assert.Equal("Project", alternative.PolicyProfileKey);
        Assert.Equal(5, alternative.PolicyVersion);

        Assert.NotNull(capturedRequest);
        Assert.Equal(request.ProjectId, capturedRequest.ProjectId);
        Assert.Equal(request.WorkItemIds, capturedRequest.WorkItemIds);
        Assert.Equal(request.PlanningDate, capturedRequest.PlanningDate);
        Assert.True(capturedRequest.IncludeLockedTasks);
        Assert.True(capturedRequest.SaveRun);
        Assert.Equal(
            new SmartAssignmentWeights(40m, 20m, 15m, 15m, 10m),
            capturedRequest.WeightsOverride);
        Assert.Equal(9, capturedRequest.RequestedByUserId);
    }

    [Fact]
    public async Task RecommendDraft_MapsOptionalRunWeightsIntoDraftContext()
    {
        DraftTaskRecommendationContextModel? capturedContext = null;
        var advancedService = new Mock<IAdvancedSmartAssignmentService>();
        advancedService
            .Setup(service => service.GetRecommendationsForDraftAsync(
                It.IsAny<DraftTaskRecommendationContextModel>(),
                It.IsAny<CancellationToken>()))
            .Callback<DraftTaskRecommendationContextModel, CancellationToken>(
                (context, _) => capturedContext = context)
            .ReturnsAsync(new List<EmployeeCandidateModel>());
        var controller = CreateController(new Mock<ISmartAssignmentService>(), advancedService);
        var request = new DraftTaskRecommendationRequestDto
        {
            TaskCategory = "Regular",
            PlannedStart = new DateTime(2026, 7, 20, 8, 0, 0, DateTimeKind.Utc),
            PlannedEnd = new DateTime(2026, 7, 20, 10, 0, 0, DateTimeKind.Utc),
            Weights = new SmartAssignmentWeightsDto
            {
                ProfessionalFit = 50m,
                Availability = 15m,
                Workload = 10m,
                Geography = 15m,
                Experience = 10m
            }
        };

        var actionResult = await controller.RecommendDraft(request);

        Assert.IsType<OkObjectResult>(actionResult);
        Assert.NotNull(capturedContext);
        Assert.Equal(
            new SmartAssignmentWeights(50m, 15m, 10m, 15m, 10m),
            capturedContext.WeightsOverride);
    }

    [Fact]
    public void RecommendationEndpointsAndExecutionAuthorizationRemainCompatible()
    {
        var controllerAuthorization = Assert.Single(
            typeof(SmartAssignmentController).GetCustomAttributes<AuthorizeAttribute>());
        Assert.Equal(Policies.CanManageWorkPlan, controllerAuthorization.Policy);

        var recommend = typeof(SmartAssignmentController)
            .GetMethod(nameof(SmartAssignmentController.Recommend));
        var recommendDraft = typeof(SmartAssignmentController)
            .GetMethod(nameof(SmartAssignmentController.RecommendDraft));

        Assert.Equal(
            "recommend",
            Assert.Single(recommend!.GetCustomAttributes<HttpPostAttribute>()).Template);
        Assert.Equal(
            "recommend-draft",
            Assert.Single(recommendDraft!.GetCustomAttributes<HttpPostAttribute>()).Template);

        AssertLegacyProperties<SmartAssignmentRequestDto>(
            nameof(SmartAssignmentRequestDto.ProjectId),
            nameof(SmartAssignmentRequestDto.WorkItemIds),
            nameof(SmartAssignmentRequestDto.PlanningDate),
            nameof(SmartAssignmentRequestDto.IncludeLockedTasks),
            nameof(SmartAssignmentRequestDto.SaveRun));
        Assert.NotNull(typeof(SmartAssignmentRequestDto).GetProperty(nameof(SmartAssignmentRequestDto.Weights)));
        Assert.NotNull(typeof(DraftTaskRecommendationRequestDto)
            .GetProperty(nameof(DraftTaskRecommendationRequestDto.Weights)));
        AssertLegacyProperties<SmartAssignmentTaskResultDto>(
            nameof(SmartAssignmentTaskResultDto.WorkItemId),
            nameof(SmartAssignmentTaskResultDto.TaskTitle),
            nameof(SmartAssignmentTaskResultDto.CurrentEmployeeId),
            nameof(SmartAssignmentTaskResultDto.CurrentEmployeeName),
            nameof(SmartAssignmentTaskResultDto.RecommendedEmployeeId),
            nameof(SmartAssignmentTaskResultDto.RecommendedEmployeeName),
            nameof(SmartAssignmentTaskResultDto.Score),
            nameof(SmartAssignmentTaskResultDto.Violations),
            nameof(SmartAssignmentTaskResultDto.Warnings),
            nameof(SmartAssignmentTaskResultDto.Reasons));
    }

    [Theory]
    [InlineData(nameof(SmartAssignmentSettingsController.GetProfiles), Policies.CanViewSettings)]
    [InlineData(nameof(SmartAssignmentSettingsController.GetVersionHistory), Policies.CanViewSettings)]
    [InlineData(nameof(SmartAssignmentSettingsController.Update), Policies.CanManageSettings)]
    [InlineData(nameof(SmartAssignmentSettingsController.Reset), Policies.CanManageSettings)]
    [InlineData(nameof(SmartAssignmentSettingsController.Preview), Policies.CanManageSettings)]
    public void SettingsEndpointsUseEstablishedAuthorizationPolicies(
        string methodName,
        string expectedPolicy)
    {
        var method = typeof(SmartAssignmentSettingsController).GetMethod(methodName);

        var authorization = Assert.Single(method!.GetCustomAttributes<AuthorizeAttribute>());
        Assert.Equal(expectedPolicy, authorization.Policy);
    }

    [Theory]
    [InlineData("NaN")]
    [InlineData("Infinity")]
    [InlineData("-Infinity")]
    [InlineData("1e999")]
    public void SettingsPolicyDecimalContractRejectsNonFiniteJsonNumbers(string invalidNumber)
    {
        var json = $$"""
            {
              "expectedVersion": 1,
              "displayName": "policy",
              "weights": {
                "professionalFit": {{invalidNumber}}
              }
            }
            """;

        Assert.Throws<JsonException>(() =>
            JsonSerializer.Deserialize<UpdateSmartAssignmentPolicyRequestDto>(
                json,
                new JsonSerializerOptions(JsonSerializerDefaults.Web)));
    }

    [Fact]
    public void SettingsPolicyWriteContractRequiresEveryNonOptionalBusinessFieldInJson()
    {
        var optionalFields = new HashSet<string>(StringComparer.Ordinal)
        {
            nameof(SmartAssignmentPolicyEditableDto.Description)
        };
        var editableFields = typeof(SmartAssignmentPolicyEditableDto).GetProperties();
        var weightFields = typeof(SmartAssignmentPolicyWeightsDto).GetProperties();
        var previewScoreFields = typeof(SmartAssignmentPolicyPreviewScoresDto).GetProperties();

        Assert.All(
            editableFields.Where(property => !optionalFields.Contains(property.Name)),
            property => Assert.NotNull(property.GetCustomAttribute<JsonRequiredAttribute>()));
        Assert.All(
            weightFields,
            property => Assert.NotNull(property.GetCustomAttribute<JsonRequiredAttribute>()));
        Assert.All(
            previewScoreFields,
            property => Assert.NotNull(property.GetCustomAttribute<JsonRequiredAttribute>()));
        Assert.NotNull(typeof(UpdateSmartAssignmentPolicyRequestDto)
            .GetProperty(nameof(UpdateSmartAssignmentPolicyRequestDto.ExpectedVersion))!
            .GetCustomAttribute<JsonRequiredAttribute>());
    }

    private static SmartAssignmentController CreateController(
        Mock<ISmartAssignmentService> batchService,
        Mock<IAdvancedSmartAssignmentService>? advancedService = null)
    {
        var controller = new SmartAssignmentController(
            batchService.Object,
            advancedService?.Object ?? Mock.Of<IAdvancedSmartAssignmentService>(),
            Mock.Of<ISmartAssignmentFeedbackService>());
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    [new Claim("userId", "9")],
                    authenticationType: "Test"))
            }
        };
        return controller;
    }

    private static SmartAssignmentRunResultModel CreateRunResult()
    {
        var factor = new RecommendationFactorModel
        {
            Key = "professional",
            Label = "Professional fit",
            Score = 90m,
            WeightPercent = 35m,
            WeightedContribution = 31.5m,
            Explanation = "matched",
            DataSource = "employee skills",
            HasData = true,
            IsDefaulted = false,
            SourceValues = new Dictionary<string, object?> { ["score"] = 90m }
        };
        var ineligible = new EmployeeCandidateModel
        {
            RankOrder = 1,
            EmployeeId = 8,
            FullName = "Ineligible employee",
            IsEligible = false,
            ExclusionReason = "Missing critical skill",
            TotalScore = 72m,
            RejectionReasons =
            [
                new RecommendationRejectionModel(
                    SmartAssignmentRejectionCodes.MissingCriticalSkill,
                    "Missing critical skill")
            ],
            MissingInputCodes = [SmartAssignmentMissingInputCodes.ExperienceDataMissing],
            PolicyProfileKey = "Project",
            PolicyVersion = 5,
            PolicyDisplayName = "Project policy"
        };

        return new SmartAssignmentRunResultModel
        {
            RecommendationRunId = 44,
            GeneratedAt = new DateTime(2026, 7, 18, 9, 0, 0, DateTimeKind.Utc),
            TotalTasks = 2,
            TasksWithRecommendations = 1,
            ViolationsCount = 1,
            WarningsCount = 2,
            Message = "generated",
            CompatibilityWarnings = [SmartAssignmentBatchService.PlanningDateCompatibilityWarning],
            EmployeeLoad =
            [
                new SmartAssignmentEmployeeLoadModel
                {
                    EmployeeId = 3,
                    EmployeeName = "Employee 3",
                    AssignedHours = 4m,
                    CapacityHours = 8m,
                    LoadPercentage = 50m
                }
            ],
            TaskResults =
            [
                new SmartAssignmentTaskResultModel
                {
                    WorkItemId = 101,
                    TaskTitle = "First task",
                    RecommendedEmployeeId = 3,
                    RecommendedEmployeeName = "Employee 3",
                    Score = 88m,
                    Reasons = ["best fit"],
                    Factors = [factor],
                    PolicyProfileKey = "Regular",
                    PolicyVersion = 7,
                    PolicyDisplayName = "Regular policy"
                },
                new SmartAssignmentTaskResultModel
                {
                    WorkItemId = 102,
                    TaskTitle = "Second task",
                    Violations = ["Missing critical skill"],
                    BestIneligibleAlternative = ineligible,
                    PolicyProfileKey = "Project",
                    PolicyVersion = 5,
                    PolicyDisplayName = "Project policy"
                }
            ]
        };
    }

    private static void AssertLegacyProperties<T>(params string[] names)
    {
        var actual = typeof(T).GetProperties().Select(property => property.Name).ToHashSet();
        Assert.All(names, name => Assert.Contains(name, actual));
    }
}

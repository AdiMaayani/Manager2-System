using System.Text.Json;
using ManageR2.Domain.Features.SmartAssignment;
using ManageR2.Infrastructure.Features.SmartAssignment.Scoring;
using ManageR2.Infrastructure.Models.SmartAssignment;

namespace ManageR2.UnitTests;

public class SmartAssignmentScoringEngineTests
{
    private static readonly DateTime TaskStart = new(2026, 7, 20, 8, 0, 0, DateTimeKind.Utc);
    private readonly SmartAssignmentScoringEngine _engine = new();

    [Fact]
    public void Evaluate_UsesPolicyWeightsAndContributionsReconcileWithTotal()
    {
        var input = CreateInput();
        var policy = SmartAssignmentPolicyDefaults.Create() with
        {
            ProfileKey = SmartAssignmentProfileKey.Project,
            Version = 7,
            Weights = new SmartAssignmentWeights(100m, 0m, 0m, 0m, 0m)
        };

        var candidate = Evaluate(input, policy).Candidates.Single();

        Assert.Equal(candidate.ProfessionalScore, candidate.TotalScore);
        Assert.Equal(candidate.TotalScore, candidate.Factors.Sum(factor => factor.WeightedContribution));
        Assert.Equal("Project", candidate.PolicyProfileKey);
        Assert.Equal(7, candidate.PolicyVersion);
        Assert.Contains("\"ProfileKey\":\"Project\"", candidate.PolicySnapshotJson);
    }

    [Fact]
    public void Evaluate_ContinuityNeverContributesToDefaultTotal()
    {
        var withoutHistory = CreateInput();
        var withHistory = CreateInput();
        withHistory.EmployeeContinuities.Add(new EmployeeContinuityModel
        {
            EmployeeId = 1,
            TotalPriorAssignments = 2,
            WorkedAtSiteBefore = true
        });

        var first = Evaluate(withoutHistory).Candidates.Single();
        var second = Evaluate(withHistory).Candidates.Single();

        Assert.Equal(first.TotalScore, second.TotalScore);
        var continuity = second.Factors.Single(factor => factor.Key == SmartAssignmentFactorCodes.Continuity);
        Assert.Equal(0m, continuity.WeightPercent);
        Assert.Equal(0m, continuity.WeightedContribution);
        Assert.Equal(100m, continuity.Score);
    }

    [Fact]
    public void Evaluate_ContinuityCanBreakTie()
    {
        var input = CreateInput(employeeIds: [2, 1]);
        input.EmployeeContinuities.Add(new EmployeeContinuityModel
        {
            EmployeeId = 2,
            TotalPriorAssignments = 3,
            WorkedAtSiteBefore = true
        });

        var ranked = Evaluate(input).Candidates;

        Assert.Equal(2, ranked[0].EmployeeId);
        Assert.Equal(1, ranked[1].EmployeeId);
    }

    [Fact]
    public void Evaluate_DisabledContinuityTieBreakFallsBackToEmployeeId()
    {
        var input = CreateInput(employeeIds: [2, 1]);
        input.EmployeeContinuities.Add(new EmployeeContinuityModel
        {
            EmployeeId = 2,
            TotalPriorAssignments = 3,
            WorkedAtSiteBefore = true
        });
        var policy = SmartAssignmentPolicyDefaults.Create() with { UseContinuityAsTieBreak = false };

        var ranked = Evaluate(input, policy).Candidates;

        Assert.Equal(1, ranked[0].EmployeeId);
        Assert.Equal(2, ranked[1].EmployeeId);
    }

    [Fact]
    public void Evaluate_RepeatedRunsHaveStableEmployeeIdTieBreak()
    {
        var input = CreateInput(employeeIds: [9, 3, 5]);

        var first = Evaluate(input).Candidates.Select(candidate => candidate.EmployeeId).ToArray();
        var second = Evaluate(input).Candidates.Select(candidate => candidate.EmployeeId).ToArray();

        Assert.Equal([3, 5, 9], first);
        Assert.Equal(first, second);
    }

    [Fact]
    public void Evaluate_DoesNotMutateInputCandidates()
    {
        var input = CreateInput();
        var rawCandidate = input.Employees.Single();

        var result = Evaluate(input).Candidates.Single();

        Assert.NotSame(rawCandidate, result);
        Assert.Null(rawCandidate.TotalScore);
        Assert.Null(rawCandidate.RankOrder);
        Assert.Empty(rawCandidate.Factors);
    }

    [Fact]
    public void Evaluate_MissingCriticalSkillRemainsEligibleAndWarnsOnce()
    {
        var input = CreateInput();
        input.RequiredSkills.Add(RequiredSkill(10, "Critical"));
        input.RequiredSkills.Add(RequiredSkill(10, "Critical"));

        var candidate = Evaluate(input).Candidates.Single();

        AssertDecisionSupport(candidate);
        Assert.Equal(0m, candidate.ProfessionalScore);
        Assert.Single(Warnings(candidate), warning =>
            warning.Contains("Skill 10", StringComparison.Ordinal));
        var professionalFactor = candidate.Factors.Single(factor =>
            factor.Key == SmartAssignmentFactorCodes.ProfessionalFit);
        Assert.Equal(1, Assert.IsType<int>(professionalFactor.SourceValues["requiredSkillsCount"]));
        Assert.Equal(
            ["Skill 10"],
            Assert.IsType<string[]>(professionalFactor.SourceValues["missingSkillNames"]));
    }

    [Fact]
    public void Evaluate_CriticalSkillPolicyFlagDoesNotCreateHardRejection()
    {
        var input = CreateInput();
        input.RequiredSkills.Add(RequiredSkill(10, "Critical"));
        var policy = SmartAssignmentPolicyDefaults.Create() with { MissingCriticalSkillRejects = false };

        var candidate = Evaluate(input, policy).Candidates.Single();

        AssertDecisionSupport(candidate);
        Assert.Equal(0m, candidate.ProfessionalScore);
        Assert.Single(Warnings(candidate), warning =>
            warning.Contains("Skill 10", StringComparison.Ordinal));
    }

    [Fact]
    public void Evaluate_MissingImportantSkillReducesScoreWithoutRejecting()
    {
        var input = CreateInput();
        input.RequiredSkills.Add(RequiredSkill(10, "Important"));

        var candidate = Evaluate(input).Candidates.Single();

        AssertDecisionSupport(candidate);
        Assert.Equal(0m, candidate.ProfessionalScore);
        Assert.Single(Warnings(candidate), warning =>
            warning.Contains("Skill 10", StringComparison.Ordinal));
    }

    [Fact]
    public void Evaluate_ConfiguredPolicyCanAllowRoleMismatch()
    {
        var input = CreateInput();
        input.Task!.RequiredRole = "Electrician";
        input.Employees[0].PrimaryRole = "Technician";
        var policy = SmartAssignmentPolicyDefaults.Create() with { ExactRequiredRoleMandatory = false };

        var candidate = Evaluate(input, policy).Candidates.Single();

        AssertDecisionSupport(candidate);
        Assert.Equal(0m, candidate.ProfessionalScore);
        Assert.Single(Warnings(candidate), warning =>
            warning.Contains("Electrician", StringComparison.Ordinal));
    }

    [Fact]
    public void Evaluate_DefaultPolicyKeepsRoleMismatchAsDecisionWarning()
    {
        var input = CreateInput();
        input.Task!.RequiredRole = "Electrician";
        input.Employees[0].PrimaryRole = "Technician";
        var candidate = Evaluate(input).Candidates.Single();

        AssertDecisionSupport(candidate);
        Assert.Equal(0m, candidate.ProfessionalScore);
        Assert.Single(Warnings(candidate), warning =>
            warning.Contains("Electrician", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("technician", "Technician", 100)]
    [InlineData("Technician", "Senior Technician", 0)]
    [InlineData("Electrician", "Technician", 0)]
    public void Evaluate_RoleCoverageUsesExactCaseInsensitiveMatchesOnly(
        string requiredRole,
        string employeeRole,
        int expectedScore)
    {
        var input = CreateInput();
        input.Task!.RequiredRole = requiredRole;
        input.Employees[0].PrimaryRole = employeeRole;

        var candidate = Evaluate(input).Candidates.Single();

        AssertDecisionSupport(candidate);
        Assert.Equal((decimal)expectedScore, candidate.ProfessionalScore);
    }

    [Fact]
    public void Evaluate_SkillsAndRoleKeepEightyTwentyBlend()
    {
        var input = CreateInput();
        input.Task!.RequiredRole = "Electrician";
        input.RequiredSkills.Add(RequiredSkill(10, "Important"));
        input.EmployeeSkills.Add(EmployeeSkill(1, 10, 3m));

        var candidate = Evaluate(input).Candidates.Single();

        AssertDecisionSupport(candidate);
        Assert.Equal(80m, candidate.ProfessionalScore);
        var factor = candidate.Factors.Single(item =>
            item.Key == SmartAssignmentFactorCodes.ProfessionalFit);
        Assert.Contains(
            "professionalScore = skillScore * 0.80 + roleCoverageScore * 0.20",
            Assert.IsType<string>(factor.SourceValues["formula"]));
    }

    [Fact]
    public void Evaluate_SummaryIsOneShortDecisionSentenceWithoutScoresOrRejection()
    {
        var candidate = Evaluate(CreateInput()).Candidates.Single();

        Assert.Equal(
            "המועמד מוצג להשוואה; מומלץ לעיין באזהרות לפני החלטת השיבוץ.",
            candidate.RecommendationSummary);
        Assert.DoesNotContain("100", candidate.RecommendationSummary, StringComparison.Ordinal);
        Assert.DoesNotContain("פסילה", candidate.RecommendationSummary, StringComparison.Ordinal);
    }

    [Fact]
    public void Evaluate_RanksByTotalScoreBeforeStableTieBreaks()
    {
        var input = CreateInput(employeeIds: [2, 1]);
        input.Task!.RequiredRole = "Technician";
        input.Employees.Single(employee => employee.EmployeeId == 2).PrimaryRole = "Electrician";
        var policy = SmartAssignmentPolicyDefaults.Create() with
        {
            Weights = new SmartAssignmentWeights(100m, 0m, 0m, 0m, 0m)
        };

        var ranked = Evaluate(input, policy).Candidates;

        Assert.Equal(1, ranked[0].EmployeeId);
        Assert.True(ranked[0].TotalScore > ranked[1].TotalScore);
        Assert.All(ranked, AssertDecisionSupport);
    }

    [Fact]
    public void Evaluate_MultipleRequiredProfessions_AllMustBeSatisfiedByDefault()
    {
        var input = CreateInput();
        input.Task!.RequiredRoles = ["Harness Technician", "Communications Technician"];
        input.Employees[0].Professions = ["Communications Technician", "Harness Technician"];

        var candidate = Evaluate(input).Candidates.Single();

        Assert.True(candidate.IsEligible);
        Assert.Equal(100m, candidate.ProfessionalScore);
        Assert.Equal(
            ["Communications Technician", "Harness Technician"],
            candidate.RequiredRoles);
        Assert.Equal(candidate.RequiredRoles, candidate.MatchedRoles);
        Assert.Empty(candidate.MissingRoles);
    }

    [Fact]
    public void Evaluate_MultipleRequiredProfessions_PartialMatchScoresProportionallyAndWarns()
    {
        var input = CreateInput();
        input.Task!.RequiredRoles = ["Harness Technician", "Communications Technician"];
        input.Employees[0].Professions = ["Harness Technician"];

        var candidate = Evaluate(input).Candidates.Single();

        AssertDecisionSupport(candidate);
        Assert.Equal(50m, candidate.ProfessionalScore);
        Assert.Equal(["Harness Technician"], candidate.MatchedRoles);
        Assert.Equal(["Communications Technician"], candidate.MissingRoles);
        Assert.Single(Warnings(candidate), warning =>
            warning.Contains("Communications Technician", StringComparison.Ordinal));

        var factor = candidate.Factors.Single(item =>
            item.Key == SmartAssignmentFactorCodes.ProfessionalFit);
        Assert.Equal(50m, factor.SourceValues["roleCoverageScore"]);
        Assert.Equal(1, factor.SourceValues["matchedRoleCount"]);
        Assert.Equal(2, factor.SourceValues["requiredRoleCount"]);
        Assert.Contains(
            "roleCoverageScore = matchedRoleCount / requiredRoleCount * 100",
            Assert.IsType<string>(factor.SourceValues["formula"]));
    }

    [Fact]
    public void Evaluate_DuplicateAndUnorderedRequiredProfessionsAreCanonicalized()
    {
        var input = CreateInput();
        input.Task!.RequiredRoles =
        [
            " Harness Technician ",
            "communications technician",
            "HARNESS TECHNICIAN"
        ];
        input.Employees[0].Professions =
        [
            "Communications Technician",
            "Harness Technician"
        ];

        var candidate = Evaluate(input).Candidates.Single();

        Assert.True(candidate.IsEligible);
        Assert.Equal(2, candidate.RequiredRoles.Count);
        Assert.Equal(
            ["communications technician", "Harness Technician"],
            candidate.RequiredRoles);
    }

    [Fact]
    public void Evaluate_LegacyRequiredRoleRemainsACompatibilityFallback()
    {
        var input = CreateInput();
        input.Task!.RequiredRole = "Technician";
        input.Task.RequiredRoles = [];

        var candidate = Evaluate(input).Candidates.Single();

        Assert.True(candidate.IsEligible);
        Assert.Equal(["Technician"], candidate.RequiredRoles);
        Assert.Equal(["Technician"], candidate.MatchedRoles);
    }

    [Fact]
    public void Evaluate_MissingEmployeeProfessionScoresZeroWithoutDefaultMatch()
    {
        var input = CreateInput();
        input.Task!.RequiredRoles = ["Technician"];
        input.Employees[0].PrimaryRole = null;
        input.Employees[0].Professions = [];

        var candidate = Evaluate(input).Candidates.Single();

        AssertDecisionSupport(candidate);
        Assert.Equal(0m, candidate.ProfessionalScore);
        Assert.Contains(
            SmartAssignmentMissingInputCodes.EmployeeProfessionDataMissing,
            candidate.MissingInputCodes);
        Assert.Equal(["Technician"], candidate.MissingRoles);
    }

    [Theory]
    [InlineData("Leave", "חופשה")]
    [InlineData("Sick", "מחלה")]
    [InlineData("Busy", "Busy")]
    [InlineData("Training", "הדרכה")]
    public void Evaluate_ExplicitAvailabilityConflictScoresZeroAndWarnsOnce(
        string type,
        string warningText)
    {
        var input = CreateInput();
        input.EmployeeAvailability.Add(new EmployeeAvailabilityModel
        {
            EmployeeId = 1,
            AvailableFrom = TaskStart.AddMinutes(30),
            AvailableTo = TaskStart.AddMinutes(60),
            AvailabilityType = type
        });
        var permissivePolicy = SmartAssignmentPolicyDefaults.Create() with
        {
            MissingAvailabilityMode = MissingAvailabilityMode.NeutralScore
        };

        var candidate = Evaluate(input, permissivePolicy).Candidates.Single();

        AssertDecisionSupport(candidate);
        Assert.Equal(0m, candidate.AvailabilityScore);
        var warnings = Warnings(candidate);
        Assert.Single(warnings, warning =>
            warning.Contains(warningText, StringComparison.Ordinal));
        Assert.Equal(warnings.Count, warnings.Distinct(StringComparer.Ordinal).Count());
        var availabilityFactor = candidate.Factors.Single(factor =>
            factor.Key == SmartAssignmentFactorCodes.Availability);
        Assert.Single(Assert.IsType<string[]>(availabilityFactor.SourceValues["conflictCodes"]));
    }

    [Fact]
    public void Evaluate_MissingAvailabilityUsesNeutralScoreAndWarningByDefault()
    {
        var input = CreateInput();
        input.EmployeeAvailability.Clear();

        var candidate = Evaluate(input).Candidates.Single();

        AssertDecisionSupport(candidate);
        Assert.Equal(50m, candidate.AvailabilityScore);
        Assert.Contains(SmartAssignmentMissingInputCodes.AvailabilityDataMissing, candidate.MissingInputCodes);
        Assert.True(candidate.Factors.Single(f => f.Key == SmartAssignmentFactorCodes.Availability).IsDefaulted);
    }

    [Fact]
    public void Evaluate_MissingAvailabilityRejectModeStillUsesDecisionSupportWarning()
    {
        var input = CreateInput();
        input.EmployeeAvailability.Clear();
        var policy = SmartAssignmentPolicyDefaults.Create() with
        {
            MissingAvailabilityMode = MissingAvailabilityMode.Reject
        };

        var candidate = Evaluate(input, policy).Candidates.Single();

        AssertDecisionSupport(candidate);
        Assert.Equal(50m, candidate.AvailabilityScore);
        Assert.Single(Warnings(candidate), warning =>
            string.Equals(warning, "נתוני זמינות חסרים.", StringComparison.Ordinal));
    }

    [Fact]
    public void Evaluate_PartialAvailabilityProvesScheduleNotCovered()
    {
        var input = CreateInput();
        input.EmployeeAvailability[0].AvailableTo = TaskStart.AddHours(1);

        var candidate = Evaluate(input).Candidates.Single();

        AssertDecisionSupport(candidate);
        Assert.Equal(0m, candidate.AvailabilityScore);
        Assert.Single(Warnings(candidate), warning =>
            warning.Contains("אינו מכסה", StringComparison.Ordinal));
    }

    [Fact]
    public void Evaluate_FullAvailabilityScores100()
    {
        var candidate = Evaluate(CreateInput()).Candidates.Single();

        Assert.Equal(100m, candidate.AvailabilityScore);
        AssertDecisionSupport(candidate);
    }

    [Fact]
    public void Evaluate_MissingRouteUsesConfiguredDefaultAndWarning()
    {
        var input = CreateInput();
        input.RouteEstimates.Clear();
        var policy = SmartAssignmentPolicyDefaults.Create() with { MissingRouteScore = 23m };

        var candidate = Evaluate(input, policy).Candidates.Single();

        Assert.Equal(23m, candidate.GeographicScore);
        Assert.Contains(SmartAssignmentMissingInputCodes.RouteDataMissing, candidate.MissingInputCodes);
    }

    [Fact]
    public void Evaluate_RouteWithoutMinutesIsMissingData()
    {
        var input = CreateInput();
        input.RouteEstimates[0].EstimatedTravelMinutes = null;

        var factor = Evaluate(input).Candidates.Single().Factors
            .Single(item => item.Key == SmartAssignmentFactorCodes.Geography);

        Assert.False(factor.HasData);
        Assert.True(factor.IsDefaulted);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("LegacyRouter")]
    public void Evaluate_NonGeoapifyRouteIsMissingAndClearsMeasuredValues(string? provider)
    {
        var input = CreateInput();
        input.RouteEstimates[0].RoutingProvider = provider;
        var policy = SmartAssignmentPolicyDefaults.Create() with { MissingRouteScore = 37m };

        var candidate = Evaluate(input, policy).Candidates.Single();
        var factor = candidate.Factors.Single(item =>
            item.Key == SmartAssignmentFactorCodes.Geography);

        Assert.Equal(37m, candidate.GeographicScore);
        Assert.Null(candidate.TravelMinutes);
        Assert.Null(candidate.DistanceKm);
        Assert.False(factor.HasData);
        Assert.True(factor.IsDefaulted);
        Assert.Null(factor.SourceValues["travelMinutes"]);
        Assert.Null(factor.SourceValues["distanceKm"]);
        Assert.Null(factor.SourceValues["routingProvider"]);
        Assert.Contains(SmartAssignmentMissingInputCodes.RouteDataMissing, candidate.MissingInputCodes);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0)]
    public void Evaluate_MissingOrInvalidTargetSiteDoesNotReuseAnUnscopedRoute(int? targetSiteId)
    {
        var input = CreateInput();
        input.Task!.SiteId = targetSiteId;
        var policy = SmartAssignmentPolicyDefaults.Create() with { MissingRouteScore = 41m };

        var candidate = Evaluate(input, policy).Candidates.Single();
        var factor = candidate.Factors.Single(item =>
            item.Key == SmartAssignmentFactorCodes.Geography);

        Assert.Equal(50m, candidate.GeographicScore);
        Assert.Null(candidate.TravelMinutes);
        Assert.Null(candidate.DistanceKm);
        Assert.False(factor.HasData);
        Assert.Null(factor.SourceValues["travelMinutes"]);
        Assert.Null(factor.SourceValues["distanceKm"]);
        Assert.Null(factor.SourceValues["routingProvider"]);
        Assert.Contains(SmartAssignmentMissingInputCodes.SiteAddressMissing, candidate.MissingInputCodes);
        Assert.DoesNotContain(SmartAssignmentMissingInputCodes.RouteDataMissing, candidate.MissingInputCodes);
    }

    [Fact]
    public void Evaluate_MissingSiteAddressUsesNeutralScoreAndIgnoresCachedGeoapifyRoute()
    {
        var input = CreateInput();
        input.SiteAddress = null;
        var policy = SmartAssignmentPolicyDefaults.Create() with { MissingRouteScore = 7m };

        var candidate = Evaluate(input, policy).Candidates.Single();
        var factor = candidate.Factors.Single(item =>
            item.Key == SmartAssignmentFactorCodes.Geography);

        Assert.Equal(50m, candidate.GeographicScore);
        Assert.Null(candidate.TravelMinutes);
        Assert.Null(candidate.DistanceKm);
        Assert.Equal(SmartAssignmentRouteOriginTypes.HomeBase, candidate.OriginTypeUsed);
        Assert.False(factor.HasData);
        Assert.True(factor.IsDefaulted);
        Assert.Null(factor.SourceValues["travelMinutes"]);
        Assert.Null(factor.SourceValues["distanceKm"]);
        Assert.Null(factor.SourceValues["routingProvider"]);
        Assert.Contains(SmartAssignmentMissingInputCodes.SiteAddressMissing, candidate.MissingInputCodes);
        Assert.Contains("ניטרלי", factor.Explanation, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(null, 35.21)]
    [InlineData(31.77, null)]
    [InlineData(91.0, 35.21)]
    public void Evaluate_InvalidSiteCoordinatesUseNeutralScore(
        double? latitude,
        double? longitude)
    {
        var input = CreateInput();
        input.SiteAddress!.Latitude = latitude.HasValue ? (decimal)latitude.Value : null;
        input.SiteAddress.Longitude = longitude.HasValue ? (decimal)longitude.Value : null;
        var policy = SmartAssignmentPolicyDefaults.Create() with { MissingRouteScore = 7m };

        var candidate = Evaluate(input, policy).Candidates.Single();

        Assert.Equal(50m, candidate.GeographicScore);
        Assert.Null(candidate.TravelMinutes);
        Assert.Contains(SmartAssignmentMissingInputCodes.SiteAddressMissing, candidate.MissingInputCodes);
    }

    [Fact]
    public void Evaluate_MismatchedSiteAddressUsesNeutralScore()
    {
        var input = CreateInput();
        input.SiteAddress!.SiteId = 51;

        var candidate = Evaluate(input).Candidates.Single();

        Assert.Equal(50m, candidate.GeographicScore);
        Assert.Null(candidate.TravelMinutes);
        Assert.Contains(SmartAssignmentMissingInputCodes.SiteAddressMissing, candidate.MissingInputCodes);
    }

    [Fact]
    public void Evaluate_RouteSelectionIsIndependentOfDatabaseInputOrder()
    {
        var firstInput = CreateInput();
        firstInput.RouteEstimates.Clear();
        firstInput.RouteEstimates.Add(Route(1, 60, 40m));
        firstInput.RouteEstimates.Add(Route(1, 15, 8m));

        var secondInput = CreateInput();
        secondInput.RouteEstimates.Clear();
        secondInput.RouteEstimates.Add(Route(1, 15, 8m));
        secondInput.RouteEstimates.Add(Route(1, 60, 40m));

        var first = Evaluate(firstInput).Candidates.Single();
        var second = Evaluate(secondInput).Candidates.Single();

        Assert.Equal(100m, first.GeographicScore);
        Assert.Equal(first.GeographicScore, second.GeographicScore);
        Assert.Equal(first.TotalScore, second.TotalScore);
    }

    [Fact]
    public void Evaluate_DifferentOriginRouteIsTreatedAsMissingInsteadOfMislabelled()
    {
        var input = CreateInput();
        input.RouteEstimates[0].OriginType = "PlannedStop";
        var policy = SmartAssignmentPolicyDefaults.Create() with { MissingRouteScore = 37m };

        var candidate = Evaluate(input, policy).Candidates.Single();

        Assert.Equal(37m, candidate.GeographicScore);
        Assert.Contains(SmartAssignmentMissingInputCodes.RouteDataMissing, candidate.MissingInputCodes);
        Assert.True(candidate.Factors.Single(factor =>
            factor.Key == SmartAssignmentFactorCodes.Geography).IsDefaulted);
    }

    [Fact]
    public void Evaluate_MissingEmployeeLoadUsesConfiguredDefault()
    {
        var input = CreateInput();
        input.EmployeeCurrentLoads.Clear();
        var policy = SmartAssignmentPolicyDefaults.Create() with { MissingWorkloadScore = 31m };

        var candidate = Evaluate(input, policy).Candidates.Single();

        Assert.Equal(31m, candidate.WorkloadScore);
        Assert.Contains(SmartAssignmentMissingInputCodes.WorkloadDataMissing, candidate.MissingInputCodes);
    }

    [Fact]
    public void Evaluate_CapacitySelectionIsIndependentOfDatabaseInputOrder()
    {
        var firstInput = CreateInput();
        firstInput.EmployeeCapacities.Add(Capacity(1, 20m));
        firstInput.EmployeeCapacities.Add(Capacity(1, 40m));

        var secondInput = CreateInput();
        secondInput.EmployeeCapacities.Add(Capacity(1, 40m));
        secondInput.EmployeeCapacities.Add(Capacity(1, 20m));

        var first = Evaluate(firstInput).Candidates.Single();
        var second = Evaluate(secondInput).Candidates.Single();

        Assert.Equal(first.WorkloadScore, second.WorkloadScore);
        Assert.Equal(first.TotalScore, second.TotalScore);
    }

    [Fact]
    public void Evaluate_SimulatedLoadChangesWorkloadAndRanking()
    {
        var input = CreateInput(employeeIds: [1, 2]);
        var context = new SmartAssignmentEvaluationContext(
            TaskStart.Date,
            new Dictionary<int, SimulatedWorkloadAdjustment>
            {
                [1] = new(7m, 1)
            });

        var ranked = _engine.Evaluate(input, SmartAssignmentPolicyDefaults.Create(), context).Candidates;

        Assert.Equal(2, ranked[0].EmployeeId);
        Assert.True(ranked[0].WorkloadScore > ranked[1].WorkloadScore);
    }

    [Fact]
    public void Evaluate_DisabledBatchLoadBalancingIgnoresSimulatedLoad()
    {
        var input = CreateInput(employeeIds: [1, 2]);
        var context = new SmartAssignmentEvaluationContext(
            TaskStart.Date,
            new Dictionary<int, SimulatedWorkloadAdjustment>
            {
                [1] = new(7m, 1)
            });
        var policy = SmartAssignmentPolicyDefaults.Create() with
        {
            EnableBatchSimulatedLoadBalancing = false
        };

        var ranked = _engine.Evaluate(input, policy, context).Candidates;

        Assert.Equal(1, ranked[0].EmployeeId);
        Assert.Equal(ranked[0].WorkloadScore, ranked[1].WorkloadScore);
    }

    [Fact]
    public void Evaluate_ExperienceUsesOnlyTaskRelevantSkillsWhenRequirementsExist()
    {
        var input = CreateInput();
        input.RequiredSkills.Add(RequiredSkill(10, "Important"));
        input.EmployeeSkills.Add(EmployeeSkill(1, 10, 1m));
        input.EmployeeSkills.Add(EmployeeSkill(1, 20, 10m));

        var candidate = Evaluate(input).Candidates.Single();

        Assert.Equal(50m, candidate.ExperienceScore);
    }

    [Fact]
    public void Evaluate_ExperienceUsesAllSkillsWhenNoRequirementsExist()
    {
        var input = CreateInput();
        input.EmployeeSkills.Add(EmployeeSkill(1, 10, 1m));
        input.EmployeeSkills.Add(EmployeeSkill(1, 20, 9m));

        var candidate = Evaluate(input).Candidates.Single();

        Assert.Equal(85m, candidate.ExperienceScore);
    }

    [Fact]
    public void Evaluate_NoUsableSkillsUsesConfiguredExperienceDefault()
    {
        var input = CreateInput();
        var policy = SmartAssignmentPolicyDefaults.Create() with { MissingExperienceScore = 33m };

        var candidate = Evaluate(input, policy).Candidates.Single();

        Assert.Equal(33m, candidate.ExperienceScore);
        Assert.Contains(SmartAssignmentMissingInputCodes.ExperienceDataMissing, candidate.MissingInputCodes);
    }

    [Fact]
    public void Evaluate_DraftSkillContractGapIsExposedWithoutFabricatingRequirements()
    {
        var input = CreateInput();
        input.RequiredSkillsInputAvailable = false;

        var candidate = Evaluate(input).Candidates.Single();

        Assert.Contains(SmartAssignmentMissingInputCodes.MissingRequiredSkillInput, candidate.MissingInputCodes);
        Assert.Empty(input.RequiredSkills);
    }

    [Fact]
    public void Evaluate_InactiveEmployeesAreFilteredButActiveNonAssignableEmployeesRemainCandidates()
    {
        var input = CreateInput(employeeIds: [1, 2]);
        input.Employees[0].IsActive = false;
        input.Employees[1].IsAssignable = false;

        var candidates = Evaluate(input).Candidates;

        var candidate = Assert.Single(candidates);
        Assert.Equal(2, candidate.EmployeeId);
        Assert.False(candidate.IsAssignable);
        Assert.True(candidate.IsEligible);
    }

    [Fact]
    public void Evaluate_DeduplicatesCandidatesByEmployeeIdKeepingFirstOccurrence()
    {
        var input = CreateInput(employeeIds: [1, 1, 2]);
        // Two rows share EmployeeId 1; the first occurrence must win deterministically.
        input.Employees[0].FullName = "First occurrence";
        input.Employees[1].FullName = "Second occurrence";
        // An inactive employee must still be excluded regardless of de-duplication.
        input.Employees.Add(new EmployeeCandidateModel
        {
            EmployeeId = 3,
            FullName = "Inactive",
            PrimaryRole = "Technician",
            IsActive = false,
            IsAssignable = true,
            DailyCapacityHours = 8m
        });

        var candidates = Evaluate(input).Candidates;
        var employeeIds = candidates.Select(c => c.EmployeeId).ToList();

        // Exactly one result per active EmployeeId: duplicate 1 collapsed, inactive 3 excluded.
        Assert.Equal(2, candidates.Count);
        Assert.Single(candidates, c => c.EmployeeId == 1);
        Assert.Contains(2, employeeIds);
        Assert.DoesNotContain(3, employeeIds);

        // First occurrence is used deterministically.
        var deduplicated = candidates.Single(c => c.EmployeeId == 1);
        Assert.Equal("First occurrence", deduplicated.FullName);

        // Unique candidates retain deterministic, contiguous ranking (score tie → EmployeeId ascending).
        Assert.Equal(1, candidates.Single(c => c.EmployeeId == 1).RankOrder);
        Assert.Equal(2, candidates.Single(c => c.EmployeeId == 2).RankOrder);
    }

    private static void AssertDecisionSupport(EmployeeCandidateModel candidate)
    {
        Assert.True(candidate.IsEligible);
        Assert.Null(candidate.ExclusionReason);
        Assert.Empty(candidate.RejectionReasons);
    }

    private static List<string> Warnings(EmployeeCandidateModel candidate) =>
        JsonSerializer.Deserialize<List<string>>(candidate.WarningsJson ?? "[]") ?? [];

    private SmartAssignmentEvaluationResult Evaluate(
        TaskRecommendationInputModel input,
        SmartAssignmentPolicySnapshot? policy = null) =>
        _engine.Evaluate(
            input,
            policy ?? SmartAssignmentPolicyDefaults.Create(),
            SmartAssignmentEvaluationContext.Empty(TaskStart.Date));

    private static TaskRecommendationInputModel CreateInput(int[]? employeeIds = null)
    {
        employeeIds ??= [1];
        var input = new TaskRecommendationInputModel
        {
            Task = new TaskCoreDataModel
            {
                WorkItemId = 100,
                WorkType = "Task",
                PlannedStart = TaskStart,
                PlannedEnd = TaskStart.AddHours(2),
                EstimatedHours = 2m,
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
                AvailableFrom = TaskStart.AddHours(-1),
                AvailableTo = TaskStart.AddHours(3),
                AvailabilityType = "Available"
            });
            input.EmployeeCurrentLoads.Add(new EmployeeCurrentLoadModel
            {
                EmployeeId = employeeId,
                OpenAssignmentsCount = 0,
                CurrentAssignedHours = 0m
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

    private static RequiredSkillModel RequiredSkill(int skillId, string importance) => new()
    {
        WorkItemId = 100,
        SkillId = skillId,
        SkillName = $"Skill {skillId}",
        RequiredLevel = 3,
        ImportanceLevel = importance
    };

    private static EmployeeCapacityModel Capacity(int employeeId, decimal weeklyHours) => new()
    {
        EmployeeId = employeeId,
        WeeklyCapacityHours = weeklyHours,
        EffectiveFrom = TaskStart.AddDays(-7),
        EffectiveTo = null
    };

    private static EmployeeSkillModel EmployeeSkill(int employeeId, int skillId, decimal years) => new()
    {
        EmployeeId = employeeId,
        SkillId = skillId,
        SkillLevel = 3,
        YearsExperience = years
    };

    private static RouteEstimateModel Route(int employeeId, int minutes, decimal distanceKm) => new()
    {
        EmployeeId = employeeId,
        TargetSiteId = 50,
        OriginType = "HomeBase",
        EstimatedTravelMinutes = minutes,
        EstimatedDistanceKm = distanceKm,
        RoutingProvider = "Geoapify"
    };
}

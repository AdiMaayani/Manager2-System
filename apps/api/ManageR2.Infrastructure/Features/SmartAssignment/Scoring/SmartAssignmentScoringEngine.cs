using System.Text.Json;
using System.Text.Json.Serialization;
using ManageR2.Domain.Features.Geo;
using ManageR2.Domain.Features.SmartAssignment;
using ManageR2.Infrastructure.Features.Geo.Models;
using ManageR2.Infrastructure.Models.SmartAssignment;

namespace ManageR2.Infrastructure.Features.SmartAssignment.Scoring;

/// <summary>
/// Deterministic, side-effect-free scoring engine. All data, policy and clock state are explicit inputs.
/// </summary>
public sealed class SmartAssignmentScoringEngine : ISmartAssignmentScoringEngine
{
    private const decimal NeutralGeographyScore = 50m;

    private static readonly JsonSerializerOptions PolicySnapshotJsonOptions = new()
    {
        Converters = { new JsonStringEnumConverter() }
    };

    public SmartAssignmentEvaluationResult Evaluate(
        TaskRecommendationInputModel input,
        SmartAssignmentPolicySnapshot policy,
        SmartAssignmentEvaluationContext context)
    {
        ArgumentNullException.ThrowIfNull(input);
        ArgumentNullException.ThrowIfNull(context);
        SmartAssignmentPolicyValidator.ValidateAndThrow(policy);

        var candidates = input.Employees
            .Where(employee => employee.IsActive)
            .Select(employee => EvaluateCandidate(input, employee, policy, context))
            .ToList();

        IOrderedEnumerable<EmployeeCandidateModel> ordered = candidates
            .OrderByDescending(candidate => candidate.TotalScore ?? 0m)
            .ThenByDescending(candidate => candidate.ProfessionalScore ?? 0m)
            .ThenByDescending(candidate => candidate.AvailabilityScore ?? 0m)
            .ThenByDescending(candidate => candidate.WorkloadScore ?? 0m)
            .ThenByDescending(candidate => candidate.GeographicScore ?? 0m)
            .ThenByDescending(candidate => candidate.ExperienceScore ?? 0m);

        if (policy.UseContinuityAsTieBreak)
        {
            ordered = ordered.ThenByDescending(candidate => candidate.ContinuityScore ?? 0m);
        }

        var ranked = ordered
            .ThenBy(candidate => candidate.EmployeeId)
            .ToList();

        for (var index = 0; index < ranked.Count; index++)
        {
            ranked[index].RankOrder = index + 1;
        }

        return new SmartAssignmentEvaluationResult(policy, ranked);
    }

    public SmartAssignmentEnginePreviewResult Preview(
        SmartAssignmentPolicySnapshot policy,
        SmartAssignmentEnginePreviewScores scores)
    {
        SmartAssignmentPolicyValidator.ValidateAndThrow(policy);

        var contributions = new List<SmartAssignmentEnginePreviewContribution>
        {
            CreatePreviewContribution(
                SmartAssignmentFactorCodes.ProfessionalFit,
                scores.ProfessionalFit,
                policy.Weights.ProfessionalFit),
            CreatePreviewContribution(
                SmartAssignmentFactorCodes.Availability,
                scores.Availability,
                policy.Weights.Availability),
            CreatePreviewContribution(
                SmartAssignmentFactorCodes.Workload,
                scores.Workload,
                policy.Weights.Workload),
            CreatePreviewContribution(
                SmartAssignmentFactorCodes.Geography,
                scores.Geography,
                policy.Weights.Geography),
            CreatePreviewContribution(
                SmartAssignmentFactorCodes.Experience,
                scores.Experience,
                policy.Weights.Experience)
        };

        return new SmartAssignmentEnginePreviewResult(
            contributions.Sum(contribution => contribution.WeightedContribution),
            contributions);
    }

    private static SmartAssignmentEnginePreviewContribution CreatePreviewContribution(
        string factorCode,
        decimal score,
        decimal weightPercent) =>
        new(
            factorCode,
            SmartAssignmentPolicyScoreCalculator.ClampScore(score),
            weightPercent,
            SmartAssignmentPolicyScoreCalculator.CalculateContribution(score, weightPercent));

    private static EmployeeCandidateModel EvaluateCandidate(
        TaskRecommendationInputModel input,
        EmployeeCandidateModel employee,
        SmartAssignmentPolicySnapshot policy,
        SmartAssignmentEvaluationContext context)
    {
        var professional = CalculateProfessional(input, employee, policy);
        var availability = CalculateAvailability(input, employee.EmployeeId, policy);
        var workload = CalculateWorkload(input, employee, policy, context);
        var originType = input.ResolvedRouteOriginTypes.TryGetValue(
                employee.EmployeeId,
                out var resolvedOriginType) &&
            !string.IsNullOrWhiteSpace(resolvedOriginType)
                ? resolvedOriginType
                : SmartAssignmentRouteOriginTypes.HomeBase;
        var originFormattedAddress = ResolveOriginFormattedAddress(input, employee.EmployeeId);
        var destinationFormattedAddress = ResolveDestinationFormattedAddress(input);
        var geography = CalculateGeography(input, employee.EmployeeId, originType, policy);
        var experience = CalculateExperience(input, employee.EmployeeId, policy);
        var continuity = CalculateContinuity(input, employee.EmployeeId);

        var decisionWarnings = BuildDecisionWarnings(professional, availability);

        var factors = BuildFactors(
            policy,
            professional,
            availability,
            workload,
            geography,
            experience,
            continuity,
            originType,
            originFormattedAddress,
            destinationFormattedAddress);

        // TotalScore is derived from the same contribution objects exposed to clients.
        var totalScore = factors.Sum(factor => factor.WeightedContribution);
        var missingInputCodes = factors
            .SelectMany(factor => factor.MissingInputCodes)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        var warnings = BuildWarnings(decisionWarnings, missingInputCodes);

        return new EmployeeCandidateModel
        {
            EmployeeId = employee.EmployeeId,
            FullName = employee.FullName,
            PrimaryRole = employee.PrimaryRole,
            Professions = professional.EmployeeProfessions.ToList(),
            IsActive = employee.IsActive,
            IsAssignable = employee.IsAssignable,
            DailyCapacityHours = employee.DailyCapacityHours,
            Phone = employee.Phone,
            Email = employee.Email,
            ProfessionalScore = professional.Score,
            AvailabilityScore = availability.Score,
            WorkloadScore = workload.Score,
            GeographicScore = geography.Score,
            ExperienceScore = experience.Score,
            ContinuityScore = continuity.Score,
            TotalScore = totalScore,
            IsEligible = true,
            ExclusionReason = null,
            RecommendationSummary = BuildSummary(),
            WarningsJson = JsonSerializer.Serialize(warnings),
            Factors = factors,
            OriginTypeUsed = originType,
            MatchedSkillsCount = professional.MatchedSkillsCount,
            MissingSkillsCount = professional.MissingSkillsCount,
            RequiredRoles = professional.RequiredRoles.ToList(),
            MatchedRoles = professional.MatchedRoles.ToList(),
            MissingRoles = professional.MissingRoles.ToList(),
            TravelMinutes = geography.TravelMinutes,
            DistanceKm = geography.DistanceKm,
            OpenAssignmentsCount = workload.ActualOpenAssignmentsCount,
            CurrentWorkloadHours = workload.ActualCurrentHours,
            WorkedWithCustomerBefore = continuity.Detail?.WorkedWithCustomerBefore,
            WorkedAtSiteBefore = continuity.Detail?.WorkedAtSiteBefore,
            RejectionReasons = new List<RecommendationRejectionModel>(),
            MissingInputCodes = missingInputCodes,
            PolicyProfileKey = policy.ProfileKey.ToString(),
            PolicyVersion = policy.Version,
            PolicyDisplayName = policy.DisplayName,
            PolicySnapshotJson = JsonSerializer.Serialize(policy, PolicySnapshotJsonOptions)
        };
    }

    private static ProfessionalResult CalculateProfessional(
        TaskRecommendationInputModel input,
        EmployeeCandidateModel employee,
        SmartAssignmentPolicySnapshot policy)
    {
        var requiredRoles = ProfessionCollection.Resolve(
            input.Task?.RequiredRoles is { Count: > 0 } ? input.Task.RequiredRoles : null,
            input.Task?.RequiredRole);
        var hasRole = requiredRoles.Count > 0;
        var employeeProfessions = ProfessionCollection.ResolveEmployeeProfessions(
            employee.Professions,
            employee.PrimaryRole);
        var requiredSkills = (input.RequiredSkills ?? new List<RequiredSkillModel>())
            .GroupBy(skill => skill.SkillId)
            .Select(group => group
                .OrderByDescending(skill => skill.RequiredLevel)
                .ThenByDescending(skill => GetImportanceWeight(skill.ImportanceLevel))
                .ThenBy(skill => skill.SkillName, StringComparer.OrdinalIgnoreCase)
                .First())
            .OrderBy(skill => skill.SkillId)
            .ToList();
        var hasSkills = requiredSkills.Count > 0;
        var missingSkillInputCodes = input.RequiredSkillsInputAvailable
            ? Array.Empty<string>()
            : new[] { SmartAssignmentMissingInputCodes.MissingRequiredSkillInput };

        if (!hasRole && !hasSkills)
        {
            return new ProfessionalResult(
                policy.NoRequirementsProfessionalFitScore,
                false,
                false,
                null,
                false,
                requiredRoles,
                employeeProfessions,
                Array.Empty<string>(),
                Array.Empty<string>(),
                0,
                0,
                Array.Empty<RequiredSkillModel>(),
                true,
                new[] { SmartAssignmentMissingInputCodes.NoProfessionalRequirements }
                    .Concat(missingSkillInputCodes)
                    .ToArray());
        }

        var employeeSkills = input.EmployeeSkills
            .Where(skill => skill.EmployeeId == employee.EmployeeId)
            .ToList();
        var employeeSkillsById = employeeSkills
            .GroupBy(skill => skill.SkillId)
            .ToDictionary(group => group.Key, group => group.First());

        decimal? skillScore = null;
        var matchedSkills = 0;
        var missingSkills = 0;
        var missingRequiredSkills = new List<RequiredSkillModel>();

        if (hasSkills)
        {
            decimal earnedPoints = 0m;
            decimal maximumPoints = 0m;

            foreach (var requiredSkill in requiredSkills)
            {
                var requiredLevel = requiredSkill.RequiredLevel <= 0 ? 1 : requiredSkill.RequiredLevel;
                var skillWeight = requiredLevel * GetImportanceWeight(requiredSkill.ImportanceLevel);
                maximumPoints += skillWeight;

                if (!employeeSkillsById.TryGetValue(requiredSkill.SkillId, out var employeeSkill))
                {
                    missingSkills++;
                    missingRequiredSkills.Add(requiredSkill);

                    continue;
                }

                matchedSkills++;
                var levelRatio = Math.Min((decimal)employeeSkill.SkillLevel / requiredLevel, 1m);
                earnedPoints += skillWeight * Math.Max(levelRatio, 0m);
            }

            skillScore = maximumPoints > 0m
                ? ClampScore(earnedPoints / maximumPoints * 100m)
                : policy.NoRequirementsProfessionalFitScore;
        }

        decimal? roleScore = null;
        var matchesAllRequiredRoles = false;
        IReadOnlyList<string> matchedRoles = Array.Empty<string>();
        IReadOnlyList<string> missingRoles = Array.Empty<string>();
        if (hasRole)
        {
            var employeeProfessionSet = employeeProfessions.ToHashSet(StringComparer.OrdinalIgnoreCase);
            matchedRoles = requiredRoles
                .Where(employeeProfessionSet.Contains)
                .ToArray();
            missingRoles = requiredRoles
                .Where(role => !employeeProfessionSet.Contains(role))
                .ToArray();
            matchesAllRequiredRoles = missingRoles.Count == 0;

            roleScore = ClampScore((decimal)matchedRoles.Count / requiredRoles.Count * 100m);
        }

        var score = skillScore.HasValue && roleScore.HasValue
            ? ClampScore(skillScore.Value * 0.8m + roleScore.Value * 0.2m)
            : ClampScore(skillScore ?? roleScore ?? policy.NoRequirementsProfessionalFitScore);

        return new ProfessionalResult(
            score,
            hasSkills,
            hasRole,
            roleScore,
            matchesAllRequiredRoles,
            requiredRoles,
            employeeProfessions,
            matchedRoles,
            missingRoles,
            matchedSkills,
            missingSkills,
            missingRequiredSkills,
            false,
            missingSkillInputCodes
                .Concat(hasRole && employeeProfessions.Count == 0
                    ? new[] { SmartAssignmentMissingInputCodes.EmployeeProfessionDataMissing }
                    : Array.Empty<string>())
                .ToArray());
    }

    private static AvailabilityResult CalculateAvailability(
        TaskRecommendationInputModel input,
        int employeeId,
        SmartAssignmentPolicySnapshot policy)
    {
        if (input.Task?.PlannedStart is null ||
            input.Task.PlannedEnd is null ||
            input.Task.PlannedEnd <= input.Task.PlannedStart)
        {
            return MissingAvailability(
                policy,
                SmartAssignmentMissingInputCodes.TaskScheduleMissing,
                "אין למשימה חלון זמן מלא, ולכן לא ניתן לאמת זמינות.");
        }

        var taskStart = input.Task.PlannedStart.Value;
        var taskEnd = input.Task.PlannedEnd.Value;
        var overlappingRows = input.EmployeeAvailability
            .Where(row => row.EmployeeId == employeeId &&
                IsTimeOverlapping(row.AvailableFrom, row.AvailableTo, taskStart, taskEnd))
            .ToList();

        if (overlappingRows.Count == 0)
        {
            return MissingAvailability(
                policy,
                SmartAssignmentMissingInputCodes.AvailabilityDataMissing,
                "אין נתוני זמינות לעובד בחלון המשימה.");
        }

        var rejections = new List<RecommendationRejectionModel>();
        AddAvailabilityConflictRejections(overlappingRows, rejections);
        if (rejections.Count > 0)
        {
            return new AvailabilityResult(
                0m,
                true,
                false,
                Array.Empty<string>(),
                rejections,
                "קיימת חסימת זמינות מפורשת שחופפת למשימה.");
        }

        var fullyAvailable = overlappingRows.Any(row =>
            string.Equals(row.AvailabilityType, "Available", StringComparison.OrdinalIgnoreCase) &&
            row.AvailableFrom <= taskStart &&
            row.AvailableTo >= taskEnd);

        if (fullyAvailable)
        {
            return new AvailabilityResult(
                100m,
                true,
                false,
                Array.Empty<string>(),
                Array.Empty<RecommendationRejectionModel>(),
                "העובד זמין לכל חלון הזמן של המשימה.");
        }

        return new AvailabilityResult(
            0m,
            true,
            false,
            Array.Empty<string>(),
            new[]
            {
                new RecommendationRejectionModel(
                    SmartAssignmentRejectionCodes.ScheduleNotCovered,
                    "נתוני הזמינות מוכיחים שהעובד אינו מכסה את מלוא חלון המשימה.")
            },
            "קיימים נתוני זמינות, אך אין חלון Available שמכסה את המשימה במלואה.");
    }

    private static AvailabilityResult MissingAvailability(
        SmartAssignmentPolicySnapshot policy,
        string missingInputCode,
        string explanation)
    {
        var rejections = Array.Empty<RecommendationRejectionModel>();

        var missingCodes = missingInputCode == SmartAssignmentMissingInputCodes.AvailabilityDataMissing
            ? new[] { SmartAssignmentMissingInputCodes.AvailabilityDataMissing }
            : new[]
            {
                missingInputCode,
                SmartAssignmentMissingInputCodes.AvailabilityDataMissing
            };

        return new AvailabilityResult(
            policy.MissingAvailabilityScore,
            false,
            true,
            missingCodes,
            rejections,
            $"{explanation} נעשה שימוש בציון ברירת המחדל {policy.MissingAvailabilityScore:0.##}.");
    }

    private static WorkloadResult CalculateWorkload(
        TaskRecommendationInputModel input,
        EmployeeCandidateModel employee,
        SmartAssignmentPolicySnapshot policy,
        SmartAssignmentEvaluationContext context)
    {
        var load = input.EmployeeCurrentLoads.FirstOrDefault(item => item.EmployeeId == employee.EmployeeId);
        var simulated = policy.EnableBatchSimulatedLoadBalancing
            ? context.GetSimulatedWorkload(employee.EmployeeId)
            : new SimulatedWorkloadAdjustment(0m, 0);
        var taskHours = Math.Max(input.Task?.EstimatedHours ?? 0m, 0m);

        if (load is null)
        {
            return new WorkloadResult(
                policy.MissingWorkloadScore,
                false,
                true,
                null,
                null,
                taskHours + simulated.AdditionalAssignedHours,
                null,
                null,
                simulated,
                new[] { SmartAssignmentMissingInputCodes.WorkloadDataMissing },
                $"אין נתוני עומס לעובד; נעשה שימוש בציון {policy.MissingWorkloadScore:0.##}.");
        }

        var actualHours = Math.Max(load.CurrentAssignedHours, 0m);
        var actualAssignments = Math.Max(load.OpenAssignmentsCount, 0);
        var projectedHours = actualHours + simulated.AdditionalAssignedHours + taskHours;
        var projectedAssignments = actualAssignments + simulated.AdditionalAssignments;
        var dailyCapacity = ResolveDailyCapacity(input, employee);

        if (dailyCapacity is > 0m)
        {
            var utilization = projectedHours / dailyCapacity.Value;
            var score = utilization <= 0.5m ? 100m :
                utilization <= 0.75m ? 90m :
                utilization <= 1m ? 75m :
                utilization <= 1.25m ? 50m :
                utilization <= 1.5m ? 30m : 15m;

            return new WorkloadResult(
                score,
                true,
                false,
                dailyCapacity,
                projectedAssignments,
                projectedHours,
                actualHours,
                actualAssignments,
                simulated,
                Array.Empty<string>(),
                $"עומס צפוי: {projectedHours:0.##} מתוך קיבולת יומית {dailyCapacity:0.##} שעות.");
        }

        var fallbackScore = projectedAssignments == 0 ? 90m :
            projectedAssignments <= 2 ? 75m :
            projectedAssignments <= 4 ? 55m : 35m;

        return new WorkloadResult(
            fallbackScore,
            true,
            false,
            null,
            projectedAssignments,
            projectedHours,
            actualHours,
            actualAssignments,
            simulated,
            Array.Empty<string>(),
            $"אין נתוני קיבולת; הציון מבוסס על {projectedAssignments} שיבוצים פתוחים/מדומים.");
    }

    private static GeographicResult CalculateGeography(
        TaskRecommendationInputModel input,
        int employeeId,
        string originType,
        SmartAssignmentPolicySnapshot policy)
    {
        var targetSiteId = input.Task?.SiteId ?? 0;
        var hasValidSiteAddress =
            targetSiteId > 0 &&
            input.SiteAddress is not null &&
            input.SiteAddress.SiteId == targetSiteId &&
            GeoCoordinateModel.TryCreate(
                input.SiteAddress.Latitude,
                input.SiteAddress.Longitude,
                out _);
        if (!hasValidSiteAddress)
        {
            return new GeographicResult(
                NeutralGeographyScore,
                false,
                true,
                null,
                null,
                null,
                new[] { SmartAssignmentMissingInputCodes.SiteAddressMissing },
                $"לא הוגדרה כתובת אתר תקינה למשימה; לא חושב מסלול וניתן ציון ניטרלי {NeutralGeographyScore:0.##}.");
        }

        var candidateRoutes = input.RouteEstimates
            .Where(item => item.EmployeeId == employeeId &&
                item.TargetSiteId == targetSiteId)
            .ToList();
        var exactOriginRoutes = candidateRoutes
            .Where(item => string.Equals(
                item.OriginType,
                originType,
                StringComparison.OrdinalIgnoreCase))
            .Where(item => string.Equals(
                item.RoutingProvider,
                AddressValidationConstants.Providers.Geoapify,
                StringComparison.OrdinalIgnoreCase))
            .ToList();
        // SQL result sets have no intrinsic order. Prefer a usable shortest route and then stable
        // value tie-breakers; rows identical on these values are scoring-equivalent.
        var route = exactOriginRoutes
            .OrderBy(item => item.EstimatedTravelMinutes is null or < 0)
            .ThenBy(item => item.EstimatedTravelMinutes ?? int.MaxValue)
            .ThenBy(item => !item.EstimatedDistanceKm.HasValue)
            .ThenBy(item => item.EstimatedDistanceKm ?? decimal.MaxValue)
            .ThenBy(item => item.OriginType, StringComparer.OrdinalIgnoreCase)
            .ThenBy(item => item.RoutingProvider, StringComparer.OrdinalIgnoreCase)
            .ThenByDescending(item => item.CalculatedAt)
            .FirstOrDefault();

        if (route?.EstimatedTravelMinutes is null or < 0)
        {
            return new GeographicResult(
                policy.MissingRouteScore,
                false,
                true,
                null,
                null,
                null,
                new[] { SmartAssignmentMissingInputCodes.RouteDataMissing },
                $"אין זמן נסיעה זמין; נעשה שימוש בציון {policy.MissingRouteScore:0.##}.");
        }

        var minutes = route.EstimatedTravelMinutes.Value;
        var score = SmartAssignmentTravelScoreCalculator.Calculate(minutes);

        return new GeographicResult(
            score,
            true,
            false,
            minutes,
            route.EstimatedDistanceKm,
            route.RoutingProvider,
            Array.Empty<string>(),
            $"זמן נסיעה משוער: {minutes} דקות (מקור מוצא: {originType}).");
    }

    private static string? ResolveOriginFormattedAddress(
        TaskRecommendationInputModel input,
        int employeeId)
    {
        if (input.ResolvedRouteOriginAddresses.TryGetValue(employeeId, out var resolvedAddress))
        {
            var normalizedResolvedAddress = resolvedAddress?.Trim();
            if (!string.IsNullOrWhiteSpace(normalizedResolvedAddress))
            {
                return normalizedResolvedAddress;
            }
        }

        var homeBase = input.EmployeeBaseAddresses
            .Where(item => item.EmployeeId == employeeId)
            .OrderByDescending(item => item.ZoneId.HasValue)
            .ThenBy(item => item.ZoneId)
            .ThenBy(item => item.FormattedAddress, StringComparer.OrdinalIgnoreCase)
            .ThenBy(item => item.Latitude)
            .ThenBy(item => item.Longitude)
            .FirstOrDefault();

        return ResolveDisplayAddress(homeBase?.FormattedAddress, homeBase?.City);
    }

    private static string? ResolveDestinationFormattedAddress(TaskRecommendationInputModel input)
    {
        if (input.Task?.SiteId is not > 0 ||
            input.SiteAddress is null ||
            input.SiteAddress.SiteId != input.Task.SiteId)
        {
            return null;
        }

        return ResolveDisplayAddress(input.SiteAddress.FormattedAddress, input.SiteAddress.City);
    }

    private static string? ResolveDisplayAddress(string? formattedAddress, string? city)
    {
        var normalizedAddress = formattedAddress?.Trim();
        if (!string.IsNullOrWhiteSpace(normalizedAddress))
        {
            return normalizedAddress;
        }

        var normalizedCity = city?.Trim();
        return string.IsNullOrWhiteSpace(normalizedCity) ? null : normalizedCity;
    }

    private static ExperienceResult CalculateExperience(
        TaskRecommendationInputModel input,
        int employeeId,
        SmartAssignmentPolicySnapshot policy)
    {
        var employeeSkills = input.EmployeeSkills
            .Where(skill => skill.EmployeeId == employeeId)
            .ToList();
        var requiredSkillIds = input.RequiredSkills
            .Select(skill => skill.SkillId)
            .ToHashSet();
        var relevantSkills = requiredSkillIds.Count > 0
            ? employeeSkills.Where(skill => requiredSkillIds.Contains(skill.SkillId)).ToList()
            : employeeSkills;
        var usableYears = relevantSkills
            .Where(skill => skill.YearsExperience.HasValue)
            .Select(skill => skill.YearsExperience!.Value)
            .ToList();

        if (usableYears.Count == 0)
        {
            return new ExperienceResult(
                policy.MissingExperienceScore,
                false,
                true,
                null,
                requiredSkillIds.Count > 0,
                new[] { SmartAssignmentMissingInputCodes.ExperienceDataMissing },
                $"אין שנות ניסיון שימושיות; נעשה שימוש בציון {policy.MissingExperienceScore:0.##}.");
        }

        var averageYears = usableYears.Average();
        var score = averageYears >= 8m ? 100m :
            averageYears >= 5m ? 85m :
            averageYears >= 3m ? 70m :
            averageYears >= 1m ? 50m : 30m;

        return new ExperienceResult(
            score,
            true,
            false,
            averageYears,
            requiredSkillIds.Count > 0,
            Array.Empty<string>(),
            requiredSkillIds.Count > 0
                ? $"מבוסס על {averageYears:0.##} שנות ניסיון ממוצעות בכישורים הרלוונטיים למשימה."
                : $"מבוסס על {averageYears:0.##} שנות ניסיון ממוצעות בכל כישורי העובד.");
    }

    private static ContinuityResult CalculateContinuity(TaskRecommendationInputModel input, int employeeId)
    {
        var detail = input.EmployeeContinuities.FirstOrDefault(item => item.EmployeeId == employeeId);
        if (detail is null || detail.TotalPriorAssignments == 0)
        {
            return new ContinuityResult(
                50m,
                false,
                detail,
                new[] { SmartAssignmentMissingInputCodes.ContinuityDataMissing },
                "אין היסטוריית שיבוצים קודמת; מדד הרציפות הוא 50 ואינו משפיע על הציון הכולל.");
        }

        var score = detail.WorkedAtSiteBefore ? 100m :
            detail.WorkedWithCustomerBefore ? 85m :
            detail.WorkedOnProjectBefore ? 75m : 40m;

        var explanation = detail.WorkedAtSiteBefore
            ? "העובד כבר עבד באתר זה בעבר."
            : detail.WorkedWithCustomerBefore
                ? "העובד כבר עבד עם לקוח זה בעבר."
                : detail.WorkedOnProjectBefore
                    ? "העובד כבר עבד בפרויקט זה בעבר."
                    : "קיימת היסטוריית עבודה, אך לא בהקשר הנוכחי.";

        return new ContinuityResult(score, true, detail, Array.Empty<string>(), explanation);
    }

    private static List<RecommendationFactorModel> BuildFactors(
        SmartAssignmentPolicySnapshot policy,
        ProfessionalResult professional,
        AvailabilityResult availability,
        WorkloadResult workload,
        GeographicResult geography,
        ExperienceResult experience,
        ContinuityResult continuity,
        string originType,
        string? originFormattedAddress,
        string? destinationFormattedAddress)
    {
        var factors = new List<RecommendationFactorModel>
        {
            CreateFactor(
                SmartAssignmentFactorCodes.ProfessionalFit,
                "התאמה מקצועית",
                professional.Score,
                policy.Weights.ProfessionalFit,
                professional.HasData,
                professional.IsDefaulted,
                professional.MissingInputCodes,
                "דרישות תפקיד וכישורים מול פרופיל העובד",
                professional.Explanation,
                new Dictionary<string, object?>
                {
                    ["matchedSkillsCount"] = professional.MatchedSkillsCount,
                    ["missingSkillsCount"] = professional.MissingSkillsCount,
                    ["requiredSkillsCount"] = professional.MatchedSkillsCount + professional.MissingSkillsCount,
                    ["missingSkillNames"] = professional.MissingSkills
                        .GroupBy(skill => skill.SkillId)
                        .Select(group => group.First())
                        .Select(skill => string.IsNullOrWhiteSpace(skill.SkillName)
                            ? $"כישור #{skill.SkillId}"
                            : skill.SkillName.Trim())
                        .ToArray(),
                    ["roleScore"] = professional.RoleScore,
                    ["roleCoverageScore"] = professional.RoleScore,
                    ["matchedRoleCount"] = professional.MatchedRoles.Count,
                    ["requiredRoleCount"] = professional.RequiredRoles.Count,
                    ["formula"] = BuildProfessionalFormula(professional),
                    ["requiredRoles"] = professional.RequiredRoles,
                    ["employeeProfessions"] = professional.EmployeeProfessions,
                    ["matchedRoles"] = professional.MatchedRoles,
                    ["missingRoles"] = professional.MissingRoles
                }),
            CreateFactor(
                SmartAssignmentFactorCodes.Availability,
                "זמינות",
                availability.Score,
                policy.Weights.Availability,
                availability.HasData,
                availability.IsDefaulted,
                availability.MissingInputCodes,
                "יומן זמינות העובד מול חלון המשימה",
                availability.Explanation,
                new Dictionary<string, object?>
                {
                    ["conflictCodes"] = availability.Rejections
                        .Select(rejection => rejection.Code)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToArray()
                }),
            CreateFactor(
                SmartAssignmentFactorCodes.Workload,
                "עומס עבודה",
                workload.Score,
                policy.Weights.Workload,
                workload.HasData,
                workload.IsDefaulted,
                workload.MissingInputCodes,
                "עומס, קיבולת ותוספת עומס מדומה",
                workload.Explanation,
                new Dictionary<string, object?>
                {
                    ["dailyCapacityHours"] = workload.DailyCapacityHours,
                    ["projectedHours"] = workload.ProjectedHours,
                    ["projectedAssignments"] = workload.ProjectedAssignments,
                    ["simulatedAdditionalHours"] = workload.Simulated.AdditionalAssignedHours,
                    ["simulatedAdditionalAssignments"] = workload.Simulated.AdditionalAssignments
                }),
            CreateFactor(
                SmartAssignmentFactorCodes.Geography,
                "מרחק / נסיעה",
                geography.Score,
                policy.Weights.Geography,
                geography.HasData,
                geography.IsDefaulted,
                geography.MissingInputCodes,
                "הערכת נסיעה מכתובת הבסיס של העובד אל כתובת אתר המשימה",
                geography.Explanation,
                new Dictionary<string, object?>
                {
                    ["originType"] = originType,
                    ["originFormattedAddress"] = originFormattedAddress,
                    ["destinationFormattedAddress"] = destinationFormattedAddress,
                    ["travelMinutes"] = geography.TravelMinutes,
                    ["distanceKm"] = geography.DistanceKm
                }),
            CreateFactor(
                SmartAssignmentFactorCodes.Experience,
                "ניסיון",
                experience.Score,
                policy.Weights.Experience,
                experience.HasData,
                experience.IsDefaulted,
                experience.MissingInputCodes,
                "שנות ניסיון בכישורי העובד",
                experience.Explanation,
                new Dictionary<string, object?>
                {
                    ["averageYears"] = experience.AverageYears,
                    ["taskRelevantSkillsOnly"] = experience.UsedTaskRelevantSkills
                }),
            CreateFactor(
                SmartAssignmentFactorCodes.Continuity,
                "רציפות",
                continuity.Score,
                0m,
                continuity.HasData,
                !continuity.HasData,
                continuity.MissingInputCodes,
                "שיבוצים קודמים מול הפרויקט, הלקוח והאתר",
                continuity.Explanation)
        };

        var geographyFactor = factors.Single(factor =>
            factor.Key == SmartAssignmentFactorCodes.Geography);
        geographyFactor.SourceValues["routingProvider"] = geography.RoutingProvider;
        if (geography.HasData && string.Equals(
                geography.RoutingProvider,
                AddressValidationConstants.Providers.Geoapify,
                StringComparison.OrdinalIgnoreCase))
        {
            geographyFactor.DataSource = "Geoapify travel-time routing";
        }

        return factors;
    }

    private static RecommendationFactorModel CreateFactor(
        string key,
        string label,
        decimal score,
        decimal weightPercent,
        bool hasData,
        bool isDefaulted,
        IReadOnlyList<string> missingInputCodes,
        string dataSource,
        string explanation,
        Dictionary<string, object?>? sourceValues = null)
    {
        var clampedScore = ClampScore(score);
        return new RecommendationFactorModel
        {
            Key = key,
            Label = label,
            Score = clampedScore,
            WeightPercent = weightPercent,
            WeightedContribution = SmartAssignmentPolicyScoreCalculator.CalculateContribution(
                clampedScore,
                weightPercent),
            HasData = hasData,
            IsDefaulted = isDefaulted,
            MissingInputCodes = missingInputCodes.ToList(),
            DataSource = dataSource,
            Explanation = explanation,
            SourceValues = sourceValues ?? new Dictionary<string, object?>()
        };
    }

    private static decimal? ResolveDailyCapacity(
        TaskRecommendationInputModel input,
        EmployeeCandidateModel employee)
    {
        if (employee.DailyCapacityHours is > 0m)
        {
            return employee.DailyCapacityHours;
        }

        var taskDate = input.Task?.PlannedStart?.Date;
        var capacity = input.EmployeeCapacities
            .Where(item => item.EmployeeId == employee.EmployeeId &&
                (!taskDate.HasValue ||
                    (item.EffectiveFrom.Date <= taskDate.Value &&
                     (!item.EffectiveTo.HasValue || item.EffectiveTo.Value.Date >= taskDate.Value))))
            .OrderByDescending(item => item.EffectiveFrom)
            .ThenByDescending(item => item.EffectiveTo ?? DateTime.MaxValue)
            .ThenByDescending(item => item.WeeklyCapacityHours)
            .FirstOrDefault();

        return capacity?.WeeklyCapacityHours > 0m
            ? capacity.WeeklyCapacityHours / 5m
            : null;
    }

    private static decimal GetImportanceWeight(string? importanceLevel)
    {
        if (string.Equals(importanceLevel, "Critical", StringComparison.OrdinalIgnoreCase))
        {
            return 2m;
        }

        if (string.Equals(importanceLevel, "Important", StringComparison.OrdinalIgnoreCase))
        {
            return 1.5m;
        }

        return string.Equals(importanceLevel, "Preferred", StringComparison.OrdinalIgnoreCase)
            ? 0.75m
            : 1m;
    }

    private static bool IsCritical(string? importanceLevel) =>
        string.Equals(importanceLevel, "Critical", StringComparison.OrdinalIgnoreCase);

    private static void AddAvailabilityConflictRejections(
        IEnumerable<EmployeeAvailabilityModel> rows,
        ICollection<RecommendationRejectionModel> rejections)
    {
        foreach (var type in rows
                     .Select(row => row.AvailabilityType?.Trim())
                     .Where(type => !string.IsNullOrWhiteSpace(type))
                     .Distinct(StringComparer.OrdinalIgnoreCase)
                     .OrderBy(type => type, StringComparer.OrdinalIgnoreCase))
        {
            var rejection = type!.ToUpperInvariant() switch
            {
                "LEAVE" => new RecommendationRejectionModel(
                    SmartAssignmentRejectionCodes.LeaveConflict,
                    "לעובד קיימת חופשה שחופפת למשימה."),
                "SICK" => new RecommendationRejectionModel(
                    SmartAssignmentRejectionCodes.SickConflict,
                    "לעובד קיימת מחלה שחופפת למשימה."),
                "BUSY" => new RecommendationRejectionModel(
                    SmartAssignmentRejectionCodes.BusyConflict,
                    "לעובד קיימת חסימת Busy שחופפת למשימה."),
                "TRAINING" => new RecommendationRejectionModel(
                    SmartAssignmentRejectionCodes.TrainingConflict,
                    "לעובד קיימת הדרכה שחופפת למשימה."),
                _ => null
            };

            if (rejection is not null)
            {
                rejections.Add(rejection);
            }
        }
    }

    private static bool IsTimeOverlapping(
        DateTime firstStart,
        DateTime firstEnd,
        DateTime secondStart,
        DateTime secondEnd) =>
        firstStart < secondEnd && firstEnd > secondStart;

    private static decimal ClampScore(decimal score) =>
        SmartAssignmentPolicyScoreCalculator.ClampScore(score);

    private static IReadOnlyList<string> BuildDecisionWarnings(
        ProfessionalResult professional,
        AvailabilityResult availability)
    {
        var warnings = new List<string>();

        foreach (var missingSkill in professional.MissingSkills
                     .GroupBy(skill => skill.SkillId)
                     .Select(group => group.First()))
        {
            var requirement = IsCritical(missingSkill.ImportanceLevel)
                ? "הכישור הקריטי הנדרש"
                : "הכישור הנדרש";
            warnings.Add(string.IsNullOrWhiteSpace(missingSkill.SkillName)
                ? $"לעובד חסר {requirement} (מזהה {missingSkill.SkillId})."
                : $"לעובד חסר {requirement}: {missingSkill.SkillName}.");
        }

        if (professional.UsedRole && !professional.MatchesAllRequiredRoles)
        {
            warnings.Add(professional.MissingRoles.Count == 0
                ? "מקצועות העובד אינם תואמים במדויק לכל המקצועות הנדרשים."
                : $"לעובד חסרים המקצועות הנדרשים: {string.Join(", ", professional.MissingRoles)}.");
        }

        warnings.AddRange(availability.Rejections.Select(rejection => rejection.Explanation));
        return warnings.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    private static string BuildProfessionalFormula(ProfessionalResult professional)
    {
        const string roleCoverageFormula =
            "roleCoverageScore = matchedRoleCount / requiredRoleCount * 100";

        if (professional.UsedSkills && professional.UsedRole)
        {
            return $"{roleCoverageFormula}; professionalScore = skillScore * 0.80 + roleCoverageScore * 0.20";
        }

        if (professional.UsedRole)
        {
            return $"{roleCoverageFormula}; professionalScore = roleCoverageScore";
        }

        return professional.UsedSkills
            ? "professionalScore = skillScore"
            : "professionalScore = configuredNoRequirementsScore";
    }

    private static List<string> BuildWarnings(
        IEnumerable<string> decisionWarnings,
        IEnumerable<string> missingInputCodes)
    {
        var warnings = decisionWarnings.ToList();
        warnings.AddRange(missingInputCodes.Select(code => code switch
        {
            SmartAssignmentMissingInputCodes.AvailabilityDataMissing => "נתוני זמינות חסרים.",
            SmartAssignmentMissingInputCodes.TaskScheduleMissing => "חלון הזמן של המשימה חסר.",
            SmartAssignmentMissingInputCodes.SiteAddressMissing => "כתובת אתר המשימה חסרה או אינה תקינה; ניתן ציון נסיעה ניטרלי.",
            SmartAssignmentMissingInputCodes.RouteDataMissing => "נתוני מסלול חסרים.",
            SmartAssignmentMissingInputCodes.WorkloadDataMissing => "נתוני עומס חסרים.",
            SmartAssignmentMissingInputCodes.ExperienceDataMissing => "נתוני ניסיון חסרים.",
            SmartAssignmentMissingInputCodes.MissingRequiredSkillInput => "דרישות הכישורים לא הועברו.",
            SmartAssignmentMissingInputCodes.EmployeeProfessionDataMissing => "לא הוגדרו לעובד נתוני מקצוע.",
            _ => string.Empty
        }).Where(message => message.Length > 0));

        return warnings.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    private static string BuildSummary() =>
        "המועמד מוצג להשוואה; מומלץ לעיין באזהרות לפני החלטת השיבוץ.";

    private sealed record ProfessionalResult(
        decimal Score,
        bool UsedSkills,
        bool UsedRole,
        decimal? RoleScore,
        bool MatchesAllRequiredRoles,
        IReadOnlyList<string> RequiredRoles,
        IReadOnlyList<string> EmployeeProfessions,
        IReadOnlyList<string> MatchedRoles,
        IReadOnlyList<string> MissingRoles,
        int MatchedSkillsCount,
        int MissingSkillsCount,
        IReadOnlyList<RequiredSkillModel> MissingSkills,
        bool IsDefaulted,
        IReadOnlyList<string> MissingInputCodes)
    {
        public bool HasData => UsedSkills || UsedRole;

        public string Explanation => !HasData
            ? $"למשימה אין דרישת תפקיד או כישורים; נעשה שימוש בציון {Score:0.##}."
            : $"התאימו {MatchedSkillsCount} כישורים ונמצאו {MissingSkillsCount} כישורים חסרים" +
              (RoleScore.HasValue
                  ? $"; הותאמו {MatchedRoles.Count} מתוך {RequiredRoles.Count} מקצועות נדרשים וציון התאמת המקצועות הוא {RoleScore:0.##}."
                  : ".");
    }

    private sealed record AvailabilityResult(
        decimal Score,
        bool HasData,
        bool IsDefaulted,
        IReadOnlyList<string> MissingInputCodes,
        IReadOnlyList<RecommendationRejectionModel> Rejections,
        string Explanation);

    private sealed record WorkloadResult(
        decimal Score,
        bool HasData,
        bool IsDefaulted,
        decimal? DailyCapacityHours,
        int? ProjectedAssignments,
        decimal ProjectedHours,
        decimal? ActualCurrentHours,
        int? ActualOpenAssignmentsCount,
        SimulatedWorkloadAdjustment Simulated,
        IReadOnlyList<string> MissingInputCodes,
        string Explanation);

    private sealed record GeographicResult(
        decimal Score,
        bool HasData,
        bool IsDefaulted,
        int? TravelMinutes,
        decimal? DistanceKm,
        string? RoutingProvider,
        IReadOnlyList<string> MissingInputCodes,
        string Explanation);

    private sealed record ExperienceResult(
        decimal Score,
        bool HasData,
        bool IsDefaulted,
        decimal? AverageYears,
        bool UsedTaskRelevantSkills,
        IReadOnlyList<string> MissingInputCodes,
        string Explanation);

    private sealed record ContinuityResult(
        decimal Score,
        bool HasData,
        EmployeeContinuityModel? Detail,
        IReadOnlyList<string> MissingInputCodes,
        string Explanation);
}

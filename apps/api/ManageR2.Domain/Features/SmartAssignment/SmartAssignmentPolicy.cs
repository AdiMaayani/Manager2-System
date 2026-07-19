namespace ManageR2.Domain.Features.SmartAssignment;

public enum SmartAssignmentProfileKey
{
    Default = 0,
    Regular = 1,
    Project = 2,
    ServiceCall = 3
}

public enum MissingAvailabilityMode
{
    NeutralScore = 0,
    Reject = 1
}

/// <summary>
/// Canonical percentage weights used by the runtime scoring engine.
/// Values are percentages and must total exactly 100 within the policy validator tolerance.
/// </summary>
public sealed record SmartAssignmentWeights(
    decimal ProfessionalFit,
    decimal Availability,
    decimal Workload,
    decimal Geography,
    decimal Experience)
{
    public decimal Total => ProfessionalFit + Availability + Workload + Geography + Experience;
}

/// <summary>
/// One validated, immutable policy version used for a complete recommendation calculation.
/// </summary>
public sealed record SmartAssignmentPolicySnapshot(
    SmartAssignmentProfileKey ProfileKey,
    string DisplayName,
    string? Description,
    int Version,
    SmartAssignmentWeights Weights,
    bool MissingCriticalSkillRejects,
    bool ExactRequiredRoleMandatory,
    MissingAvailabilityMode MissingAvailabilityMode,
    decimal MissingAvailabilityScore,
    decimal MissingRouteScore,
    decimal MissingWorkloadScore,
    decimal MissingExperienceScore,
    decimal NoRequirementsProfessionalFitScore,
    bool UseContinuityAsTieBreak,
    bool EnableBatchSimulatedLoadBalancing,
    DateTime? UpdatedAtUtc = null,
    int? UpdatedByUserId = null);

public static class SmartAssignmentPolicyDefaults
{
    public const decimal WeightTolerance = 0.0001m;

    public static SmartAssignmentPolicySnapshot Create(
        SmartAssignmentProfileKey profileKey = SmartAssignmentProfileKey.Default,
        int version = 0,
        string? displayName = null,
        string? description = null)
    {
        return new SmartAssignmentPolicySnapshot(
            ProfileKey: profileKey,
            DisplayName: displayName ?? GetDefaultDisplayName(profileKey),
            Description: description,
            Version: version,
            Weights: new SmartAssignmentWeights(
                ProfessionalFit: 35m,
                Availability: 25m,
                Workload: 15m,
                Geography: 15m,
                Experience: 10m),
            MissingCriticalSkillRejects: true,
            ExactRequiredRoleMandatory: true,
            MissingAvailabilityMode: MissingAvailabilityMode.NeutralScore,
            MissingAvailabilityScore: 50m,
            MissingRouteScore: 50m,
            MissingWorkloadScore: 50m,
            MissingExperienceScore: 40m,
            NoRequirementsProfessionalFitScore: 50m,
            UseContinuityAsTieBreak: true,
            EnableBatchSimulatedLoadBalancing: true);
    }

    public static string GetDefaultDisplayName(SmartAssignmentProfileKey profileKey)
    {
        return profileKey switch
        {
            SmartAssignmentProfileKey.Default => "ברירת מחדל",
            SmartAssignmentProfileKey.Regular => "משימה כללית",
            SmartAssignmentProfileKey.Project => "משימת פרויקט",
            SmartAssignmentProfileKey.ServiceCall => "קריאת שירות",
            _ => "מדיניות שיבוץ חכם"
        };
    }
}

public sealed record SmartAssignmentPolicyValidationError(
    string Field,
    string Code,
    string Message);

public sealed record SmartAssignmentPolicyValidationResult(
    IReadOnlyList<SmartAssignmentPolicyValidationError> Errors)
{
    public bool IsValid => Errors.Count == 0;
}

public sealed class SmartAssignmentPolicyValidationException : ArgumentException
{
    public SmartAssignmentPolicyValidationException(
        IReadOnlyList<SmartAssignmentPolicyValidationError> errors)
        : base(string.Join(" ", errors.Select(error => error.Message)))
    {
        Errors = errors;
    }

    public IReadOnlyList<SmartAssignmentPolicyValidationError> Errors { get; }
}

/// <summary>
/// Pure server-side validation for both persisted policies and unsaved preview snapshots.
/// </summary>
public static class SmartAssignmentPolicyValidator
{
    public static SmartAssignmentPolicyValidationResult Validate(SmartAssignmentPolicySnapshot? policy)
    {
        var errors = new List<SmartAssignmentPolicyValidationError>();

        if (policy is null)
        {
            errors.Add(new("Policy", "PolicyRequired", "Smart Assignment policy is required."));
            return new SmartAssignmentPolicyValidationResult(errors);
        }

        if (!Enum.IsDefined(policy.ProfileKey))
        {
            errors.Add(new(nameof(policy.ProfileKey), "InvalidProfileKey", "Policy profile key is invalid."));
        }

        if (string.IsNullOrWhiteSpace(policy.DisplayName))
        {
            errors.Add(new(nameof(policy.DisplayName), "DisplayNameRequired", "Policy display name is required."));
        }

        if (policy.Version < 0)
        {
            errors.Add(new(nameof(policy.Version), "InvalidVersion", "Policy version cannot be negative."));
        }

        if (policy.Weights is null)
        {
            errors.Add(new(nameof(policy.Weights), "WeightsRequired", "All scoring weights are required."));
        }
        else
        {
            ValidateWeight(policy.Weights.ProfessionalFit, nameof(policy.Weights.ProfessionalFit), errors);
            ValidateWeight(policy.Weights.Availability, nameof(policy.Weights.Availability), errors);
            ValidateWeight(policy.Weights.Workload, nameof(policy.Weights.Workload), errors);
            ValidateWeight(policy.Weights.Geography, nameof(policy.Weights.Geography), errors);
            ValidateWeight(policy.Weights.Experience, nameof(policy.Weights.Experience), errors);

            if (Math.Abs(policy.Weights.Total - 100m) > SmartAssignmentPolicyDefaults.WeightTolerance)
            {
                errors.Add(new(
                    nameof(policy.Weights),
                    "WeightTotalMustEqual100",
                    "Scoring weights must total 100%."));
            }
        }

        if (!Enum.IsDefined(policy.MissingAvailabilityMode))
        {
            errors.Add(new(
                nameof(policy.MissingAvailabilityMode),
                "InvalidMissingAvailabilityMode",
                "Missing availability mode is invalid."));
        }

        ValidateScore(policy.MissingAvailabilityScore, nameof(policy.MissingAvailabilityScore), errors);
        ValidateScore(policy.MissingRouteScore, nameof(policy.MissingRouteScore), errors);
        ValidateScore(policy.MissingWorkloadScore, nameof(policy.MissingWorkloadScore), errors);
        ValidateScore(policy.MissingExperienceScore, nameof(policy.MissingExperienceScore), errors);
        ValidateScore(
            policy.NoRequirementsProfessionalFitScore,
            nameof(policy.NoRequirementsProfessionalFitScore),
            errors);

        return new SmartAssignmentPolicyValidationResult(errors);
    }

    public static void ValidateAndThrow(SmartAssignmentPolicySnapshot? policy)
    {
        var result = Validate(policy);
        if (!result.IsValid)
        {
            throw new SmartAssignmentPolicyValidationException(result.Errors);
        }
    }

    private static void ValidateWeight(
        decimal value,
        string field,
        ICollection<SmartAssignmentPolicyValidationError> errors)
    {
        // Decimal values are finite by construction; only the non-negative invariant remains here.
        if (value < 0m)
        {
            errors.Add(new(field, "WeightMustBeNonNegative", $"{field} weight cannot be negative."));
        }

        if (decimal.Round(value, 2) != value)
        {
            errors.Add(new(
                field,
                "WeightScaleExceeded",
                $"{field} weight cannot have more than two decimal places."));
        }
    }

    private static void ValidateScore(
        decimal value,
        string field,
        ICollection<SmartAssignmentPolicyValidationError> errors)
    {
        if (value is < 0m or > 100m)
        {
            errors.Add(new(field, "ScoreOutOfRange", $"{field} must be between 0 and 100."));
        }


        if (decimal.Round(value, 2) != value)
        {
            errors.Add(new(
                field,
                "ScoreScaleExceeded",
                $"{field} cannot have more than two decimal places."));
        }
    }
}

public static class SmartAssignmentFactorCodes
{
    public const string ProfessionalFit = "professional";
    public const string Availability = "availability";
    public const string Workload = "workload";
    public const string Geography = "geographic";
    public const string Experience = "experience";
    public const string Continuity = "continuity";
}

public static class SmartAssignmentRejectionCodes
{
    public const string InactiveEmployee = "InactiveEmployee";
    public const string NonAssignableEmployee = "NonAssignableEmployee";
    public const string MissingCriticalSkill = "MissingCriticalSkill";
    public const string RequiredRoleMismatch = "RequiredRoleMismatch";
    public const string LeaveConflict = "LeaveConflict";
    public const string SickConflict = "SickConflict";
    public const string BusyConflict = "BusyConflict";
    public const string TrainingConflict = "TrainingConflict";
    public const string ScheduleNotCovered = "ScheduleNotCovered";
    public const string MissingAvailabilityRejected = "MissingAvailabilityRejected";
}

public static class SmartAssignmentMissingInputCodes
{
    public const string AvailabilityDataMissing = "AvailabilityDataMissing";
    public const string TaskScheduleMissing = "TaskScheduleMissing";
    public const string SiteAddressMissing = "SiteAddressMissing";
    public const string RouteDataMissing = "RouteDataMissing";
    public const string WorkloadDataMissing = "WorkloadDataMissing";
    public const string ExperienceDataMissing = "ExperienceDataMissing";
    public const string NoProfessionalRequirements = "NoProfessionalRequirements";
    public const string ContinuityDataMissing = "ContinuityDataMissing";
    public const string MissingRequiredSkillInput = "MissingRequiredSkillInput";
    public const string EmployeeProfessionDataMissing = "EmployeeProfessionDataMissing";
}

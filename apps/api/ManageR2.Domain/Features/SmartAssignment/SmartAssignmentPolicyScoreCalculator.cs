namespace ManageR2.Domain.Features.SmartAssignment;

/// <summary>
/// Shared arithmetic for runtime scoring and unsaved settings previews.
/// </summary>
public static class SmartAssignmentPolicyScoreCalculator
{
    public static decimal ClampScore(decimal score) => Math.Clamp(score, 0m, 100m);

    public static decimal CalculateContribution(decimal score, decimal weightPercent) =>
        ClampScore(score) * weightPercent / 100m;
}

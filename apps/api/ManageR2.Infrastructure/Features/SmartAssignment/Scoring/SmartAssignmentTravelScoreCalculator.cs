namespace ManageR2.Infrastructure.Features.SmartAssignment.Scoring;

/// <summary>
/// Canonical deterministic travel-time bands used by Smart Assignment.
/// </summary>
public static class SmartAssignmentTravelScoreCalculator
{
    public static decimal Calculate(int travelMinutes)
    {
        if (travelMinutes < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(travelMinutes));
        }

        return travelMinutes <= 15 ? 100m :
            travelMinutes <= 30 ? 90m :
            travelMinutes <= 45 ? 75m :
            travelMinutes <= 60 ? 60m :
            travelMinutes <= 90 ? 35m : 15m;
    }
}

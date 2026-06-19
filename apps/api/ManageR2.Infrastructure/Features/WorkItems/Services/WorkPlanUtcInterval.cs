namespace ManageR2.Infrastructure.Features.WorkItems.Services;

public static class WorkPlanUtcInterval
{
    public static bool OverlapsVisibleRange(
        DateTime fromUtc,
        DateTime toUtc,
        DateTime plannedStartUtc,
        DateTime plannedEndUtc)
    {
        if (toUtc <= fromUtc)
        {
            throw new ArgumentException("UTC range end must be later than start.");
        }

        if (plannedEndUtc <= plannedStartUtc)
        {
            return false;
        }

        return plannedStartUtc < toUtc && plannedEndUtc > fromUtc;
    }
}

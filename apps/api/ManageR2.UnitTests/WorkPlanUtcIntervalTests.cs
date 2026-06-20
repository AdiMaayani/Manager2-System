using ManageR2.Infrastructure.Features.WorkItems.Services;

namespace ManageR2.UnitTests;

public class WorkPlanUtcIntervalTests
{
    [Fact]
    public void OverlapsVisibleRange_MatchesIntervalPredicate()
    {
        var fromUtc = new DateTime(2026, 6, 19, 0, 0, 0, DateTimeKind.Utc);
        var toUtc = fromUtc.AddDays(1);

        Assert.True(WorkPlanUtcInterval.OverlapsVisibleRange(
            fromUtc,
            toUtc,
            fromUtc.AddHours(10),
            fromUtc.AddHours(12)));

        Assert.False(WorkPlanUtcInterval.OverlapsVisibleRange(
            fromUtc,
            toUtc,
            toUtc.AddHours(1),
            toUtc.AddHours(3)));
    }

    [Fact]
    public void OverlapsVisibleRange_RejectsInvalidPlannedRange()
    {
        var fromUtc = new DateTime(2026, 6, 19, 0, 0, 0, DateTimeKind.Utc);
        var toUtc = fromUtc.AddDays(1);
        var sameTime = fromUtc.AddHours(5);

        Assert.False(WorkPlanUtcInterval.OverlapsVisibleRange(fromUtc, toUtc, sameTime, sameTime));
    }
}

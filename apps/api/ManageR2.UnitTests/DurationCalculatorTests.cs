using ManageR2.Infrastructure.Features.WorkItems.Services;

namespace ManageR2.UnitTests;

public class DurationCalculatorTests
{
    [Fact]
    public void Calculate_ReturnsExpectedHoursForTwoHourSpan()
    {
        var start = new DateTime(2026, 6, 19, 8, 0, 0, DateTimeKind.Utc);
        var end = start.AddHours(2);

        var result = DurationCalculator.Calculate(start, end);

        Assert.Equal(120, result.TotalMinutes);
        Assert.Equal(2m, result.EstimatedHours);
    }

    [Fact]
    public void Calculate_AllowsMidnightCrossing()
    {
        var start = new DateTime(2026, 6, 19, 22, 0, 0, DateTimeKind.Utc);
        var end = new DateTime(2026, 6, 20, 2, 0, 0, DateTimeKind.Utc);

        var result = DurationCalculator.Calculate(start, end);

        Assert.Equal(240, result.TotalMinutes);
        Assert.Equal(4m, result.EstimatedHours);
    }

    [Fact]
    public void Calculate_ThrowsWhenEndIsNotAfterStart()
    {
        var start = new DateTime(2026, 6, 19, 10, 0, 0, DateTimeKind.Utc);

        Assert.Throws<ArgumentException>(() => DurationCalculator.Calculate(start, start));
        Assert.Throws<ArgumentException>(() => DurationCalculator.Calculate(start, start.AddMinutes(-5)));
    }

    [Fact]
    public void TryCalculate_ReturnsNullWhenEitherBoundMissing()
    {
        var start = new DateTime(2026, 6, 19, 10, 0, 0, DateTimeKind.Utc);

        Assert.Null(DurationCalculator.TryCalculate(null, start));
        Assert.Null(DurationCalculator.TryCalculate(start, null));
    }
}

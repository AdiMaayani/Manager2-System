namespace ManageR2.Infrastructure.Features.WorkItems.Services;

public static class DurationCalculator
{
    public sealed record DurationResult(int TotalMinutes, decimal EstimatedHours, string HumanReadable);

    public static DurationResult Calculate(DateTime plannedStartUtc, DateTime plannedEndUtc)
    {
        if (plannedEndUtc <= plannedStartUtc)
        {
            throw new ArgumentException("Planned end must be later than planned start.");
        }

        var totalMinutes = (int)Math.Floor((plannedEndUtc - plannedStartUtc).TotalMinutes);
        var estimatedHours = Math.Round(totalMinutes / 60m, 2);
        var humanReadable = FormatHumanReadable(totalMinutes);

        return new DurationResult(totalMinutes, estimatedHours, humanReadable);
    }

    public static DurationResult? TryCalculate(DateTime? plannedStartUtc, DateTime? plannedEndUtc)
    {
        if (!plannedStartUtc.HasValue || !plannedEndUtc.HasValue)
        {
            return null;
        }

        return Calculate(plannedStartUtc.Value, plannedEndUtc.Value);
    }

    private static string FormatHumanReadable(int totalMinutes)
    {
        if (totalMinutes <= 0)
        {
            return "0 דקות";
        }

        var days = totalMinutes / (24 * 60);
        var hours = (totalMinutes % (24 * 60)) / 60;
        var minutes = totalMinutes % 60;

        if (days > 0)
        {
            return hours > 0 || minutes > 0
                ? $"{days} ימים, {hours} שעות, {minutes} דקות"
                : $"{days} ימים";
        }

        if (hours > 0)
        {
            return minutes > 0 ? $"{hours} שעות, {minutes} דקות" : $"{hours} שעות";
        }

        return $"{minutes} דקות";
    }
}

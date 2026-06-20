namespace ManageR2.Infrastructure.Features.WorkItems.Services;

public static class UtcDateTimeNormalizer
{
    public static DateTime NormalizeToUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            DateTimeKind.Unspecified => throw new ArgumentException(
                "Datetime must include an explicit UTC offset or Z suffix."),
            _ => throw new ArgumentException("Unsupported datetime kind.")
        };
    }

    public static DateTime? NormalizeOptionalToUtc(DateTime? value)
    {
        return value.HasValue ? NormalizeToUtc(value.Value) : null;
    }

    public static (DateTime? StartUtc, DateTime? EndUtc) NormalizePlannedRange(DateTime? start, DateTime? end)
    {
        if (!start.HasValue && !end.HasValue)
        {
            return (null, null);
        }

        if (!start.HasValue || !end.HasValue)
        {
            throw new ArgumentException("Planned start and end must both be supplied or both be null.");
        }

        var startUtc = NormalizeToUtc(start.Value);
        var endUtc = NormalizeToUtc(end.Value);

        if (endUtc <= startUtc)
        {
            throw new ArgumentException("Planned end must be later than planned start.");
        }

        return (startUtc, endUtc);
    }
}

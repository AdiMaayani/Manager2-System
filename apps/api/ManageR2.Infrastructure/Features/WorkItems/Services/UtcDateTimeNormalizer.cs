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

    /// <summary>
    /// Marks a persisted database DateTime as UTC for API responses.
    /// SQL Server datetime values are typically Unspecified; treat that wall-clock as UTC
    /// (do not convert via ToUniversalTime / server-local timezone).
    /// </summary>
    public static DateTime MarkStoredAsUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Unspecified => DateTime.SpecifyKind(value, DateTimeKind.Utc),
            DateTimeKind.Local => throw new ArgumentException(
                "Persisted datetime must not use DateTimeKind.Local; expected Unspecified or Utc."),
            _ => throw new ArgumentException("Unsupported datetime kind.")
        };
    }

    public static DateTime? MarkStoredAsUtc(DateTime? value)
    {
        return value.HasValue ? MarkStoredAsUtc(value.Value) : null;
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

using ManageR2.Infrastructure.Features.WorkItems.Services;

namespace ManageR2.UnitTests;

public class UtcDateTimeNormalizerTests
{
    [Fact]
    public void NormalizeToUtc_PreservesUtcValues()
    {
        var utc = new DateTime(2026, 6, 19, 12, 0, 0, DateTimeKind.Utc);

        var normalized = UtcDateTimeNormalizer.NormalizeToUtc(utc);

        Assert.Equal(DateTimeKind.Utc, normalized.Kind);
        Assert.Equal(utc, normalized);
    }

    [Fact]
    public void NormalizeToUtc_ConvertsLocalToUtc()
    {
        var local = new DateTime(2026, 6, 19, 15, 0, 0, DateTimeKind.Local);

        var normalized = UtcDateTimeNormalizer.NormalizeToUtc(local);

        Assert.Equal(DateTimeKind.Utc, normalized.Kind);
    }

    [Fact]
    public void NormalizeToUtc_ThrowsForUnspecifiedKind()
    {
        var unspecified = new DateTime(2026, 6, 19, 15, 0, 0, DateTimeKind.Unspecified);

        Assert.Throws<ArgumentException>(() => UtcDateTimeNormalizer.NormalizeToUtc(unspecified));
    }

    [Fact]
    public void NormalizePlannedRange_ReturnsUtcPairWhenBothBoundsProvided()
    {
        var start = new DateTime(2026, 6, 19, 8, 0, 0, DateTimeKind.Utc);
        var end = start.AddHours(2);

        var (startUtc, endUtc) = UtcDateTimeNormalizer.NormalizePlannedRange(start, end);

        Assert.Equal(start, startUtc);
        Assert.Equal(end, endUtc);
    }

    [Fact]
    public void NormalizePlannedRange_AllowsBothNull()
    {
        var (startUtc, endUtc) = UtcDateTimeNormalizer.NormalizePlannedRange(null, null);

        Assert.Null(startUtc);
        Assert.Null(endUtc);
    }
}

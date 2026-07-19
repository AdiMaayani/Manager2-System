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

    [Fact]
    public void MarkStoredAsUtc_PreservesUtcValues()
    {
        var utc = new DateTime(2026, 7, 19, 9, 33, 0, DateTimeKind.Utc);

        var marked = UtcDateTimeNormalizer.MarkStoredAsUtc(utc);

        Assert.Equal(DateTimeKind.Utc, marked.Kind);
        Assert.Equal(utc, marked);
    }

    [Fact]
    public void MarkStoredAsUtc_TreatsUnspecifiedAsUtcWithoutShifting()
    {
        var unspecified = new DateTime(2026, 7, 19, 9, 33, 0, DateTimeKind.Unspecified);

        var marked = UtcDateTimeNormalizer.MarkStoredAsUtc(unspecified);

        Assert.Equal(DateTimeKind.Utc, marked.Kind);
        Assert.Equal(unspecified.Ticks, marked.Ticks);
    }

    [Fact]
    public void MarkStoredAsUtc_RejectsLocalKind()
    {
        var local = new DateTime(2026, 7, 19, 12, 33, 0, DateTimeKind.Local);

        var ex = Assert.Throws<ArgumentException>(() => UtcDateTimeNormalizer.MarkStoredAsUtc(local));
        Assert.Contains("DateTimeKind.Local", ex.Message);
    }

    [Fact]
    public void MarkStoredAsUtc_OptionalNullRemainsNull()
    {
        Assert.Null(UtcDateTimeNormalizer.MarkStoredAsUtc((DateTime?)null));
    }

    [Fact]
    public void NormalizeToUtc_StillRejectsOffsetLessUnspecifiedInput()
    {
        var unspecified = new DateTime(2026, 7, 19, 12, 33, 0, DateTimeKind.Unspecified);

        var ex = Assert.Throws<ArgumentException>(() => UtcDateTimeNormalizer.NormalizeToUtc(unspecified));
        Assert.Contains("explicit UTC offset or Z suffix", ex.Message);
    }
}

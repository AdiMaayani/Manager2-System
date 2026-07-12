using System.Text.Json;

namespace ManageR2.Infrastructure.DAL.Providers;

// Baseline parity comparer: serializes both payloads with identical, culture-invariant options
// and compares the canonical form. Because both sides are the same CLR type T, property order is
// stable, so a byte difference indicates a value difference. Domain-specific normalization
// (order-insensitive lists, decimal-by-value, provider-assigned ids) is layered on per wave by
// wrapping this comparer or projecting to a normalized shape before comparison.
public sealed class JsonPayloadParityComparer : IPayloadParityComparer
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        WriteIndented = false,
        // Stable, culture-independent output so comparison does not depend on the host locale.
        PropertyNamingPolicy = null
    };

    public ParityComparisonResult Compare<T>(T? primary, T? shadow)
    {
        if (primary is null && shadow is null)
        {
            return ParityComparisonResult.Match;
        }

        if (primary is null || shadow is null)
        {
            return ParityComparisonResult.Mismatch(
                $"Null mismatch: primary={(primary is null ? "null" : "value")}, shadow={(shadow is null ? "null" : "value")}");
        }

        var primaryJson = JsonSerializer.Serialize(primary, SerializerOptions);
        var shadowJson = JsonSerializer.Serialize(shadow, SerializerOptions);

        return string.Equals(primaryJson, shadowJson, StringComparison.Ordinal)
            ? ParityComparisonResult.Match
            : ParityComparisonResult.Mismatch("Serialized payloads differ after normalization.");
    }
}

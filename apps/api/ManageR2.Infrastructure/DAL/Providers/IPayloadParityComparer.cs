namespace ManageR2.Infrastructure.DAL.Providers;

public sealed record ParityComparisonResult(bool IsMatch, string? DiffSummary)
{
    public static ParityComparisonResult Match { get; } = new(true, null);

    public static ParityComparisonResult Mismatch(string diffSummary) => new(false, diffSummary);
}

// Normalizes and compares two provider payloads for shadow-read drift detection. Normalization
// rules are documented in docs/migration/20_parity_contract_template.md.
public interface IPayloadParityComparer
{
    ParityComparisonResult Compare<T>(T? primary, T? shadow);
}

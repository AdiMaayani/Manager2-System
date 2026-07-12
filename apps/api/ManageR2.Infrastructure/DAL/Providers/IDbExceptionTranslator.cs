namespace ManageR2.Infrastructure.DAL.Providers;

// Normalizes provider-specific database exceptions so migrated repositories can map both
// SQL Server (THROW 5xxxx) and PostgreSQL (SQLSTATE) errors to the same domain exceptions and
// therefore the same HTTP contract. This is what keeps error-semantics parity across providers.
public interface IDbExceptionTranslator
{
    DatabaseProvider Provider { get; }

    // True when the exception originates from this provider's client.
    bool IsProviderException(Exception exception);

    // Provider-native error code as a string when available:
    // SQL Server -> the THROW/RAISERROR number; PostgreSQL -> the 5-char SQLSTATE.
    string? TryGetProviderErrorCode(Exception exception);
}

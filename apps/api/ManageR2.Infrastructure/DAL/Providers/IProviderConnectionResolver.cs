namespace ManageR2.Infrastructure.DAL.Providers;

// Resolves which connection factory a migrated repository should use for each role, based on
// the current DataProviderOptions. Migrated repositories depend on this instead of a concrete
// client so the dual-run flags alone control behavior.
public interface IProviderConnectionResolver
{
    DataProviderOptions Options { get; }

    // Factory whose result is returned to the caller.
    IDbConnectionFactory Primary { get; }

    // Postgres factory used for shadow reads, or null when shadow reads are disabled or the
    // primary is already Postgres (nothing to shadow against).
    IDbConnectionFactory? ShadowRead { get; }

    // Postgres factory used for best-effort dual writes, or null when dual writes are disabled
    // or the primary is already Postgres.
    IDbConnectionFactory? DualWrite { get; }
}

using Microsoft.Extensions.Options;

namespace ManageR2.Infrastructure.DAL.Providers;

// Default resolver. Shadow reads and dual writes only ever target Postgres, and only while
// SQL Server is still the primary (during cutover the roles collapse to the primary alone).
public sealed class ProviderConnectionResolver : IProviderConnectionResolver
{
    private readonly SqlServerConnectionFactory _sqlServer;
    private readonly PostgresConnectionFactory _postgres;

    public ProviderConnectionResolver(
        SqlServerConnectionFactory sqlServer,
        PostgresConnectionFactory postgres,
        IOptions<DataProviderOptions> options)
    {
        _sqlServer = sqlServer;
        _postgres = postgres;
        Options = options.Value;
    }

    public DataProviderOptions Options { get; }

    public IDbConnectionFactory Primary =>
        Options.Primary == DatabaseProvider.Postgres ? _postgres : _sqlServer;

    public IDbConnectionFactory? ShadowRead =>
        Options.ShadowReadPostgres && Options.Primary == DatabaseProvider.SqlServer ? _postgres : null;

    public IDbConnectionFactory? DualWrite =>
        Options.DualWritePostgres && Options.Primary == DatabaseProvider.SqlServer ? _postgres : null;
}

using System.Data.Common;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace ManageR2.Infrastructure.DAL.Providers;

// PostgreSQL connection factory (migration target). The connection string is resolved lazily
// on CreateConnection() rather than in the constructor so that a baseline environment with the
// Postgres provider disabled never fails to start just because PostgresConnection is unset.
public sealed class PostgresConnectionFactory : IDbConnectionFactory
{
    private readonly IConfiguration _configuration;

    public PostgresConnectionFactory(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public DatabaseProvider Provider => DatabaseProvider.Postgres;

    public DbConnection CreateConnection()
    {
        var connectionString = _configuration.GetConnectionString("PostgresConnection")
            ?? throw new InvalidOperationException(
                "PostgresConnection connection string was not found. Set ConnectionStrings:PostgresConnection " +
                "before enabling the PostgreSQL provider (DataProvider:Primary=Postgres, ShadowReadPostgres, or DualWritePostgres).");

        return new NpgsqlConnection(connectionString);
    }
}

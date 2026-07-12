using System.Data.Common;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace ManageR2.Infrastructure.DAL.Providers;

// SQL Server connection factory (the migration baseline). Mirrors DBServices so the
// abstraction and the legacy accessor open identical connections against DefaultConnection.
public sealed class SqlServerConnectionFactory : IDbConnectionFactory
{
    private readonly string _connectionString;

    public SqlServerConnectionFactory(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("DefaultConnection connection string was not found.");
    }

    public DatabaseProvider Provider => DatabaseProvider.SqlServer;

    public DbConnection CreateConnection() => new SqlConnection(_connectionString);
}

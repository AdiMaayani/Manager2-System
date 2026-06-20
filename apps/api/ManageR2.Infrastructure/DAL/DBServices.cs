using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace ManageR2.Infrastructure.DAL;

// Central access to the SQL Server connection string; repositories inject this to open per-operation connections.
public class DBServices
{
    // Cached connection string from IConfiguration (typically appsettings.json DefaultConnection).
    private readonly string _connectionString;

    public DBServices(IConfiguration configuration)
    {
        // Resolve DefaultConnection once; missing config throws so misdeployed environments fail visibly.
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("DefaultConnection connection string was not found.");
    }

    // Opens a new SqlConnection; callers own disposal/usage (using blocks in repository methods).
    public SqlConnection CreateConnection()
    {
        return new SqlConnection(_connectionString);
    }
}

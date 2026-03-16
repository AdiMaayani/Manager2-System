using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace ManageR2.Infrastructure.DAL;

public class DBServices
{
    private readonly string _connectionString;

    public DBServices(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("DefaultConnection connection string was not found.");
    }

    public SqlConnection CreateConnection()
    {
        return new SqlConnection(_connectionString);
    }
}
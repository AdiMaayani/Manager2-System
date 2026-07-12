using System.Data.Common;

namespace ManageR2.Infrastructure.DAL.Providers;

// Provider-agnostic connection factory. Returns the ADO.NET base type (DbConnection) so
// migrated repositories can target either SQL Server or PostgreSQL without depending on a
// concrete client type. The existing SQL Server repositories keep using DBServices until
// they are migrated wave by wave.
public interface IDbConnectionFactory
{
    DatabaseProvider Provider { get; }

    DbConnection CreateConnection();
}

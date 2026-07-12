namespace ManageR2.Infrastructure.DAL.Providers;

// Identifies which relational backend a connection/factory targets during the
// SQL Server -> PostgreSQL migration. SqlServer stays the baseline until cutover.
public enum DatabaseProvider
{
    SqlServer = 0,
    Postgres = 1
}

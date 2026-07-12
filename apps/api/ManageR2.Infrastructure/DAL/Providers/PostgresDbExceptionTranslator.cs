using Npgsql;

namespace ManageR2.Infrastructure.DAL.Providers;

public sealed class PostgresDbExceptionTranslator : IDbExceptionTranslator
{
    public DatabaseProvider Provider => DatabaseProvider.Postgres;

    public bool IsProviderException(Exception exception) => exception is PostgresException;

    public string? TryGetProviderErrorCode(Exception exception) =>
        exception is PostgresException postgresException ? postgresException.SqlState : null;
}

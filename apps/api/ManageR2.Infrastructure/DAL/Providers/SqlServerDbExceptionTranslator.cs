using Microsoft.Data.SqlClient;

namespace ManageR2.Infrastructure.DAL.Providers;

public sealed class SqlServerDbExceptionTranslator : IDbExceptionTranslator
{
    public DatabaseProvider Provider => DatabaseProvider.SqlServer;

    public bool IsProviderException(Exception exception) => exception is SqlException;

    public string? TryGetProviderErrorCode(Exception exception) =>
        exception is SqlException sqlException
            ? sqlException.Number.ToString(System.Globalization.CultureInfo.InvariantCulture)
            : null;
}

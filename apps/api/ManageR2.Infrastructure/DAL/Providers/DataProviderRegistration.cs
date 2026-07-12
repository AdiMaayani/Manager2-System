using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ManageR2.Infrastructure.DAL.Providers;

// Composition-root helper for the migration data layer. Registers both provider factories, the
// role resolver, the observability recorder, the parity comparer, and both exception translators.
// Registration is additive and side-effect free: with default options (Primary=SqlServer, both
// shadow flags off) the Postgres factory is never invoked, so an environment without a Postgres
// connection string keeps working exactly as the SQL Server baseline.
public static class DataProviderRegistration
{
    public static IServiceCollection AddManageR2DataProviders(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<DataProviderOptions>(configuration.GetSection(DataProviderOptions.SectionName));

        services.AddScoped<SqlServerConnectionFactory>();
        services.AddScoped<PostgresConnectionFactory>();
        services.AddScoped<IProviderConnectionResolver, ProviderConnectionResolver>();

        services.AddScoped<IDbExceptionTranslator, SqlServerDbExceptionTranslator>();
        services.AddScoped<IDbExceptionTranslator, PostgresDbExceptionTranslator>();

        services.AddSingleton<IProviderDriftRecorder, LoggingProviderDriftRecorder>();
        services.AddSingleton<IPayloadParityComparer, JsonPayloadParityComparer>();

        return services;
    }
}

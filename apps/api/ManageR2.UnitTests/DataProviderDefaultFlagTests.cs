using ManageR2.Infrastructure.DAL.Providers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace ManageR2.UnitTests;

// Wave 5 (and all prior waves) safety net: the dual-run router only touches PostgreSQL when the resolver
// exposes a non-null ShadowRead / DualWrite factory. These tests pin that gating so default configuration
// keeps the system purely on SQL Server (fixtures 18–20 decision point).
public class DataProviderDefaultFlagTests
{
    private static ProviderConnectionResolver BuildResolver(DataProviderOptions options)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = "Server=.;Database=x;Trusted_Connection=True;",
                ["ConnectionStrings:PostgresConnection"] = "Host=localhost;Database=x;Username=x;Password=x"
            })
            .Build();

        return new ProviderConnectionResolver(
            new SqlServerConnectionFactory(configuration),
            new PostgresConnectionFactory(configuration),
            Options.Create(options));
    }

    [Fact]
    public void DefaultOptions_UseSqlServerOnly_NoShadowNoDualWrite()
    {
        var resolver = BuildResolver(new DataProviderOptions());

        Assert.Equal(DatabaseProvider.SqlServer, resolver.Options.Primary);
        Assert.Equal(DatabaseProvider.SqlServer, resolver.Primary.Provider);
        Assert.Null(resolver.ShadowRead);
        Assert.Null(resolver.DualWrite);
    }

    [Fact]
    public void ShadowReadEnabled_ExposesPostgresShadowFactory()
    {
        var resolver = BuildResolver(new DataProviderOptions { ShadowReadPostgres = true });

        Assert.Equal(DatabaseProvider.SqlServer, resolver.Primary.Provider);
        Assert.NotNull(resolver.ShadowRead);
        Assert.Equal(DatabaseProvider.Postgres, resolver.ShadowRead!.Provider);
        Assert.Null(resolver.DualWrite);
    }

    [Fact]
    public void DualWriteEnabled_ExposesPostgresDualWriteFactory()
    {
        var resolver = BuildResolver(new DataProviderOptions { DualWritePostgres = true });

        Assert.NotNull(resolver.DualWrite);
        Assert.Equal(DatabaseProvider.Postgres, resolver.DualWrite!.Provider);
    }

    [Fact]
    public void PostgresPrimary_CollapsesShadowAndDualWriteRoles()
    {
        var resolver = BuildResolver(new DataProviderOptions
        {
            Primary = DatabaseProvider.Postgres,
            ShadowReadPostgres = true,
            DualWritePostgres = true
        });

        Assert.Equal(DatabaseProvider.Postgres, resolver.Primary.Provider);
        Assert.Null(resolver.ShadowRead);
        Assert.Null(resolver.DualWrite);
    }
}

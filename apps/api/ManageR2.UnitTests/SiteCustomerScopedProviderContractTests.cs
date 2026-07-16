namespace ManageR2.UnitTests;

// Pins the PostgreSQL + router contract for customer-scoped site reads introduced with
// ISiteRepository.GetByCustomerIdAsync / sp_GetSitesByCustomerId. Source-level assertions match
// existing Geo/Site ownership contract tests: no live database connections.
public class SiteCustomerScopedProviderContractTests
{
    [Fact]
    public void PostgresSiteRepository_GetByCustomerId_FiltersInSqlByCustomerAndActive()
    {
        var source = ReadInfrastructureFile(
            "Features/Sites/Repositories/PostgresSiteRepository.cs");

        Assert.Contains("public async Task<IEnumerable<Site>> GetByCustomerIdAsync(int customerId)", source);
        Assert.Contains("WHERE \"CustomerId\" = @CustomerId", source);
        Assert.Contains("AND \"IsActive\" = true", source);
        Assert.Contains("ORDER BY \"IsPrimary\" DESC, \"SiteName\", \"SiteId\"", source);
        Assert.Contains("AddParameter(command, \"@CustomerId\", customerId)", source);
        Assert.Contains("MapSite(reader)", source);
    }

    [Fact]
    public void PostgresSiteRepository_GetByCustomerId_DoesNotFilterGetAllInMemory()
    {
        var source = ReadInfrastructureFile(
            "Features/Sites/Repositories/PostgresSiteRepository.cs");
        var methodBody = ExtractMethodBody(source, "GetByCustomerIdAsync");

        Assert.DoesNotContain("GetAllAsync()", methodBody);
        Assert.DoesNotContain(".Where(", methodBody);
        Assert.DoesNotContain(".Where (", methodBody);
        Assert.Contains("WHERE \"CustomerId\" = @CustomerId", methodBody);
    }

    [Fact]
    public void SiteRepositoryRouter_GetByCustomerId_DelegatesToPrimaryProvider()
    {
        var source = ReadInfrastructureFile(
            "Features/Sites/Repositories/SiteRepositoryRouter.cs");
        var methodBody = ExtractMethodBody(source, "GetByCustomerIdAsync");

        Assert.Contains("Primary.GetByCustomerIdAsync(customerId)", methodBody);
        Assert.Contains(
            "_resolver.Options.Primary == DatabaseProvider.Postgres ? _postgres : _sqlServer",
            source);
    }

    [Fact]
    public void SiteRepositoryRouter_GetByCustomerId_ShadowReadsPostgresWhenEnabled()
    {
        var source = ReadInfrastructureFile(
            "Features/Sites/Repositories/SiteRepositoryRouter.cs");
        var methodBody = ExtractMethodBody(source, "GetByCustomerIdAsync");

        Assert.Contains("if (_resolver.ShadowRead is not null)", methodBody);
        Assert.Contains("Sites.GetByCustomerId", methodBody);
        Assert.Contains("_postgres.GetByCustomerIdAsync(customerId)", methodBody);
        Assert.Contains("ShadowCompareAsync", methodBody);
    }

    [Fact]
    public void SiteRepositoryRouter_GetByCustomerId_DoesNotSwallowPrimaryFailures()
    {
        var source = ReadInfrastructureFile(
            "Features/Sites/Repositories/SiteRepositoryRouter.cs");
        var methodBody = ExtractMethodBody(source, "GetByCustomerIdAsync");

        // Primary call is outside any try/catch; only ShadowCompareAsync wraps shadow failures.
        Assert.DoesNotContain("try", methodBody);
        Assert.DoesNotContain("catch", methodBody);
        Assert.Contains("return result;", methodBody);
    }

    [Fact]
    public void PostgresGetByCustomerId_MatchesSqlServerProcedureFiltersAndOrdering()
    {
        var procedure = File.ReadAllText(GetRepoRelativePath(
            "database/SP/sp_GetSitesByCustomerId.sql"));
        var postgres = ReadInfrastructureFile(
            "Features/Sites/Repositories/PostgresSiteRepository.cs");
        var postgresMethod = ExtractMethodBody(postgres, "GetByCustomerIdAsync");

        Assert.Contains("WHERE CustomerId = @CustomerId", procedure);
        Assert.Contains("AND IsActive = 1", procedure);
        Assert.Contains("ORDER BY IsPrimary DESC, SiteName, SiteId", procedure);

        Assert.Contains("WHERE \"CustomerId\" = @CustomerId", postgresMethod);
        Assert.Contains("AND \"IsActive\" = true", postgresMethod);
        Assert.Contains("ORDER BY \"IsPrimary\" DESC, \"SiteName\", \"SiteId\"", postgresMethod);
    }

    private static string ReadInfrastructureFile(string relativeUnderInfrastructure)
    {
        return File.ReadAllText(GetRepoRelativePath(
            $"apps/api/ManageR2.Infrastructure/{relativeUnderInfrastructure}"));
    }

    private static string ExtractMethodBody(string source, string methodName)
    {
        var signature = $"public async Task<IEnumerable<Site>> {methodName}(int customerId)";
        var start = source.IndexOf(signature, StringComparison.Ordinal);
        Assert.True(start >= 0, $"Could not find method signature: {signature}");

        var braceStart = source.IndexOf('{', start);
        Assert.True(braceStart >= 0, $"Could not find opening brace for {methodName}.");

        var depth = 0;
        for (var index = braceStart; index < source.Length; index++)
        {
            if (source[index] == '{')
            {
                depth++;
            }
            else if (source[index] == '}')
            {
                depth--;
                if (depth == 0)
                {
                    return source.Substring(braceStart, index - braceStart + 1);
                }
            }
        }

        throw new InvalidOperationException($"Could not extract method body for {methodName}.");
    }

    private static string GetRepoRelativePath(string relativePath)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate repository file: {relativePath}");
    }
}

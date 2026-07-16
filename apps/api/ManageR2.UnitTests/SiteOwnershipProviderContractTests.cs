namespace ManageR2.UnitTests;

// Pins PostgreSQL + router ownership-guard parity with sp_UpdateSite / THROW 51450.
// Source-level assertions only; no live database connections.
public class SiteOwnershipProviderContractTests
{
    [Fact]
    public void PostgresUpdateAsync_DoesNotAssignCustomerIdInSetClause()
    {
        var methodBody = ExtractUpdateAsyncBody(
            ReadInfrastructureFile("Features/Sites/Repositories/PostgresSiteRepository.cs"));
        var updateSetSegment = ExtractBetween(methodBody, "UPDATE \"Sites\" AS s SET", "FROM locked");

        Assert.DoesNotContain("\"CustomerId\"", updateSetSegment);
        Assert.Contains("\"SiteName\"    = @SiteName::text", updateSetSegment);
        Assert.Contains("locked.\"CustomerId\" = @CustomerId::int", methodBody);
    }

    [Fact]
    public void PostgresUpdateAsync_RejectsCustomerReassignmentAtomically()
    {
        var methodBody = ExtractUpdateAsyncBody(
            ReadInfrastructureFile("Features/Sites/Repositories/PostgresSiteRepository.cs"));

        Assert.Contains("FOR UPDATE", methodBody);
        Assert.Contains("\"CustomerId\" <> @CustomerId::int", methodBody);
        Assert.Contains("ownership_violation", methodBody);
        Assert.Contains(
            "throw new UserValidationException(\"Reassigning a site to another customer is not allowed.\")",
            methodBody);
        Assert.DoesNotContain("ExecuteReaderAsync", methodBody);
        Assert.DoesNotContain("BeginTransactionAsync", methodBody);
    }

    [Fact]
    public void PostgresUpdateAsync_SameCustomerUpdatesStillSucceed()
    {
        var methodBody = ExtractUpdateAsyncBody(
            ReadInfrastructureFile("Features/Sites/Repositories/PostgresSiteRepository.cs"));

        Assert.Contains("WHEN EXISTS (SELECT 1 FROM updated) THEN 'updated'", methodBody);
        Assert.Contains("return string.Equals(outcome, \"updated\", StringComparison.Ordinal)", methodBody);
        Assert.Contains("AND locked.\"CustomerId\" = @CustomerId::int", methodBody);
    }

    [Fact]
    public void SiteRepositoryRouter_Update_PropagatesPrimaryOwnershipViolations()
    {
        var methodBody = ExtractUpdateAsyncBody(
            ReadInfrastructureFile("Features/Sites/Repositories/SiteRepositoryRouter.cs"));

        Assert.Contains("Primary.UpdateAsync(site)", methodBody);
        Assert.Contains(
            "_resolver.Options.Primary == DatabaseProvider.Postgres ? _postgres : _sqlServer",
            ReadInfrastructureFile("Features/Sites/Repositories/SiteRepositoryRouter.cs"));

        // Primary call is not wrapped in try/catch; only the dual-write path catches.
        var primarySegment = methodBody[..methodBody.IndexOf("if (_resolver.DualWrite is not null)", StringComparison.Ordinal)];
        Assert.DoesNotContain("try", primarySegment);
        Assert.DoesNotContain("catch", primarySegment);
    }

    [Fact]
    public void SiteRepositoryRouter_Update_SqlServerPrimaryStillDelegatesUnchanged()
    {
        var source = ReadInfrastructureFile("Features/Sites/Repositories/SiteRepositoryRouter.cs");

        Assert.Contains(
            "_resolver.Options.Primary == DatabaseProvider.Postgres ? _postgres : _sqlServer",
            source);
        Assert.Contains("await Primary.UpdateAsync(site)", source);
        Assert.Contains("Sites.Update", source);
    }

    [Fact]
    public void SiteRepositoryRouter_Update_DualWriteCannotBypassPostgresOwnershipGuard()
    {
        var methodBody = ExtractUpdateAsyncBody(
            ReadInfrastructureFile("Features/Sites/Repositories/SiteRepositoryRouter.cs"));

        Assert.Contains("_postgres.UpdateAsync(site)", methodBody);
        Assert.Contains("Secondary PostgreSQL dual-write ownership mismatch", methodBody);
        Assert.Contains("Reassigning a site to another customer is not allowed", methodBody);
        Assert.Contains("DualWriteAsync(\"Sites.Update\"", methodBody);
    }

    [Fact]
    public void PostgresUpdateAsync_MatchesSqlServerOwnershipInvariant()
    {
        var procedure = File.ReadAllText(GetRepoRelativePath("database/SP/sp_UpdateSite.sql"));
        var patch = File.ReadAllText(GetRepoRelativePath(
            "database/deployment/patches/2026-07-12_prevent_site_customer_reassignment.sql"));
        var postgresMethod = ExtractUpdateAsyncBody(
            ReadInfrastructureFile("Features/Sites/Repositories/PostgresSiteRepository.cs"));

        Assert.Contains("CustomerId <> @CustomerId", procedure);
        Assert.Contains("THROW 51450", procedure);
        Assert.Contains("Reassigning a site to another customer is not allowed", procedure);
        Assert.Contains("CustomerId <> @CustomerId", patch);
        Assert.Contains("Reassigning a site to another customer is not allowed", patch);

        Assert.Contains("\"CustomerId\" <> @CustomerId::int", postgresMethod);
        Assert.Contains("Reassigning a site to another customer is not allowed", postgresMethod);
        Assert.Contains("FOR UPDATE", postgresMethod);
    }

    private static string ReadInfrastructureFile(string relativeUnderInfrastructure)
    {
        return File.ReadAllText(GetRepoRelativePath(
            $"apps/api/ManageR2.Infrastructure/{relativeUnderInfrastructure}"));
    }

    private static string ExtractUpdateAsyncBody(string source)
    {
        const string signature = "public async Task<bool> UpdateAsync(Site site)";
        var start = source.IndexOf(signature, StringComparison.Ordinal);
        Assert.True(start >= 0, $"Could not find method signature: {signature}");

        var braceStart = source.IndexOf('{', start);
        Assert.True(braceStart >= 0, "Could not find opening brace for UpdateAsync.");

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

        throw new InvalidOperationException("Could not extract UpdateAsync method body.");
    }

    private static string ExtractBetween(string source, string startMarker, string endMarker)
    {
        var start = source.IndexOf(startMarker, StringComparison.Ordinal);
        Assert.True(start >= 0, $"Could not find start marker: {startMarker}");
        start += startMarker.Length;

        var end = source.IndexOf(endMarker, start, StringComparison.Ordinal);
        Assert.True(end >= 0, $"Could not find end marker: {endMarker}");
        return source[start..end];
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

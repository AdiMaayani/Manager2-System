namespace ManageR2.UnitTests;

public class SiteOwnershipSqlContractTests
{
    [Fact]
    public void GetSitesByCustomerProcedure_FiltersByCustomerOwnership()
    {
        var sql = File.ReadAllText(GetRepoRelativePath(
            "database/SP/sp_GetSitesByCustomerId.sql"));

        Assert.Contains("@CustomerId INT", sql);
        Assert.Contains("WHERE CustomerId = @CustomerId", sql);
        Assert.Contains("AND IsActive = 1", sql);
    }

    [Fact]
    public void CreateWorkItemProcedure_RejectsProjectOrServiceCallSiteMismatch()
    {
        var sql = File.ReadAllText(GetRepoRelativePath("database/SP/sp_CreateWorkItem.sql"));

        Assert.Contains("SiteId=@SiteId AND CustomerId=@CustomerId", sql);
        Assert.Contains("THROW 51108", sql);
    }

    [Fact]
    public void UpdateWorkItemProcedure_RejectsProjectOrServiceCallSiteMismatch()
    {
        var sql = File.ReadAllText(GetRepoRelativePath("database/SP/sp_UpdateWorkItem.sql"));

        Assert.Contains("SiteId=@SiteId AND CustomerId=@CustomerId", sql);
        Assert.Contains("THROW 51119", sql);
    }

    [Fact]
    public void UpdateSiteProcedure_RejectsCustomerReassignment()
    {
        var sql = File.ReadAllText(GetRepoRelativePath("database/SP/sp_UpdateSite.sql"));

        Assert.Contains("CustomerId <> @CustomerId", sql);
        Assert.Contains("THROW 51450", sql);
    }

    [Fact]
    public void PostgresSiteRepository_GetByCustomerId_UsesCustomerScopedSqlFilter()
    {
        var source = File.ReadAllText(GetRepoRelativePath(
            "apps/api/ManageR2.Infrastructure/Features/Sites/Repositories/PostgresSiteRepository.cs"));

        Assert.Contains("GetByCustomerIdAsync(int customerId)", source);
        Assert.Contains("WHERE \"CustomerId\" = @CustomerId", source);
        Assert.Contains("AND \"IsActive\" = true", source);
    }

    [Fact]
    public void PostgresSiteRepository_UpdateAsync_RejectsCustomerReassignment()
    {
        var source = File.ReadAllText(GetRepoRelativePath(
            "apps/api/ManageR2.Infrastructure/Features/Sites/Repositories/PostgresSiteRepository.cs"));

        Assert.Contains("FOR UPDATE", source);
        Assert.Contains("\"CustomerId\" <> @CustomerId::int", source);
        Assert.Contains("ownership_violation", source);
        Assert.Contains("Reassigning a site to another customer is not allowed", source);
        Assert.Contains("UPDATE \"Sites\" AS s SET", source);
        Assert.DoesNotContain(
            """
                                "CustomerId"  = @CustomerId::int,
            """,
            source);
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

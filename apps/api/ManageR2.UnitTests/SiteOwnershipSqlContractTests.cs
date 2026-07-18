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
    public void DeactivateSiteProcedure_BlocksOpenWorkItemsThenSoftDeactivates()
    {
        var sql = File.ReadAllText(GetRepoRelativePath("database/SP/sp_DeactivateSite.sql"));

        Assert.Contains("FROM dbo.WorkItems", sql);
        Assert.Contains("WHERE SiteId = @SiteId", sql);
        Assert.Contains("AND ClosedAt IS NULL", sql);
        Assert.Contains("THROW 51010", sql);
        Assert.Contains("Cannot deactivate a site that is used by open work items.", sql);

        var throwIndex = sql.IndexOf("THROW 51010", StringComparison.Ordinal);
        var softDeactivateIndex = sql.IndexOf("IsActive = 0", StringComparison.Ordinal);
        Assert.True(throwIndex >= 0, "sp_DeactivateSite must throw 51010 for open work.");
        Assert.True(softDeactivateIndex >= 0, "sp_DeactivateSite must soft-deactivate via IsActive = 0.");
        Assert.True(
            throwIndex < softDeactivateIndex,
            "The open-work guard must run before soft deactivation.");
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

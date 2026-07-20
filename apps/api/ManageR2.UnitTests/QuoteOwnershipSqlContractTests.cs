namespace ManageR2.UnitTests;

/// <summary>
/// Source-contract coverage for GAP-003: quote create/update must reject a ProjectId
/// that does not belong to the quote CustomerId. These tests do not execute SQL.
/// </summary>
public class QuoteOwnershipSqlContractTests
{
    [Theory]
    [InlineData("database/SP/sp_Quotes_Create.sql")]
    [InlineData("database/SP/sp_Quotes_UpdateHeader.sql")]
    public void QuoteHeaderProcedures_RejectProjectOwnedByAnotherCustomer(string relativePath)
    {
        var sql = File.ReadAllText(GetRepoRelativePath(relativePath));

        Assert.Contains("THROW 51301", sql);
        Assert.Contains("Project was not found.", sql);
        Assert.Contains("THROW 51309", sql);
        Assert.Contains("Project does not belong to the selected customer.", sql);
        Assert.Contains("CustomerId = @CustomerId", sql);
        Assert.Contains("WorkType = 'Project'", sql);
        Assert.Contains("IsArchived = 0", sql);
    }

    [Theory]
    [InlineData("database/SP/sp_Quotes_Create.sql")]
    [InlineData("database/SP/sp_Quotes_UpdateHeader.sql")]
    public void QuoteHeaderProcedures_AllowNullProjectId(string relativePath)
    {
        var sql = File.ReadAllText(GetRepoRelativePath(relativePath));

        Assert.Contains("@ProjectId INT = NULL", sql);
        Assert.Contains("IF @ProjectId IS NOT NULL AND NOT EXISTS (", sql);

        var ownershipThrowIndex = sql.IndexOf("THROW 51309", StringComparison.Ordinal);
        Assert.True(ownershipThrowIndex >= 0);

        var ownershipGuardStart = sql.LastIndexOf(
            "IF @ProjectId IS NOT NULL AND NOT EXISTS (",
            ownershipThrowIndex,
            StringComparison.Ordinal);
        Assert.True(ownershipGuardStart >= 0, "Ownership guard must be gated on @ProjectId IS NOT NULL.");
    }

    [Theory]
    [InlineData("database/SP/sp_Quotes_Create.sql")]
    [InlineData("database/SP/sp_Quotes_UpdateHeader.sql")]
    public void QuoteHeaderProcedures_RequireMatchingCustomerForValidProject(string relativePath)
    {
        var sql = File.ReadAllText(GetRepoRelativePath(relativePath));

        var ownershipBlock = ExtractOwnershipGuardBlock(sql);
        Assert.Contains("WorkItemId = @ProjectId", ownershipBlock);
        Assert.Contains("WorkType = 'Project'", ownershipBlock);
        Assert.Contains("IsArchived = 0", ownershipBlock);
        Assert.Contains("CustomerId = @CustomerId", ownershipBlock);
    }

    [Fact]
    public void QuoteRepository_MapsOwnershipSqlError51309()
    {
        var source = File.ReadAllText(GetRepoRelativePath(
            "apps/api/ManageR2.Infrastructure/Features/Quotes/Repositories/QuoteRepository.cs"));

        Assert.Contains("catch (SqlException ex) when (ex.Number == 51309)", source);
        Assert.Contains("Project does not belong to the selected customer.", source);
    }

    private static string ExtractOwnershipGuardBlock(string sql)
    {
        var throwIndex = sql.IndexOf("THROW 51309", StringComparison.Ordinal);
        Assert.True(throwIndex >= 0);

        var guardStart = sql.LastIndexOf(
            "IF @ProjectId IS NOT NULL AND NOT EXISTS (",
            throwIndex,
            StringComparison.Ordinal);
        Assert.True(guardStart >= 0);

        return sql.Substring(guardStart, throwIndex - guardStart);
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

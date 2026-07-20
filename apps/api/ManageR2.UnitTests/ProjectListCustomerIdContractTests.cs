namespace ManageR2.UnitTests;

/// <summary>
/// Source-contract coverage for GAP-002: project-list must expose CustomerId end-to-end
/// so related-project UIs can filter by ownership instead of non-unique customer names.
/// These tests do not execute SQL.
/// </summary>
public class ProjectListCustomerIdContractTests
{
    [Fact]
    public void GetProjectsListProcedure_ReturnsCustomerIdAndCustomerName()
    {
        var sql = File.ReadAllText(GetRepoRelativePath("database/SP/sp_GetProjectsList.sql"));

        Assert.Contains("wi.CustomerId", sql);
        Assert.Contains("c.CustomerName", sql);
        Assert.Contains("LEFT JOIN dbo.Customers c", sql);
        Assert.Contains("ON wi.CustomerId = c.CustomerId", sql);
    }

    [Fact]
    public void ProjectListItemResult_CarriesCustomerId()
    {
        var source = File.ReadAllText(GetRepoRelativePath(
            "apps/api/ManageR2.Infrastructure/Features/Projects/Models/ProjectListItemResult.cs"));

        Assert.Contains("public int? CustomerId { get; set; }", source);
        Assert.Contains("public string CustomerName { get; set; }", source);
    }

    [Fact]
    public void ProjectListItemDto_CarriesCustomerId()
    {
        var source = File.ReadAllText(GetRepoRelativePath(
            "apps/api/ManageR2.Api/Features/Projects/DTOs/ProjectListItemDto.cs"));

        Assert.Contains("public int? CustomerId { get; set; }", source);
        Assert.Contains("public string CustomerName { get; set; }", source);
    }

    [Fact]
    public void GetProjectsListAsync_MapsCustomerIdFromReader()
    {
        var source = File.ReadAllText(GetRepoRelativePath(
            "apps/api/ManageR2.Infrastructure/Features/WorkItems/Repositories/WorkItemRepository.cs"));

        Assert.Contains("public async Task<List<ProjectListItemResult>> GetProjectsListAsync()", source);
        Assert.Contains("CustomerId = GetNullableIntValue(reader, \"CustomerId\")", source);
        Assert.Contains("CustomerName = GetStringValue(reader, \"CustomerName\")", source);
    }

    [Fact]
    public void GetProjectsListController_PreservesCustomerIdOnDto()
    {
        var source = File.ReadAllText(GetRepoRelativePath(
            "apps/api/ManageR2.Api/Features/WorkItems/WorkItemsController.cs"));

        Assert.Contains("CustomerId = project.CustomerId", source);
        Assert.Contains("CustomerName = project.CustomerName", source);
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

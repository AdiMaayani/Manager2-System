namespace ManageR2.UnitTests;

public class WorkItemRepositoryDateTimeMappingContractTests
{
    [Fact]
    public void UpdateAsync_WritesAllFourOperationalDateFields()
    {
        var source = File.ReadAllText(GetRepoRelativePath(
            "apps/api/ManageR2.Infrastructure/Features/WorkItems/Repositories/WorkItemRepository.cs"));

        Assert.Contains("public async Task<bool> UpdateAsync(int id, WorkItem workItem)", source);
        Assert.Contains("@PlannedStart", source);
        Assert.Contains("@PlannedEnd", source);
        Assert.Contains("@ActualStart", source);
        Assert.Contains("@ActualEnd", source);
        Assert.Contains("workItem.PlannedStart", source);
        Assert.Contains("workItem.PlannedEnd", source);
        Assert.Contains("workItem.ActualStart", source);
        Assert.Contains("workItem.ActualEnd", source);
    }

    [Fact]
    public void MapWorkItem_ReadsAllFourOperationalDateFields()
    {
        var source = File.ReadAllText(GetRepoRelativePath(
            "apps/api/ManageR2.Infrastructure/Features/WorkItems/Repositories/WorkItemRepository.cs"));

        Assert.Contains("PlannedStart = GetDateTimeValue(reader, \"PlannedStart\")", source);
        Assert.Contains("PlannedEnd = GetDateTimeValue(reader, \"PlannedEnd\")", source);
        Assert.Contains("ActualStart = GetDateTimeValue(reader, \"ActualStart\")", source);
        Assert.Contains("ActualEnd = GetDateTimeValue(reader, \"ActualEnd\")", source);
        Assert.Contains("CreatedAt = GetDateTimeValue(reader, \"CreatedAt\")", source);
        Assert.Contains("ClosedAt = GetDateTimeValue(reader, \"ClosedAt\")", source);
    }

    private static string GetRepoRelativePath(string relativePath)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(dir.FullName, relativePath);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            dir = dir.Parent;
        }

        throw new FileNotFoundException($"Could not locate repository file: {relativePath}");
    }
}

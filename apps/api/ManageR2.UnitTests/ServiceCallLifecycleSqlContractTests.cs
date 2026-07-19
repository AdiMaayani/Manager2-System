namespace ManageR2.UnitTests;

public class ServiceCallLifecycleSqlContractTests
{
    [Fact]
    public void CloseWorkItemProcedure_RemainsGenericPreTaskDefinition()
    {
        var sql = File.ReadAllText(GetRepoRelativePath("database/SP/sp_CloseWorkItem.sql"));

        Assert.Contains("Status = 'Cancelled'", sql);
        Assert.Contains("ClosedAt = GETDATE()", sql);
        Assert.DoesNotContain("SYSUTCDATETIME()", sql);
        Assert.DoesNotContain("UPDLOCK", sql);
        Assert.DoesNotContain("ServiceCall", sql);
    }

    [Fact]
    public void CancelServiceCallProcedure_ValidatesWorkTypeActiveStatusAndWritesUtcClosedAt()
    {
        var sql = File.ReadAllText(GetRepoRelativePath("database/SP/sp_CancelServiceCall.sql"));

        Assert.Contains("UPDLOCK, HOLDLOCK", sql);
        Assert.Contains("SET XACT_ABORT ON", sql);
        Assert.Contains("BEGIN TRANSACTION", sql);
        Assert.Contains("N'ServiceCall'", sql);
        Assert.Contains("N'Planned'", sql);
        Assert.Contains("N'Open'", sql);
        Assert.Contains("N'InProgress'", sql);
        Assert.Contains("Status = N'Cancelled'", sql);
        Assert.Contains("ClosedAt = SYSUTCDATETIME()", sql);
        Assert.DoesNotContain("ActualStart =", sql);
        Assert.DoesNotContain("ActualEnd =", sql);
        Assert.DoesNotContain("CreatedAt =", sql);
        Assert.Contains("51203", sql);
    }

    [Fact]
    public void ReopenServiceCallProcedure_HasRestrictedTransitionRules()
    {
        var sql = File.ReadAllText(GetRepoRelativePath("database/SP/sp_ReopenServiceCall.sql"));

        Assert.Contains("UPDLOCK, HOLDLOCK", sql);
        Assert.Contains("SET XACT_ABORT ON", sql);
        Assert.Contains("BEGIN TRANSACTION", sql);
        Assert.Contains("@Status = N'Cancelled'", sql);
        Assert.Contains("@Status = N'Open' AND @ClosedAt IS NOT NULL", sql);
        Assert.Contains("Status = N'Open'", sql);
        Assert.Contains("ClosedAt = NULL", sql);
        Assert.Contains("51204", sql);
        Assert.DoesNotContain("ActualStart =", sql);
        Assert.DoesNotContain("ActualEnd =", sql);
        Assert.DoesNotContain("CreatedAt =", sql);
    }

    [Fact]
    public void CreateWorkItemProcedure_UsesUtcCreatedAt()
    {
        var sql = File.ReadAllText(GetRepoRelativePath("database/SP/sp_CreateWorkItem.sql"));

        Assert.Contains("SYSUTCDATETIME()", sql);
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

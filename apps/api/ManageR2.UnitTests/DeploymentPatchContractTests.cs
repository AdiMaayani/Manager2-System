namespace ManageR2.UnitTests;

public class DeploymentPatchContractTests
{
    public static IEnumerable<object[]> SharedBlockerPatches()
    {
        yield return
        [
            "database/deployment/patches/2026-07-12_allow_same_day_project_milestones.sql"
        ];
        yield return
        [
            "database/deployment/patches/2026-07-12_fix_workreport_lifecycle_result_contract.sql"
        ];
        yield return
        [
            "database/deployment/patches/2026-07-12_prevent_site_customer_reassignment.sql"
        ];
        yield return
        [
            "database/deployment/patches/2026-07-12_add_customer_scoped_sites.sql"
        ];
    }

    [Theory]
    [MemberData(nameof(SharedBlockerPatches))]
    public void Patch_IsOperatorGuardedAndIdempotent(string relativePath)
    {
        var sql = File.ReadAllText(GetRepoRelativePath(relativePath));

        Assert.Contains("@ExpectedDatabaseName", sql);
        Assert.Contains("@ExpectedServerName", sql);
        Assert.Contains("Connected database/server does not match", sql);
        Assert.Contains("CREATE OR ALTER PROCEDURE", sql);
    }

    [Fact]
    public void LifecyclePatch_LoadsOutputContractBeforeCommit()
    {
        var sql = File.ReadAllText(GetRepoRelativePath(
            "database/deployment/patches/2026-07-12_fix_workreport_lifecycle_result_contract.sql"));

        var outputGuardIndex = sql.IndexOf(
            "IF @OutputLifecycleStatus IS NULL THROW",
            StringComparison.Ordinal);
        var commitIndex = sql.IndexOf("COMMIT;", outputGuardIndex, StringComparison.Ordinal);

        Assert.True(outputGuardIndex >= 0);
        Assert.True(commitIndex > outputGuardIndex);
    }

    [Fact]
    public void GitIgnore_UnignoresOnlyApprovedSharedBlockerPatches()
    {
        var gitIgnore = File.ReadAllText(GetRepoRelativePath(".gitignore"));

        foreach (var patch in SharedBlockerPatches())
        {
            var relativePath = Assert.IsType<string>(patch[0]);
            Assert.Contains($"!{relativePath.Replace('\\', '/')}", gitIgnore);
        }
        Assert.Contains("database/deployment/patches/*", gitIgnore);
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

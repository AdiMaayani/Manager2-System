namespace ManageR2.UnitTests;

/// <summary>
/// Source-contract coverage for GAP-009: an existing Project cannot be reclassified
/// through sp_UpdateWorkItem. These tests do not execute SQL.
/// </summary>
public class ProjectClassificationSqlContractTests
{
    [Fact]
    public void UpdateWorkItemProcedure_RejectsProjectReclassification()
    {
        var sql = File.ReadAllText(GetRepoRelativePath("database/SP/sp_UpdateWorkItem.sql"));

        Assert.Contains("@OldWorkType=WorkType", sql);
        Assert.Contains("@OldWorkType=N'Project' AND @DerivedWorkType<>N'Project'", sql);
        Assert.Contains("THROW 51122", sql);
        Assert.Contains("Reclassifying a Project is not allowed.", sql);

        var derivedIndex = sql.IndexOf(
            "DECLARE @DerivedWorkType NVARCHAR(50)=",
            StringComparison.Ordinal);
        var throwIndex = sql.IndexOf("THROW 51122", StringComparison.Ordinal);
        var updateIndex = sql.IndexOf(
            "UPDATE dbo.WorkItems SET Title=@Title",
            StringComparison.Ordinal);

        Assert.True(derivedIndex >= 0, "sp_UpdateWorkItem must derive WorkType.");
        Assert.True(throwIndex >= 0, "sp_UpdateWorkItem must throw 51122 for Project reclassification.");
        Assert.True(updateIndex >= 0, "sp_UpdateWorkItem must update WorkItems.");
        Assert.True(
            derivedIndex < throwIndex && throwIndex < updateIndex,
            "The Project reclassification guard must run after derivation and before the UPDATE.");
    }

    [Fact]
    public void WorkItemRepository_StillForwardsClientWorkTypeToUpdateProcedure()
    {
        var source = File.ReadAllText(GetRepoRelativePath(
            "apps/api/ManageR2.Infrastructure/Features/WorkItems/Repositories/WorkItemRepository.cs"));

        var commandBody = ExtractMethodBody(source, "private static SqlCommand CreateWorkItemUpdateCommand(");

        Assert.Contains("\"sp_UpdateWorkItem\"", commandBody);
        Assert.Contains("@WorkType", commandBody);
        Assert.Contains("workItem.WorkType", commandBody);
        Assert.Contains("@TaskCategory", commandBody);
        Assert.Contains("workItem.TaskCategory", commandBody);
    }

    private static string ExtractMethodBody(string source, string signature)
    {
        var signatureIndex = source.IndexOf(signature, StringComparison.Ordinal);
        Assert.True(signatureIndex >= 0, $"Could not locate method signature: {signature}");

        var openBraceIndex = source.IndexOf('{', signatureIndex);
        Assert.True(openBraceIndex >= 0, $"Could not locate method body for: {signature}");

        var depth = 0;
        for (var index = openBraceIndex; index < source.Length; index++)
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
                    return source.Substring(openBraceIndex, index - openBraceIndex + 1);
                }
            }
        }

        throw new InvalidOperationException($"Unbalanced braces while extracting method: {signature}");
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

namespace ManageR2.UnitTests;

// Regression guard for the confirmed HTTP 500 on PUT /api/WorkItems/{id}:
// "ExecuteScalar/BeginExecuteReader requires an open and available Connection. The connection's
// current state is closed." WorkItemRepository.UpdateAsync creates a local SqlConnection and a
// SqlCommand but previously executed the command without opening the connection first. These tests
// scope their assertions to the specific method body (via brace matching) so they prove the fix at
// method level rather than matching an OpenAsync call that merely exists elsewhere in the file.
public class WorkItemRepositoryConnectionContractTests
{
    private const string UpdateAsyncSignature =
        "public async Task<bool> UpdateAsync(int id, WorkItem workItem)";

    [Fact]
    public void UpdateAsync_OpensConnectionBeforeExecutingCommand()
    {
        var updateBody = ExtractMethodBody(ReadRepositorySource(), UpdateAsyncSignature);

        var openConnectionIndex = updateBody.IndexOf("await connection.OpenAsync();", StringComparison.Ordinal);
        var executeCommandIndex = updateBody.IndexOf("await command.ExecuteScalarAsync();", StringComparison.Ordinal);

        Assert.True(
            openConnectionIndex >= 0,
            "UpdateAsync must call 'await connection.OpenAsync();' before executing the command.");
        Assert.True(
            executeCommandIndex >= 0,
            "UpdateAsync must execute the update command with 'await command.ExecuteScalarAsync();'.");
        Assert.True(
            openConnectionIndex < executeCommandIndex,
            "UpdateAsync must open the connection before executing the command, not after.");
    }

    private static string ReadRepositorySource()
    {
        return File.ReadAllText(GetRepoRelativePath(
            "apps/api/ManageR2.Infrastructure/Features/WorkItems/Repositories/WorkItemRepository.cs"));
    }

    // Extracts a single method body (including its outer braces) using brace matching so that
    // assertions are scoped to the intended method instead of the whole source file.
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

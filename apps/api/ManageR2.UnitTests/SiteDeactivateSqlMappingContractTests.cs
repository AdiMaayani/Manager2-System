namespace ManageR2.UnitTests;

// Regression for DELETE /api/Sites/{id} returning the generic English "Failed to deactivate site."
// when sp_DeactivateSite throws SQL error 51010 (site referenced by open work items). DeactivateAsync
// must map 51010 to a dedicated UserValidationException with the Hebrew business message before the
// generic SqlException handler. These tests read the repository source so they fail against the
// previous catch-all implementation without requiring a live database.
public class SiteDeactivateSqlMappingContractTests
{
    private const string DeactivateAsyncSignature =
        "public async Task<bool> DeactivateAsync(int siteId)";

    private const string ExpectedHebrewMessage =
        "לא ניתן להשבית אתר שמשויך לפרויקט, משימה או קריאת שירות פתוחים. יש לסגור את העבודות הפתוחות או לשייך אותן לאתר אחר לפני ההשבתה.";

    [Fact]
    public void DeactivateAsync_MapsSqlError51010BeforeGenericSqlExceptionHandler()
    {
        var deactivateBody = ExtractMethodBody(ReadRepositorySource(), DeactivateAsyncSignature);

        var specificCatchIndex = deactivateBody.IndexOf(
            "catch (SqlException ex) when (ex.Number == 51010)",
            StringComparison.Ordinal);
        var genericCatchIndex = IndexOfGenericSqlExceptionCatch(deactivateBody);

        Assert.True(
            specificCatchIndex >= 0,
            "DeactivateAsync must catch SqlException 51010 with a dedicated when filter.");
        Assert.True(
            genericCatchIndex >= 0,
            "DeactivateAsync must retain a generic SqlException handler for unexpected SQL failures.");
        Assert.True(
            specificCatchIndex < genericCatchIndex,
            "The 51010 handler must appear before the generic SqlException catch.");
    }

    [Fact]
    public void DeactivateAsync_SurfacesHebrewBusinessMessageForOpenWorkRejection()
    {
        var deactivateBody = ExtractMethodBody(ReadRepositorySource(), DeactivateAsyncSignature);
        var specificCatchIndex = deactivateBody.IndexOf(
            "catch (SqlException ex) when (ex.Number == 51010)",
            StringComparison.Ordinal);
        var hebrewMessageIndex = deactivateBody.IndexOf(ExpectedHebrewMessage, StringComparison.Ordinal);

        Assert.True(specificCatchIndex >= 0);
        Assert.True(
            hebrewMessageIndex > specificCatchIndex,
            "The Hebrew business message must be thrown from the 51010 catch path.");
        Assert.Contains("throw new UserValidationException(", deactivateBody);
    }

    [Fact]
    public void DeactivateAsync_PreservesGenericMessageForUnexpectedSqlFailures()
    {
        var deactivateBody = ExtractMethodBody(ReadRepositorySource(), DeactivateAsyncSignature);

        var specificCatchIndex = deactivateBody.IndexOf(
            "catch (SqlException ex) when (ex.Number == 51010)",
            StringComparison.Ordinal);
        var genericCatchIndex = IndexOfGenericSqlExceptionCatch(deactivateBody);
        var genericMessageIndex = deactivateBody.IndexOf(
            "Failed to deactivate site.",
            StringComparison.Ordinal);

        Assert.True(specificCatchIndex >= 0);
        Assert.True(genericCatchIndex > specificCatchIndex);
        Assert.True(
            genericMessageIndex > genericCatchIndex,
            "The generic English message must remain only on the unexpected-SqlException path.");
    }

    // Locates an unqualified `catch (SqlException ex)` that is not a `when` filter, so IndexOf on
    // the filtered 51010 catch cannot be mistaken for the generic fallback.
    private static int IndexOfGenericSqlExceptionCatch(string methodBody)
    {
        const string catchPrefix = "catch (SqlException ex)";
        var searchFrom = 0;
        while (searchFrom < methodBody.Length)
        {
            var index = methodBody.IndexOf(catchPrefix, searchFrom, StringComparison.Ordinal);
            if (index < 0)
            {
                return -1;
            }

            var afterCatch = index + catchPrefix.Length;
            var remainder = methodBody.AsSpan(afterCatch).TrimStart();
            if (!remainder.StartsWith("when", StringComparison.Ordinal))
            {
                return index;
            }

            searchFrom = afterCatch;
        }

        return -1;
    }

    private static string ReadRepositorySource()
    {
        return File.ReadAllText(GetRepoRelativePath(
            "apps/api/ManageR2.Infrastructure/Features/Sites/Repositories/SiteRepository.cs"));
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

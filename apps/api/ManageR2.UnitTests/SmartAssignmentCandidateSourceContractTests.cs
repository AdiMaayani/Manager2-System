namespace ManageR2.UnitTests;

public class SmartAssignmentCandidateSourceContractTests
{
    [Theory]
    [InlineData("database/SP/Rec_GetTaskRecommendationInput.sql")]
    [InlineData("database/SP/Rec_GetDraftTaskRecommendationInput.sql")]
    public void CandidateSource_IncludesEveryActiveEmployeeRegardlessOfAssignableFlag(string relativePath)
    {
        var sql = File.ReadAllText(GetRepoRelativePath(relativePath));
        var candidateSections = ExtractSections(sql, "-- 3. EMPLOYEES", "-- 4. EMPLOYEE SKILLS");

        Assert.NotEmpty(candidateSections);
        foreach (var candidateSection in candidateSections)
        {
            Assert.Contains("FROM dbo.Employees", candidateSection, StringComparison.OrdinalIgnoreCase);
            Assert.Matches(
                @"(?i)\bWHERE\s+(?:[A-Za-z_][A-Za-z0-9_]*\.)?IsActive\s*=\s*1\b",
                candidateSection);
            Assert.DoesNotMatch(@"(?i)\bIsAssignable\s*=\s*1\b", candidateSection);
            Assert.DoesNotContain("Contractor", candidateSection, StringComparison.OrdinalIgnoreCase);
        }

        Assert.DoesNotMatch(@"(?i)\bIsAssignable\s*=\s*1\b", sql);
    }

    [Theory]
    [InlineData("database/SP/Rec_GetTaskRecommendationInput.sql")]
    [InlineData("database/SP/Rec_GetDraftTaskRecommendationInput.sql")]
    public void RoutingAddressInputs_RequireValidatedGeoapifyCoordinates(string relativePath)
    {
        var sql = File.ReadAllText(GetRepoRelativePath(relativePath));
        var addressSections = ExtractSections(
            sql,
            "-- 7. EMPLOYEE BASE ADDRESSES",
            "-- 9. WORK ZONES");

        Assert.NotEmpty(addressSections);
        foreach (var addressSection in addressSections)
        {
            Assert.Contains("ValidationStatus = N'Validated'", addressSection);
            Assert.Contains("ValidationProvider = N'Geoapify'", addressSection);
            Assert.Contains("Latitude BETWEEN -90 AND 90", addressSection);
            Assert.Contains("Longitude BETWEEN -180 AND 180", addressSection);
        }
    }

    private static IReadOnlyList<string> ExtractSections(string source, string startMarker, string endMarker)
    {
        var sections = new List<string>();
        var searchFrom = 0;
        while (searchFrom < source.Length)
        {
            var start = source.IndexOf(startMarker, searchFrom, StringComparison.OrdinalIgnoreCase);
            if (start < 0)
            {
                break;
            }

            var end = source.IndexOf(endMarker, start, StringComparison.OrdinalIgnoreCase);
            Assert.True(end > start, $"Could not locate SQL section marker: {endMarker}");
            sections.Add(source[start..end]);
            searchFrom = end;
        }

        return sections;
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

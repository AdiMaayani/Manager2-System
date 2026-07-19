namespace ManageR2.UnitTests;

public sealed class SmartAssignmentMultiRolePersistenceContractTests
{
    [Fact]
    public void Migration_DefinesNormalizedRoleTablesAndConservativeLegacyBackfill()
    {
        var sql = ReadRepoFile("database/migrations/2026-07-19_smart_assignment_multi_role_feedback.sql");

        Assert.Contains("CREATE TABLE dbo.WorkItemRequiredRoles", sql);
        Assert.Contains("PRIMARY KEY CLUSTERED (WorkItemId, RoleName)", sql);
        Assert.Contains("CREATE TABLE dbo.EmployeeProfessions", sql);
        Assert.Contains("UX_EmployeeProfessions_OnePrimaryPerEmployee", sql);
        Assert.Contains("INSERT INTO dbo.EmployeeProfessions", sql);
        Assert.Contains("INSERT INTO dbo.WorkItemRequiredRoles", sql);
        Assert.Contains("NOT EXISTS", sql);
    }

    [Theory]
    [InlineData("database/SP/sp_CreateWorkItem.sql")]
    [InlineData("database/SP/sp_UpdateWorkItem.sql")]
    public void WorkItemWrites_AcceptXmlCollectionAndPersistScalarCompatibilityValueAtomically(
        string relativePath)
    {
        var sql = ReadRepoFile(relativePath);

        Assert.Contains("@RequiredRolesXml XML", sql);
        Assert.Contains("@RequiredRole NVARCHAR(100)", sql);
        Assert.Contains("WorkItemRequiredRoles", sql);
        Assert.Contains("@ResolvedRequiredRole", sql);
        Assert.Contains("BEGIN TRANSACTION", sql);
        Assert.Contains("COMMIT TRANSACTION", sql);
        Assert.DoesNotContain("OPENJSON", sql, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("database/SP/sp_CreateEmployee.sql")]
    [InlineData("database/SP/sp_UpdateEmployee.sql")]
    public void EmployeeWrites_AlwaysPersistPrimaryInsideProfessionCollection(string relativePath)
    {
        var sql = ReadRepoFile(relativePath);

        Assert.Contains("@ProfessionsXml XML", sql);
        Assert.Contains("@NormalizedPrimaryRole", sql);
        Assert.Contains("EmployeeProfessions", sql);
        Assert.Contains("IsPrimary", sql);
        Assert.Contains("BEGIN TRANSACTION", sql);
        Assert.DoesNotContain("OPENJSON", sql, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("database/SP/Rec_GetTaskRecommendationInput.sql")]
    [InlineData("database/SP/Rec_GetDraftTaskRecommendationInput.sql")]
    public void RecommendationInputs_ReturnDeterministicXmlCollections(string relativePath)
    {
        var sql = ReadRepoFile(relativePath);

        Assert.Contains("RequiredRolesXml", sql);
        Assert.Contains("ProfessionsXml", sql);
        Assert.Contains("ORDER BY requiredRole.RoleName", sql);
        Assert.Contains("ORDER BY profession.RoleName", sql);
        Assert.Contains("FOR XML PATH", sql);
    }

    [Fact]
    public void ProfessionLookup_IncludesSecondaryProfessionsOnlyFromActiveEmployees()
    {
        var sql = ReadRepoFile("database/SP/sp_Employees_GetDistinctPrimaryRoles.sql");

        Assert.Contains("FROM dbo.EmployeeProfessions AS profession", sql);
        Assert.Contains("INNER JOIN dbo.Employees AS professionEmployee", sql);
        Assert.Contains("WHERE professionEmployee.IsActive = 1", sql);
    }

    private static string ReadRepoFile(string relativePath) =>
        File.ReadAllText(GetRepoRelativePath(relativePath));

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

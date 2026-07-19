using ManageR2.Api.Authorization;
using ManageR2.Api.Features.Settings;
using Microsoft.AspNetCore.Authorization;

namespace ManageR2.UnitTests;

public class SmartAssignmentPolicyPersistenceContractTests
{
    [Fact]
    public void Migration_DefinesVersionedProfilesImmutableHistoryAndRecommendationMetadata()
    {
        var sql = ReadRepoFile("database/migrations/2026-07-18_smart_assignment_policy_profiles.sql");

        Assert.Contains("Rec_SmartAssignmentPolicyProfiles", sql);
        Assert.Contains("Rec_SmartAssignmentPolicyVersions", sql);
        Assert.Contains("ActiveVersionNumber", sql);
        Assert.Contains("ProfessionalFitWeight + AvailabilityWeight + WorkloadWeight", sql);
        Assert.Contains("TR_Rec_SmartAssignmentPolicyVersions_Immutable", sql);
        Assert.Contains("AFTER UPDATE, DELETE", sql);
        Assert.Contains("PolicySnapshotJson NVARCHAR(MAX) NULL", sql);
    }

    [Fact]
    public void SaveProcedure_IsTransactionalOptimisticAndAuditedAtomically()
    {
        var sql = ReadRepoFile("database/SP/Rec_SaveSmartAssignmentPolicyVersion.sql");

        Assert.Contains("@ExpectedVersionNumber INT", sql);
        Assert.Contains("@IsActive BIT", sql);
        Assert.Contains("WITH (UPDLOCK, HOLDLOCK)", sql);
        Assert.Contains("BEGIN TRANSACTION", sql);
        Assert.Contains("INSERT INTO dbo.Rec_SmartAssignmentPolicyVersions", sql);
        Assert.Contains("EXEC dbo.sp_AuditLog_Create", sql);
        Assert.Contains("COMMIT TRANSACTION", sql);
        Assert.Contains("ROLLBACK TRANSACTION", sql);
        Assert.Contains("The Default Smart Assignment profile must remain active", sql);
        Assert.Contains("ROUND(@ProfessionalFitWeight, 2)", sql);
        Assert.Contains("ROUND(@MissingAvailabilityScore, 2)", sql);
        Assert.Contains("@IsActive AS IsActive", sql);
        Assert.Contains("v.VersionNumber = @NewVersionNumber", sql);
        Assert.DoesNotContain("v.VersionNumber = p.ActiveVersionNumber", sql);
    }

    [Fact]
    public void CanonicalProcedures_ExposeProfileListHistoryAndAdditiveResultPolicyMetadata()
    {
        var profiles = ReadRepoFile("database/SP/Rec_GetSmartAssignmentPolicyProfiles.sql");
        var history = ReadRepoFile("database/SP/Rec_GetSmartAssignmentPolicyVersionHistory.sql");
        var saveRecommendation = ReadRepoFile("database/SP/Rec_SaveTaskAssignmentRecommendation.sql");

        Assert.Contains("CREATE OR ALTER PROCEDURE dbo.Rec_GetSmartAssignmentPolicyProfiles", profiles);
        Assert.Contains("CREATE OR ALTER PROCEDURE dbo.Rec_GetSmartAssignmentPolicyVersionHistory", history);
        Assert.Contains("@PolicyProfileKey NVARCHAR(30) = NULL", saveRecommendation);
        Assert.Contains("@PolicyVersionNumber INT = NULL", saveRecommendation);
        Assert.Contains("@PolicyDisplayName NVARCHAR(150) = NULL", saveRecommendation);
        Assert.Contains("@PolicySnapshotJson NVARCHAR(MAX) = NULL", saveRecommendation);
    }

    [Fact]
    public void SettingsController_UsesEstablishedReadAndManagementPolicies()
    {
        AssertPolicy(nameof(SmartAssignmentSettingsController.GetProfiles), Policies.CanViewSettings);
        AssertPolicy(nameof(SmartAssignmentSettingsController.GetVersionHistory), Policies.CanViewSettings);
        AssertPolicy(nameof(SmartAssignmentSettingsController.Update), Policies.CanManageSettings);
        AssertPolicy(nameof(SmartAssignmentSettingsController.Reset), Policies.CanManageSettings);
        AssertPolicy(nameof(SmartAssignmentSettingsController.Preview), Policies.CanManageSettings);
    }

    [Fact]
    public void PolicyRepository_UsesOnlyCanonicalStoredProcedureCommands()
    {
        var source = ReadRepoFile(
            "apps/api/ManageR2.Infrastructure/Features/SmartAssignment/Repositories/SmartAssignmentPolicyRepository.cs");

        Assert.Contains("dbo.Rec_GetSmartAssignmentPolicyProfiles", source);
        Assert.Contains("dbo.Rec_GetSmartAssignmentPolicyVersionHistory", source);
        Assert.Contains("dbo.Rec_SaveSmartAssignmentPolicyVersion", source);
        Assert.Contains("CommandType = CommandType.StoredProcedure", source);
        Assert.DoesNotContain("CommandType.Text", source);
    }

    [Fact]
    public void RecommendationRunPersistence_PublishesOnlyAfterAllRowsAreSaved()
    {
        var createRun = ReadRepoFile("database/SP/Rec_CreateRecommendationRun.sql");
        var completeRun = ReadRepoFile("database/SP/Rec_CompleteRecommendationRun.sql");
        var batchService = ReadRepoFile(
            "apps/api/ManageR2.Infrastructure/Features/SmartAssignment/Services/SmartAssignmentBatchService.cs");

        Assert.Contains("N'Partial'", createRun);
        Assert.DoesNotContain("N'Completed'", createRun);
        Assert.Contains("SET RunStatus = N'Completed'", completeRun);
        Assert.Contains("AND RunStatus = N'Partial'", completeRun);
        Assert.True(
            batchService.IndexOf("SaveTaskAssignmentRecommendationAsync", StringComparison.Ordinal)
            < batchService.IndexOf("CompleteRecommendationRunAsync", StringComparison.Ordinal));
    }

    private static void AssertPolicy(string methodName, string expectedPolicy)
    {
        var method = typeof(SmartAssignmentSettingsController).GetMethod(methodName);
        Assert.NotNull(method);
        var policies = method!
            .GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true)
            .Cast<AuthorizeAttribute>()
            .Select(attribute => attribute.Policy)
            .ToList();
        Assert.Contains(expectedPolicy, policies);
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

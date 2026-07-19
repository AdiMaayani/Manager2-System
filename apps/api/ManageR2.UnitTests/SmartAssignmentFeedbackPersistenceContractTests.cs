namespace ManageR2.UnitTests;

public sealed class SmartAssignmentFeedbackPersistenceContractTests
{
    [Fact]
    public void InitialMigration_ConstrainsRatingIdentityUntilSharedFeedbackMigrationRuns()
    {
        var sql = ReadRepoFile("database/migrations/2026-07-19_smart_assignment_multi_role_feedback.sql");

        Assert.Contains("CREATE TABLE dbo.Rec_RecommendationFeedback", sql);
        Assert.Contains("CHECK (Rating BETWEEN 1 AND 10)", sql);
        Assert.Contains("UNIQUE (RecommendationId, ActingUserId)", sql);
        Assert.Contains("REFERENCES dbo.Rec_TaskAssignmentRecommendations", sql);
        Assert.Contains("REFERENCES dbo.Users", sql);
    }

    [Fact]
    public void AssignmentFeedbackLinkMigration_IsAdditiveDoesNotBackfillAndEnforcesOneSharedFeedbackRow()
    {
        var sql = ReadRepoFile(
            "database/migrations/2026-07-19_smart_assignment_assignment_feedback_link.sql");

        Assert.Contains("ADD SmartAssignmentRecommendationId INT NULL", sql);
        Assert.Contains("FK_WorkEmployeeAssignments_SmartAssignmentRecommendation", sql);
        Assert.Contains("IX_WorkEmployeeAssignments_SmartAssignmentRecommendationId", sql);
        Assert.Contains("UQ_Rec_RecommendationFeedback_Recommendation", sql);
        Assert.Contains("HAVING COUNT_BIG(*) > 1", sql);
        Assert.Contains("EXEC sys.sp_executesql", sql);
        Assert.DoesNotContain("UPDATE dbo.WorkEmployeeAssignments", sql);
        Assert.DoesNotContain("DELETE FROM dbo.Rec_RecommendationFeedback", sql);
    }

    [Fact]
    public void UpsertProcedure_IsIdempotentTransactionalAuditedAndCannotChangeRecommendation()
    {
        var sql = ReadRepoFile("database/SP/Rec_UpsertRecommendationFeedback.sql");

        Assert.Contains("RunStatus = N'Completed'", sql);
        Assert.Contains("WITH (UPDLOCK, HOLDLOCK)", sql);
        Assert.Contains("BEGIN TRANSACTION", sql);
        Assert.Contains("EXEC dbo.sp_AuditLog_Create", sql);
        Assert.Contains("RecommendationFeedbackCreated", sql);
        Assert.Contains("RecommendationFeedbackUpdated", sql);
        Assert.Contains("@WasChanged", sql);
        Assert.Contains("COMMIT TRANSACTION", sql);
        Assert.Contains("ROLLBACK TRANSACTION", sql);
        Assert.DoesNotContain("higherRankedRecommendation", sql);
        Assert.Contains("WHERE feedback.RecommendationId = @RecommendationId", sql);
        Assert.DoesNotContain("feedback.ActingUserId = @ActingUserId", sql);
        Assert.Contains("@FeedbackOwnerUserId AS ActingUserId", sql);
        Assert.DoesNotContain("UPDATE dbo.Rec_TaskAssignmentRecommendations", sql);
        Assert.DoesNotContain("UPDATE dbo.WorkItems", sql);
        Assert.DoesNotContain("UPDATE dbo.WorkEmployeeAssignments", sql);
    }

    [Fact]
    public void FeedbackRead_AllowsAnyPersistedCandidateRank()
    {
        var sql = ReadRepoFile("database/SP/Rec_GetRecommendationFeedback.sql");

        Assert.Contains("RunStatus = N'Completed'", sql);
        Assert.DoesNotContain("higherRankedRecommendation", sql);
        Assert.DoesNotContain("feedback.ActingUserId = @ActingUserId", sql);
    }

    [Fact]
    public void AssignmentStateRead_UsesOnlyExactSmartLinkAndNeverInfersManualRecommendation()
    {
        var sql = ReadRepoFile("database/SP/Rec_GetTaskAssignmentFeedbackState.sql");

        Assert.Contains("assignment.SmartAssignmentRecommendationId", sql);
        Assert.Contains("@IsManualAssignment = 0", sql);
        Assert.DoesNotContain("@IsManualAssignment = 1", sql);
        Assert.DoesNotContain("INNER JOIN dbo.Rec_RecommendationFeedback", sql);
        Assert.Contains("recommendation.RecommendationId", sql);
        Assert.Contains("recommendation.ProfessionalScore", sql);
        Assert.Contains("recommendation.AvailabilityScore", sql);
        Assert.Contains("recommendation.WorkloadScore", sql);
        Assert.Contains("recommendation.GeographicScore", sql);
        Assert.Contains("recommendation.ExperienceScore", sql);
        Assert.Contains("recommendation.ContinuityScore", sql);
        Assert.Contains("recommendation.PolicySnapshotJson", sql);
        Assert.Contains("N'SmartAssignment'", sql);
        Assert.Contains("N'Manual'", sql);
    }

    [Fact]
    public void AssignmentProcedure_DefaultsToManualAndValidatesCompletedSmartRun()
    {
        var sql = ReadRepoFile("database/SP/sp_AssignEmployeeToWork.sql");

        Assert.Contains("@RecommendationRunId INT = NULL", sql);
        Assert.Contains("recommendationRun.RunStatus = N'Completed'", sql);
        Assert.Contains("recommendation.TaskId = @WorkItemId", sql);
        Assert.Contains("recommendation.EmployeeId = @EmployeeId", sql);
        Assert.Contains("SmartAssignmentRecommendationId", sql);
        Assert.Contains("CASE WHEN @SmartAssignmentRecommendationId IS NULL THEN 1 ELSE 0 END", sql);
    }

    [Fact]
    public void FeedbackRepository_UsesOnlyCanonicalStoredProcedures()
    {
        var source = ReadRepoFile(
            "apps/api/ManageR2.Infrastructure/Features/SmartAssignment/Repositories/SmartAssignmentFeedbackRepository.cs");

        Assert.Contains("dbo.Rec_UpsertRecommendationFeedback", source);
        Assert.Contains("dbo.Rec_GetRecommendationFeedback", source);
        Assert.Contains("dbo.Rec_GetTaskAssignmentFeedbackState", source);
        Assert.Contains("CommandType = CommandType.StoredProcedure", source);
        Assert.DoesNotContain("CommandType.Text", source);
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

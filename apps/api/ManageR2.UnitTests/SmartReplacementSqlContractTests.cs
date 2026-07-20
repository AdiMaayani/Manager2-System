namespace ManageR2.UnitTests;

// The smart-replacement behavior lives in the canonical stored procedure and is deployed manually.
// These contract tests assert the SP text without executing SQL, guarding the additive contract:
//   - manual replacement (no RecommendationRunId) stays manual and clears the recommendation link;
//   - smart replacement (valid RecommendationRunId) resolves and stores the exact recommendation and
//     clears the manual flag, using the same invariants as sp_AssignEmployeeToWork;
//   - invalid / mismatched / incomplete runs are rejected.
public class SmartReplacementSqlContractTests
{
    private static string ReadProcedure() =>
        File.ReadAllText(GetRepoRelativePath("database/SP/sp_UpdateEmployeeWorkAssignment.sql"));

    [Fact]
    public void UpdateAssignmentProcedure_AddsOptionalRecommendationRunIdParameter()
    {
        var sql = ReadProcedure();

        Assert.Contains("@RecommendationRunId INT = NULL", sql);
        Assert.Contains("@RecommendationRunId < 1", sql);
        Assert.Contains("55009", sql);
    }

    [Fact]
    public void UpdateAssignmentProcedure_ResolvesRecommendationWithAssignInvariants()
    {
        var sql = ReadProcedure();

        Assert.Contains("dbo.Rec_TaskAssignmentRecommendations", sql);
        Assert.Contains("dbo.Rec_RecommendationRuns", sql);
        Assert.Contains("recommendation.RecommendationRunId = @RecommendationRunId", sql);
        Assert.Contains("recommendation.TaskId = @WorkItemId", sql);
        Assert.Contains("recommendation.EmployeeId = @EmployeeId", sql);
        Assert.Contains("recommendationRun.RunStatus = N'Completed'", sql);
        Assert.Contains("55010", sql);
    }

    [Fact]
    public void UpdateAssignmentProcedure_UsesResolvedFlagsInsteadOfHardcodedManual()
    {
        var sql = ReadProcedure();

        // The UPDATE must use the computed values, not a hard-coded manual assignment.
        Assert.Contains("IsManualAssignment = @IsManualAssignment", sql);
        Assert.Contains("SmartAssignmentRecommendationId = @SmartAssignmentRecommendationId", sql);
        Assert.DoesNotContain("IsManualAssignment = 1,", sql);
        Assert.DoesNotContain("SmartAssignmentRecommendationId = NULL", sql);

        // Manual default remains when no run is supplied.
        Assert.Contains("@IsManualAssignment BIT = 1", sql);
        Assert.Contains("@SmartAssignmentRecommendationId INT = NULL", sql);
        // Smart path clears the manual flag.
        Assert.Contains("SET @IsManualAssignment = 0", sql);
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

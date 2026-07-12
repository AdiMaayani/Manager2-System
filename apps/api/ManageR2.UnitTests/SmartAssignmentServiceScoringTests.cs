using ManageR2.Infrastructure.Models.SmartAssignment;
using ManageR2.Infrastructure.Repositories.SmartAssignment;
using ManageR2.Infrastructure.Services.SmartAssignment;

namespace ManageR2.UnitTests;

// Wave 5: deterministic, provider-neutral fixtures for the SmartAssignment scoring engine. The scoring
// lives in SmartAssignmentService and is identical regardless of data provider, so these fixtures pin the
// recommendation contract (eligibility, scoring, tie-breaking, determinism) that both the SQL Server and
// PostgreSQL repositories must feed. The repository is faked to return a crafted recommendation input.
public class SmartAssignmentServiceScoringTests
{
    // Fixed task window on a date that is never "today", so the origin resolves deterministically to HomeBase.
    private static readonly DateTime TaskStart = new(2026, 1, 10, 9, 0, 0);
    private static readonly DateTime TaskEnd = new(2026, 1, 10, 12, 0, 0);

    private sealed class FakeSmartAssignmentRepository : ISmartAssignmentRepository
    {
        private readonly TaskRecommendationInputModel _input;

        public FakeSmartAssignmentRepository(TaskRecommendationInputModel input) => _input = input;

        public Task<TaskRecommendationInputModel> GetTaskRecommendationInputAsync(int workItemId)
            => Task.FromResult(_input);

        public Task<TaskRecommendationInputModel> GetDraftTaskRecommendationInputAsync(
            DraftTaskRecommendationContextModel context) => Task.FromResult(_input);

        public Task<int> CreateRecommendationRunAsync(
            string scopeType, int? projectId, int? taskId, int? requestedByUserId,
            string algorithmVersion, string? inputSnapshotJson) => Task.FromResult(1);

        public Task SaveTaskAssignmentRecommendationAsync(int runId, int taskId, EmployeeCandidateModel candidate)
            => Task.CompletedTask;
    }

    private static SmartAssignmentService BuildService(TaskRecommendationInputModel input)
        => new(new FakeSmartAssignmentRepository(input));

    private static TaskRecommendationInputModel BaseInput(string? requiredRole = null)
    {
        return new TaskRecommendationInputModel
        {
            Task = new TaskCoreDataModel
            {
                WorkItemId = 100,
                Title = "משימת בדיקה",
                WorkType = "Task",
                Status = "Planned",
                PlannedStart = TaskStart,
                PlannedEnd = TaskEnd,
                EstimatedHours = 3m,
                RequiredRole = requiredRole,
                SiteId = 500
            }
        };
    }

    private static EmployeeCandidateModel Employee(int id, string name, string? role, bool active = true, bool assignable = true, decimal? daily = 8m)
        => new()
        {
            EmployeeId = id,
            FullName = name,
            PrimaryRole = role,
            IsActive = active,
            IsAssignable = assignable,
            DailyCapacityHours = daily
        };

    private static EmployeeAvailabilityModel FullAvailability(int employeeId)
        => new()
        {
            EmployeeId = employeeId,
            AvailableFrom = TaskStart.AddHours(-2),
            AvailableTo = TaskEnd.AddHours(2),
            AvailabilityType = "Available",
            Source = "Manual"
        };

    [Fact] // Fixture 1: one clearly eligible candidate.
    public async Task EligibleCandidate_IsRankedFirstAndEligible()
    {
        var input = BaseInput(requiredRole: "טכנאי");
        input.Employees.Add(Employee(1, "דנה כהן", "טכנאי"));
        input.EmployeeAvailability.Add(FullAvailability(1));

        var result = await BuildService(input).GetRecommendationsAsync(100);

        var candidate = Assert.Single(result);
        Assert.True(candidate.IsEligible);
        Assert.Null(candidate.ExclusionReason);
        Assert.Equal(1, candidate.RankOrder);
        Assert.Equal(100m, candidate.ProfessionalScore); // exact role match
    }

    [Fact] // Fixture 2: profession mismatch lowers professional score but is not an eligibility gate here.
    public async Task ProfessionMismatch_LowersProfessionalScore_ButStaysEligible()
    {
        var input = BaseInput(requiredRole: "טכנאי");
        input.Employees.Add(Employee(1, "יוסי לוי", "חשמלאי"));
        input.EmployeeAvailability.Add(FullAvailability(1));

        var candidate = Assert.Single(await BuildService(input).GetRecommendationsAsync(100));

        Assert.True(candidate.IsEligible);
        Assert.Equal(35m, candidate.ProfessionalScore); // unrelated role
    }

    [Fact] // Fixture 3: inactive employee is excluded from selection.
    public async Task InactiveEmployee_IsNotEligible()
    {
        var input = BaseInput();
        input.Employees.Add(Employee(1, "עובד לא פעיל", "טכנאי", active: false));
        input.EmployeeAvailability.Add(FullAvailability(1));

        var candidate = Assert.Single(await BuildService(input).GetRecommendationsAsync(100));

        Assert.False(candidate.IsEligible);
        Assert.Equal("עובד לא פעיל", candidate.ExclusionReason);
    }

    [Fact] // Fixture 4: an overlapping blocking window (Leave/Busy) makes the candidate unavailable.
    public async Task OverlappingBlockingAvailability_IsNotEligible()
    {
        var input = BaseInput();
        input.Employees.Add(Employee(1, "עובד בחופשה", "טכנאי"));
        input.EmployeeAvailability.Add(FullAvailability(1));
        input.EmployeeAvailability.Add(new EmployeeAvailabilityModel
        {
            EmployeeId = 1,
            AvailableFrom = TaskStart.AddHours(-1),
            AvailableTo = TaskStart.AddHours(1),
            AvailabilityType = "Leave",
            Source = "Manual"
        });

        var candidate = Assert.Single(await BuildService(input).GetRecommendationsAsync(100));

        Assert.False(candidate.IsEligible);
        Assert.Equal("לא זמין", candidate.ExclusionReason);
        Assert.Null(candidate.AvailabilityScore);
    }

    [Fact] // Fixture 5: no availability rows at all => not available.
    public async Task NoAvailability_IsNotEligible()
    {
        var input = BaseInput();
        input.Employees.Add(Employee(1, "ללא זמינות", "טכנאי"));

        var candidate = Assert.Single(await BuildService(input).GetRecommendationsAsync(100));

        Assert.False(candidate.IsEligible);
        Assert.Equal("לא זמין", candidate.ExclusionReason);
    }

    [Fact] // Fixture 6: high projected utilization yields a low workload score.
    public async Task HighWorkload_ProducesLowWorkloadScore()
    {
        var input = BaseInput();
        input.Task!.EstimatedHours = 8m;
        input.Employees.Add(Employee(1, "עמוס עומס", "טכנאי", daily: 8m));
        input.EmployeeAvailability.Add(FullAvailability(1));
        input.EmployeeCurrentLoads.Add(new EmployeeCurrentLoadModel
        {
            EmployeeId = 1,
            OpenAssignmentsCount = 3,
            CurrentAssignedHours = 8m // projected 16 / capacity 8 = 200% utilization
        });

        var candidate = Assert.Single(await BuildService(input).GetRecommendationsAsync(100));

        Assert.Equal(15m, candidate.WorkloadScore); // utilization > 1.5 => 15
    }

    [Fact] // Fixture 7: missing geography (no route estimates) => neutral geographic score.
    public async Task MissingGeography_UsesNeutralScore()
    {
        var input = BaseInput();
        input.Employees.Add(Employee(1, "בלי מסלול", "טכנאי"));
        input.EmployeeAvailability.Add(FullAvailability(1));

        var candidate = Assert.Single(await BuildService(input).GetRecommendationsAsync(100));

        Assert.Equal(50m, candidate.GeographicScore);
    }

    [Fact] // Fixture 8: missing experience (no employee skills) => low-medium experience score.
    public async Task MissingExperience_UsesLowMediumScore()
    {
        var input = BaseInput();
        input.Employees.Add(Employee(1, "ללא כישורים", "טכנאי"));
        input.EmployeeAvailability.Add(FullAvailability(1));

        var candidate = Assert.Single(await BuildService(input).GetRecommendationsAsync(100));

        Assert.Equal(40m, candidate.ExperienceScore);
    }

    [Fact] // Fixtures 9 + 10: equal final scores keep a deterministic, stable tie-break by input order.
    public async Task EqualScores_TieBreakIsStableByInputOrder()
    {
        var input = BaseInput(requiredRole: "טכנאי");
        input.Employees.Add(Employee(1, "ראשון", "טכנאי"));
        input.Employees.Add(Employee(2, "שני", "טכנאי"));
        input.EmployeeAvailability.Add(FullAvailability(1));
        input.EmployeeAvailability.Add(FullAvailability(2));

        var result = await BuildService(input).GetRecommendationsAsync(100);

        Assert.Equal(2, result.Count);
        Assert.Equal(result[0].TotalScore, result[1].TotalScore); // identical inputs => identical scores
        Assert.Equal(1, result[0].EmployeeId); // stable: first input stays first
        Assert.Equal(2, result[1].EmployeeId);
        Assert.Equal(1, result[0].RankOrder);
        Assert.Equal(2, result[1].RankOrder);
    }

    [Fact] // Fixture 11: no eligible candidates (all unavailable) still returns ranked rows.
    public async Task NoEligibleCandidates_StillReturnsRankedRows()
    {
        var input = BaseInput();
        input.Employees.Add(Employee(1, "א", "טכנאי"));
        input.Employees.Add(Employee(2, "ב", "טכנאי"));
        // No availability => none eligible.

        var result = await BuildService(input).GetRecommendationsAsync(100);

        Assert.Equal(2, result.Count);
        Assert.All(result, c => Assert.False(c.IsEligible));
        Assert.Equal(new int?[] { 1, 2 }, result.Select(c => c.RankOrder).ToArray());
    }

    [Fact] // Fixture 12: null optional task fields (no window) must not throw and yield not-available.
    public async Task NullTaskWindow_DoesNotThrow_AndIsNotEligible()
    {
        var input = BaseInput();
        input.Task!.PlannedStart = null;
        input.Task!.PlannedEnd = null;
        input.Task!.EstimatedHours = null;
        input.Employees.Add(Employee(1, "ללא חלון", "טכנאי"));
        input.EmployeeAvailability.Add(FullAvailability(1));

        var candidate = Assert.Single(await BuildService(input).GetRecommendationsAsync(100));

        Assert.False(candidate.IsEligible);
        Assert.Equal("לא זמין", candidate.ExclusionReason);
    }

    [Fact] // Fixture 13: Hebrew text round-trips unchanged through scoring.
    public async Task HebrewText_IsPreserved()
    {
        var input = BaseInput(requiredRole: "טכנאי");
        input.Employees.Add(Employee(1, "אבישג בן-דוד", "טכנאי"));
        input.EmployeeAvailability.Add(FullAvailability(1));

        var candidate = Assert.Single(await BuildService(input).GetRecommendationsAsync(100));

        Assert.Equal("אבישג בן-דוד", candidate.FullName);
        Assert.Contains("כשיר לבחירה", candidate.RecommendationSummary);
    }

    [Fact] // Fixture 14: repeated execution is deterministic.
    public async Task RepeatedExecution_IsDeterministic()
    {
        TaskRecommendationInputModel Build()
        {
            var input = BaseInput(requiredRole: "טכנאי");
            input.Employees.Add(Employee(1, "א", "טכנאי"));
            input.Employees.Add(Employee(2, "ב", "חשמלאי"));
            input.EmployeeAvailability.Add(FullAvailability(1));
            input.EmployeeAvailability.Add(FullAvailability(2));
            return input;
        }

        var first = await BuildService(Build()).GetRecommendationsAsync(100);
        var second = await BuildService(Build()).GetRecommendationsAsync(100);

        Assert.Equal(
            first.Select(c => (c.EmployeeId, c.RankOrder, c.TotalScore)),
            second.Select(c => (c.EmployeeId, c.RankOrder, c.TotalScore)));
    }

    [Fact] // Fixture 15: empty roster yields an empty result.
    public async Task EmptyRoster_ReturnsEmpty()
    {
        var result = await BuildService(BaseInput()).GetRecommendationsAsync(100);
        Assert.Empty(result);
    }
}

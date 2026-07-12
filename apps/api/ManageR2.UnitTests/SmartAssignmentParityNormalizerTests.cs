using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Models.SmartAssignment;
using ManageR2.Infrastructure.Repositories.SmartAssignment;

namespace ManageR2.UnitTests;

// Wave 5: verifies the shadow-read parity normalization. The recommendation-input result sets have no
// inherent SQL ordering, so the router normalizes list order before comparing SQL Server vs PostgreSQL.
// This simulates a normalized-parity check without a live database (fixtures 16/17).
public class SmartAssignmentParityNormalizerTests
{
    private readonly JsonPayloadParityComparer _comparer = new();

    private static TaskRecommendationInputModel SampleInput(bool reversedOrder)
    {
        var employees = new List<EmployeeCandidateModel>
        {
            new() { EmployeeId = 1, FullName = "אבי", PrimaryRole = "טכנאי", IsActive = true, IsAssignable = true },
            new() { EmployeeId = 2, FullName = "בני", PrimaryRole = "חשמלאי", IsActive = true, IsAssignable = true }
        };
        var skills = new List<EmployeeSkillModel>
        {
            new() { EmployeeId = 1, SkillId = 10, SkillName = "רשתות", SkillLevel = 4 },
            new() { EmployeeId = 1, SkillId = 11, SkillName = "אבטחה", SkillLevel = 3 }
        };

        if (reversedOrder)
        {
            employees.Reverse();
            skills.Reverse();
        }

        return new TaskRecommendationInputModel
        {
            Task = new TaskCoreDataModel { WorkItemId = 100, Title = "משימה" },
            Employees = employees,
            EmployeeSkills = skills
        };
    }

    [Fact] // Fixture 17: same data in different provider row order is parity-equal after normalization.
    public void Normalize_MakesDifferentRowOrder_ParityEqual()
    {
        var primary = SmartAssignmentInputParityNormalizer.Normalize(SampleInput(reversedOrder: false));
        var shadow = SmartAssignmentInputParityNormalizer.Normalize(SampleInput(reversedOrder: true));

        var comparison = _comparer.Compare(primary, shadow);

        Assert.True(comparison.IsMatch, comparison.DiffSummary);
    }

    [Fact] // A genuine value difference is still detected after normalization.
    public void Normalize_StillDetectsValueDifferences()
    {
        var primary = SmartAssignmentInputParityNormalizer.Normalize(SampleInput(reversedOrder: false));
        var divergent = SampleInput(reversedOrder: false);
        divergent.Employees[0].FullName = "שם שונה";
        var shadow = SmartAssignmentInputParityNormalizer.Normalize(divergent);

        var comparison = _comparer.Compare(primary, shadow);

        Assert.False(comparison.IsMatch);
    }
}

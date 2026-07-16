namespace ManageR2.UnitTests;

// Pins PostgreSQL ProjectMilestones planned-range parity with SQL Server same-day rules.
// Source-level assertions only; no live database connections.
public class PostgresMilestonePlannedRangeContractTests
{
    [Fact]
    public void Schema_PlannedRangeAllowsSameDayAndRejectsInvertedRange()
    {
        var schema = File.ReadAllText(GetRepoRelativePath(
            "database/postgres/schema/03_workitems_projects_quotes.sql"));
        var plannedRange = ExtractConstraint(schema, "CK_ProjectMilestones_PlannedRange");

        Assert.Contains("\"PlannedStart\" IS NULL AND \"PlannedEnd\" IS NULL", plannedRange);
        Assert.Contains("\"PlannedStart\" IS NOT NULL AND \"PlannedEnd\" IS NOT NULL", plannedRange);
        Assert.Contains("\"PlannedEnd\" >= \"PlannedStart\"", plannedRange);
        Assert.DoesNotContain("\"PlannedEnd\" > \"PlannedStart\"", plannedRange);
    }

    [Fact]
    public void Schema_ActualRangeConstraintRemainsStrictGreaterThan()
    {
        var schema = File.ReadAllText(GetRepoRelativePath(
            "database/postgres/schema/03_workitems_projects_quotes.sql"));
        var actualRange = ExtractConstraint(schema, "CK_ProjectMilestones_ActualRange");

        Assert.Contains("\"ActualEnd\" > \"ActualStart\"", actualRange);
        Assert.DoesNotContain("\"ActualEnd\" >= \"ActualStart\"", actualRange);
    }

    [Fact]
    public void DeploymentPatch_TargetsPlannedRangeConstraintIdempotently()
    {
        var patch = File.ReadAllText(GetRepoRelativePath(
            "database/postgres/patches/2026-07-16_allow_same_day_project_milestones.sql"));

        Assert.Contains("\"ProjectMilestones\"", patch);
        Assert.Contains("CK_ProjectMilestones_PlannedRange", patch);
        Assert.Contains("to_regclass('public.\"ProjectMilestones\"')", patch);
        Assert.Contains("DROP CONSTRAINT \"CK_ProjectMilestones_PlannedRange\"", patch);
        Assert.Contains("ADD CONSTRAINT \"CK_ProjectMilestones_PlannedRange\"", patch);
        Assert.Contains("\"PlannedEnd\" >= \"PlannedStart\"", patch);
        Assert.Contains("already allows same-day planned milestones", patch);
        Assert.Contains("DO $$", patch);
        Assert.DoesNotContain("CK_ProjectMilestones_ActualRange\" CHECK", patch);
        Assert.DoesNotContain("DELETE FROM", patch);
        Assert.DoesNotContain("UPDATE \"ProjectMilestones\"", patch);
    }

    [Fact]
    public void DeploymentPatch_PreservesActualRangeAndRejectsInvertedPlannedRangeSemantics()
    {
        var patch = File.ReadAllText(GetRepoRelativePath(
            "database/postgres/patches/2026-07-16_allow_same_day_project_milestones.sql"));

        Assert.Contains("CK_ProjectMilestones_ActualRange", patch);
        Assert.Contains("\"ActualEnd\" > \"ActualStart\"", patch);
        Assert.Contains("actual_range_unchanged", patch);
        Assert.Contains("\"PlannedEnd\" >= \"PlannedStart\"", patch);
        Assert.DoesNotContain("\"PlannedEnd\" > \"PlannedStart\"", patch);
    }

    private static string ExtractConstraint(string schemaSql, string constraintName)
    {
        var marker = $"CONSTRAINT \"{constraintName}\" CHECK (";
        var start = schemaSql.IndexOf(marker, StringComparison.Ordinal);
        Assert.True(start >= 0, $"Could not find constraint {constraintName}.");

        var openParen = schemaSql.IndexOf('(', start + marker.Length - 1);
        Assert.True(openParen >= 0);

        var depth = 0;
        for (var index = openParen; index < schemaSql.Length; index++)
        {
            if (schemaSql[index] == '(')
            {
                depth++;
            }
            else if (schemaSql[index] == ')')
            {
                depth--;
                if (depth == 0)
                {
                    return schemaSql.Substring(start, index - start + 1);
                }
            }
        }

        throw new InvalidOperationException($"Could not extract constraint body for {constraintName}.");
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

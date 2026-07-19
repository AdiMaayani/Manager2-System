using Xunit;

namespace ManageR2.UnitTests;

public sealed class WorkItemStatusUpdateContractTests
{
    [Fact]
    public void StoredProcedure_PreservesExistingStatus_WhenStatusIsMissing()
    {
        var sql = ReadRepoFile("database/SP/sp_UpdateWorkItem.sql");

        Assert.Contains("@OldStatus=Status", sql, StringComparison.Ordinal);
        Assert.Contains(
            "@ResolvedStatus NVARCHAR(100)=COALESCE(NULLIF(LTRIM(RTRIM(@Status)),N''),@OldStatus)",
            sql,
            StringComparison.Ordinal);
        Assert.Contains("Status=@ResolvedStatus", sql, StringComparison.Ordinal);
        Assert.DoesNotContain("Status=@Status", sql, StringComparison.Ordinal);
    }

    [Fact]
    public void GenericController_PreservesExistingStatus_BeforeRepositoryUpdate()
    {
        var controller = ReadRepoFile(
            "apps/api/ManageR2.Api/Features/WorkItems/WorkItemsController.cs");

        Assert.Contains(
            "workItem.Status = ResolveTaskStatus(workItem.Status, existingWorkItem.Status);",
            controller,
            StringComparison.Ordinal);
    }

    [Fact]
    public void DedicatedTaskUpdate_PreservesNonEditableActualValues()
    {
        var controller = ReadRepoFile(
            "apps/api/ManageR2.Api/Features/WorkItems/WorkItemsController.cs");

        Assert.Contains("ActualStart = existingTask.ActualStart", controller, StringComparison.Ordinal);
        Assert.Contains("ActualEnd = existingTask.ActualEnd", controller, StringComparison.Ordinal);
        Assert.Contains("ActualHours = existingTask.ActualHours", controller, StringComparison.Ordinal);
    }

    [Fact]
    public void TaskDrawer_PreservesServiceCallActualValuesDuringAssignmentEditing()
    {
        var drawer = ReadRepoFile(
            "apps/web/src/features/workplan/components/EditTaskDrawer/EditTaskDrawer.tsx");

        Assert.Contains("actualStart: workItem.actualStart ?? null", drawer, StringComparison.Ordinal);
        Assert.Contains("actualEnd: workItem.actualEnd ?? null", drawer, StringComparison.Ordinal);
        Assert.Contains("actualHours: workItem.actualHours ?? null", drawer, StringComparison.Ordinal);
    }

    private static string ReadRepoFile(string relativePath)
    {
        var currentDirectory = new DirectoryInfo(AppContext.BaseDirectory);
        while (currentDirectory is not null)
        {
            var candidate = Path.Combine(currentDirectory.FullName, relativePath);
            if (File.Exists(candidate))
            {
                return File.ReadAllText(candidate);
            }

            currentDirectory = currentDirectory.Parent;
        }

        throw new FileNotFoundException($"Could not locate repository file: {relativePath}");
    }
}

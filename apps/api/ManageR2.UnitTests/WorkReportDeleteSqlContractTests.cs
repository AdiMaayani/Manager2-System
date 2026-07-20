namespace ManageR2.UnitTests;

/// <summary>
/// SQL text contract tests for sp_WorkReports_Delete.
/// These assert canonical script contents only; they do not execute SQL against a database.
/// </summary>
public class WorkReportDeleteSqlContractTests
{
    [Fact]
    public void DeleteProcedure_IsTransactionalAndRollsBackOnFailure()
    {
        var sql = File.ReadAllText(GetRepoRelativePath("database/SP/sp_WorkReports_Delete.sql"));

        Assert.Contains("SET XACT_ABORT ON", sql);
        Assert.Contains("BEGIN TRANSACTION", sql);
        Assert.Contains("COMMIT TRANSACTION", sql);
        // With XACT_ABORT ON, THROW aborts and rolls back the open transaction.
        Assert.Contains("THROW 51370", sql);
        Assert.Contains("THROW 51371", sql);
        Assert.Contains("THROW 51372", sql);
    }

    [Fact]
    public void DeleteProcedure_AllowsOnlyDraftAndBlocksAttachmentsAndStockMovements()
    {
        var sql = File.ReadAllText(GetRepoRelativePath("database/SP/sp_WorkReports_Delete.sql"));

        Assert.Contains("LifecycleStatus", sql);
        Assert.Contains("<> N'Draft'", sql);
        Assert.Contains("WorkReportAttachments", sql);
        Assert.Contains("InventoryStockMovements", sql);
        Assert.DoesNotContain("DELETE FROM dbo.InventoryStockMovements", sql);
        Assert.DoesNotContain("DELETE dbo.InventoryStockMovements", sql);
    }

    [Fact]
    public void DeleteProcedure_RemovesDraftChildrenInFkSafeOrder()
    {
        var sql = File.ReadAllText(GetRepoRelativePath("database/SP/sp_WorkReports_Delete.sql"));

        var inventoryDelete = sql.IndexOf("DELETE FROM dbo.WorkReportInventoryItems", StringComparison.Ordinal);
        var assignmentsDelete = sql.IndexOf("DELETE FROM dbo.WorkReportEmployeeAssignments", StringComparison.Ordinal);
        var systemsDelete = sql.IndexOf("DELETE FROM dbo.WorkReportSystems", StringComparison.Ordinal);
        var reportDelete = sql.IndexOf("DELETE FROM dbo.WorkReports", StringComparison.Ordinal);

        Assert.True(inventoryDelete >= 0, "Draft inventory lines must be deleted.");
        Assert.True(assignmentsDelete >= 0, "Employee assignments must be deleted.");
        Assert.True(systemsDelete >= 0, "Systems must be deleted.");
        Assert.True(reportDelete >= 0, "WorkReports row must be deleted.");
        Assert.True(inventoryDelete < assignmentsDelete, "Inventory lines before assignments.");
        Assert.True(assignmentsDelete < systemsDelete, "Assignments before systems.");
        Assert.True(systemsDelete < reportDelete, "Systems before WorkReports.");
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

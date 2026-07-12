using System.Data;
using ManageR2.Infrastructure.Repositories;
using Microsoft.Data.SqlClient;

namespace ManageR2.UnitTests;

public class WorkReportLifecycleOutputContractTests
{
    [Fact]
    public void AddOutputParameters_DefinesStableTypedContract()
    {
        using var command = new SqlCommand();

        WorkReportLifecycleOutputContract.AddOutputParameters(command);

        Assert.Equal(7, command.Parameters.Count);
        Assert.All(
            command.Parameters.Cast<SqlParameter>(),
            parameter => Assert.Equal(ParameterDirection.Output, parameter.Direction));
        Assert.Equal(SqlDbType.NVarChar, command.Parameters["@OutputLifecycleStatus"].SqlDbType);
        Assert.Equal(20, command.Parameters["@OutputLifecycleStatus"].Size);
        Assert.Equal(SqlDbType.DateTime2, command.Parameters["@OutputFinalizedAt"].SqlDbType);
        Assert.Equal(7, command.Parameters["@OutputFinalizedAt"].Scale);
        Assert.Equal(SqlDbType.Int, command.Parameters["@OutputReversedByUserId"].SqlDbType);
    }

    [Fact]
    public void ReadResult_MapsLifecycleValuesWithoutResultSetOrdinals()
    {
        var finalizedAt = new DateTime(2026, 7, 12, 10, 30, 0, DateTimeKind.Utc);
        using var command = new SqlCommand();
        WorkReportLifecycleOutputContract.AddOutputParameters(command);
        command.Parameters["@OutputStatus"].Value = "הוגש";
        command.Parameters["@OutputLifecycleStatus"].Value = "Finalized";
        command.Parameters["@OutputFinalizedAt"].Value = finalizedAt;
        command.Parameters["@OutputFinalizedByUserId"].Value = 7;
        command.Parameters["@OutputReversedAt"].Value = DBNull.Value;
        command.Parameters["@OutputReversedByUserId"].Value = DBNull.Value;
        command.Parameters["@OutputReversalReason"].Value = DBNull.Value;

        var result = WorkReportLifecycleOutputContract.ReadResult(command, 42, "Finalized");

        Assert.Equal(42, result.WorkReportId);
        Assert.Equal("הוגש", result.Status);
        Assert.Equal("Finalized", result.LifecycleStatus);
        Assert.Equal(finalizedAt, result.FinalizedAt);
        Assert.Equal(7, result.FinalizedByUserId);
        Assert.Null(result.ReversedAt);
    }

    [Fact]
    public void ReadResult_UsesExpectedLifecycleWhenOptionalOutputsAreNull()
    {
        using var command = new SqlCommand();
        WorkReportLifecycleOutputContract.AddOutputParameters(command);
        foreach (SqlParameter parameter in command.Parameters)
        {
            parameter.Value = DBNull.Value;
        }

        var result = WorkReportLifecycleOutputContract.ReadResult(command, 42, "Finalized");

        Assert.Equal(42, result.WorkReportId);
        Assert.Equal("Finalized", result.LifecycleStatus);
        Assert.Null(result.Status);
        Assert.Null(result.FinalizedAt);
        Assert.Null(result.ReversedAt);
    }
}

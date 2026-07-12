using System.Data;
using ManageR2.Infrastructure.Models;
using Microsoft.Data.SqlClient;

namespace ManageR2.Infrastructure.Repositories;

public static class WorkReportLifecycleOutputContract
{
    private const string StatusParameter = "@OutputStatus";
    private const string LifecycleStatusParameter = "@OutputLifecycleStatus";
    private const string FinalizedAtParameter = "@OutputFinalizedAt";
    private const string FinalizedByUserIdParameter = "@OutputFinalizedByUserId";
    private const string ReversedAtParameter = "@OutputReversedAt";
    private const string ReversedByUserIdParameter = "@OutputReversedByUserId";
    private const string ReversalReasonParameter = "@OutputReversalReason";

    public static void AddOutputParameters(SqlCommand command)
    {
        AddOutputParameter(command, StatusParameter, SqlDbType.NVarChar, 50);
        AddOutputParameter(command, LifecycleStatusParameter, SqlDbType.NVarChar, 20);
        AddOutputParameter(command, FinalizedAtParameter, SqlDbType.DateTime2);
        AddOutputParameter(command, FinalizedByUserIdParameter, SqlDbType.Int);
        AddOutputParameter(command, ReversedAtParameter, SqlDbType.DateTime2);
        AddOutputParameter(command, ReversedByUserIdParameter, SqlDbType.Int);
        AddOutputParameter(command, ReversalReasonParameter, SqlDbType.NVarChar, 500);
    }

    public static WorkReportLifecycleResultModel ReadResult(
        SqlCommand command,
        int workReportId,
        string expectedLifecycleStatus)
    {
        return new WorkReportLifecycleResultModel
        {
            WorkReportId = workReportId,
            Status = GetNullableString(command, StatusParameter),
            LifecycleStatus =
                GetNullableString(command, LifecycleStatusParameter) ?? expectedLifecycleStatus,
            FinalizedAt = GetNullableDateTime(command, FinalizedAtParameter),
            FinalizedByUserId = GetNullableInt(command, FinalizedByUserIdParameter),
            ReversedAt = GetNullableDateTime(command, ReversedAtParameter),
            ReversedByUserId = GetNullableInt(command, ReversedByUserIdParameter),
            ReversalReason = GetNullableString(command, ReversalReasonParameter)
        };
    }

    private static void AddOutputParameter(
        SqlCommand command,
        string parameterName,
        SqlDbType sqlDbType,
        int? size = null)
    {
        var parameter = size.HasValue
            ? command.Parameters.Add(parameterName, sqlDbType, size.Value)
            : command.Parameters.Add(parameterName, sqlDbType);
        parameter.Direction = ParameterDirection.Output;
        if (sqlDbType == SqlDbType.DateTime2)
        {
            parameter.Scale = 7;
        }
    }

    private static string? GetNullableString(SqlCommand command, string parameterName)
    {
        var value = command.Parameters[parameterName].Value;
        return value as string;
    }

    private static DateTime? GetNullableDateTime(SqlCommand command, string parameterName)
    {
        var value = command.Parameters[parameterName].Value;
        if (value == null || value == DBNull.Value)
        {
            return null;
        }

        return value is DateTime dateTime ? dateTime : null;
    }

    private static int? GetNullableInt(SqlCommand command, string parameterName)
    {
        var value = command.Parameters[parameterName].Value;
        if (value == null || value == DBNull.Value)
        {
            return null;
        }

        return value is int integer ? integer : null;
    }
}

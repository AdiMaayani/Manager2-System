using System.Data;
using ManageR2.Domain.Exceptions;
using ManageR2.Domain.Features.SmartAssignment;
using ManageR2.Infrastructure.DAL;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Features.SmartAssignment.Repositories;

public sealed class SmartAssignmentPolicyRepository : ISmartAssignmentPolicyRepository
{
    private const int ConcurrencyErrorNumber = 53209;

    private readonly DBServices _dbServices;
    private readonly ILogger<SmartAssignmentPolicyRepository> _logger;

    public SmartAssignmentPolicyRepository(
        DBServices dbServices,
        ILogger<SmartAssignmentPolicyRepository> logger)
    {
        _dbServices = dbServices;
        _logger = logger;
    }

    public async Task<IReadOnlyList<SmartAssignmentPolicyProfileRecord>> GetProfilesAsync()
    {
        var policies = new List<SmartAssignmentPolicyProfileRecord>();

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.Rec_GetSmartAssignmentPolicyProfiles", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var policy = TryMapPolicy(reader);
                if (policy is null)
                {
                    _logger.LogWarning(
                        "Ignoring a Smart Assignment policy row with an unknown profile or mode value.");
                    continue;
                }

                policies.Add(new SmartAssignmentPolicyProfileRecord(
                    policy,
                    GetBoolean(reader, "IsActive"),
                    GetNullableString(reader, "ChangeReason")));
            }

            return policies;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Failed to read Smart Assignment policy profiles.");
            throw new UserValidationException("Failed to retrieve Smart Assignment settings.", ex);
        }
    }

    public async Task<IReadOnlyList<SmartAssignmentPolicyVersionRecord>> GetVersionHistoryAsync(
        SmartAssignmentProfileKey profileKey)
    {
        var versions = new List<SmartAssignmentPolicyVersionRecord>();

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand(
                "dbo.Rec_GetSmartAssignmentPolicyVersionHistory",
                connection)
            {
                CommandType = CommandType.StoredProcedure
            };
            command.Parameters.Add("@ProfileKey", SqlDbType.NVarChar, 30).Value = profileKey.ToString();

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var policy = TryMapPolicy(reader);
                if (policy is null)
                {
                    _logger.LogWarning(
                        "Ignoring invalid Smart Assignment policy history row for {ProfileKey}.",
                        profileKey);
                    continue;
                }

                versions.Add(new SmartAssignmentPolicyVersionRecord(
                    policy,
                    GetBoolean(reader, "IsActive"),
                    GetBoolean(reader, "IsCurrentVersion"),
                    GetNullableString(reader, "ChangeReason")));
            }

            return versions;
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Failed to read Smart Assignment policy history for {ProfileKey}.", profileKey);
            throw new UserValidationException("Failed to retrieve Smart Assignment policy history.", ex);
        }
    }

    public async Task<SmartAssignmentPolicySnapshot> SaveVersionAsync(
        SmartAssignmentPolicySaveCommand saveCommand)
    {
        var policy = saveCommand.Policy;

        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand(
                "dbo.Rec_SaveSmartAssignmentPolicyVersion",
                connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            AddSaveParameters(command, saveCommand);

            await connection.OpenAsync();
            await using var reader = await command.ExecuteReaderAsync();
            if (!await reader.ReadAsync())
            {
                throw new UserValidationException(
                    "The Smart Assignment policy was saved but could not be reloaded.");
            }

            return TryMapPolicy(reader)
                ?? throw new UserValidationException(
                    "The saved Smart Assignment policy contains invalid persisted values.");
        }
        catch (SqlException ex) when (ex.Number == ConcurrencyErrorNumber)
        {
            throw new SmartAssignmentPolicyConcurrencyException(policy.ProfileKey, ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Failed to save Smart Assignment policy {ProfileKey}.", policy.ProfileKey);
            throw new UserValidationException("Failed to save Smart Assignment settings.", ex);
        }
    }

    private static void AddSaveParameters(
        SqlCommand command,
        SmartAssignmentPolicySaveCommand saveCommand)
    {
        var policy = saveCommand.Policy;

        command.Parameters.Add("@ProfileKey", SqlDbType.NVarChar, 30).Value = policy.ProfileKey.ToString();
        command.Parameters.Add("@ExpectedVersionNumber", SqlDbType.Int).Value = saveCommand.ExpectedVersionNumber;
        command.Parameters.Add("@DisplayName", SqlDbType.NVarChar, 150).Value = policy.DisplayName;
        command.Parameters.Add("@Description", SqlDbType.NVarChar, 500).Value = DbValue(policy.Description);
        AddDecimal(command, "@ProfessionalFitWeight", policy.Weights.ProfessionalFit);
        AddDecimal(command, "@AvailabilityWeight", policy.Weights.Availability);
        AddDecimal(command, "@WorkloadWeight", policy.Weights.Workload);
        AddDecimal(command, "@GeographyWeight", policy.Weights.Geography);
        AddDecimal(command, "@ExperienceWeight", policy.Weights.Experience);
        command.Parameters.Add("@MissingCriticalSkillRejects", SqlDbType.Bit).Value = policy.MissingCriticalSkillRejects;
        command.Parameters.Add("@ExactRequiredRoleMandatory", SqlDbType.Bit).Value = policy.ExactRequiredRoleMandatory;
        command.Parameters.Add("@MissingAvailabilityMode", SqlDbType.NVarChar, 20).Value =
            policy.MissingAvailabilityMode.ToString();
        AddDecimal(command, "@MissingAvailabilityScore", policy.MissingAvailabilityScore);
        AddDecimal(command, "@MissingRouteScore", policy.MissingRouteScore);
        AddDecimal(command, "@MissingWorkloadScore", policy.MissingWorkloadScore);
        AddDecimal(command, "@MissingExperienceScore", policy.MissingExperienceScore);
        AddDecimal(command, "@NoRequirementsProfessionalFitScore", policy.NoRequirementsProfessionalFitScore);
        command.Parameters.Add("@UseContinuityAsTieBreak", SqlDbType.Bit).Value = policy.UseContinuityAsTieBreak;
        command.Parameters.Add("@EnableBatchSimulatedLoadBalancing", SqlDbType.Bit).Value =
            policy.EnableBatchSimulatedLoadBalancing;
        command.Parameters.Add("@IsActive", SqlDbType.Bit).Value = saveCommand.IsActive;
        command.Parameters.Add("@ChangeReason", SqlDbType.NVarChar, 500).Value = DbValue(saveCommand.ChangeReason);
        command.Parameters.Add("@UpdatedByUserId", SqlDbType.Int).Value = saveCommand.UpdatedByUserId;
        command.Parameters.Add("@ClientIp", SqlDbType.NVarChar, 64).Value = DbValue(saveCommand.ClientIp);
        command.Parameters.Add("@UserAgent", SqlDbType.NVarChar, 512).Value = DbValue(saveCommand.UserAgent);
        command.Parameters.Add("@IsReset", SqlDbType.Bit).Value = saveCommand.IsReset;
    }

    private static void AddDecimal(SqlCommand command, string name, decimal value)
    {
        var parameter = command.Parameters.Add(name, SqlDbType.Decimal);
        // Preserve extra input precision so the SP can reject it explicitly instead of rounding silently.
        parameter.Precision = 7;
        parameter.Scale = 4;
        parameter.Value = value;
    }

    private static SmartAssignmentPolicySnapshot? TryMapPolicy(SqlDataReader reader)
    {
        var profileText = GetNullableString(reader, "ProfileKey");
        var modeText = GetNullableString(reader, "MissingAvailabilityMode");
        if (!Enum.TryParse<SmartAssignmentProfileKey>(profileText, true, out var profileKey)
            || !Enum.IsDefined(profileKey)
            || !Enum.TryParse<MissingAvailabilityMode>(modeText, true, out var mode)
            || !Enum.IsDefined(mode))
        {
            return null;
        }

        return new SmartAssignmentPolicySnapshot(
            ProfileKey: profileKey,
            DisplayName: GetNullableString(reader, "DisplayName") ?? string.Empty,
            Description: GetNullableString(reader, "Description"),
            Version: GetInt32(reader, "VersionNumber"),
            Weights: new SmartAssignmentWeights(
                GetDecimal(reader, "ProfessionalFitWeight"),
                GetDecimal(reader, "AvailabilityWeight"),
                GetDecimal(reader, "WorkloadWeight"),
                GetDecimal(reader, "GeographyWeight"),
                GetDecimal(reader, "ExperienceWeight")),
            MissingCriticalSkillRejects: GetBoolean(reader, "MissingCriticalSkillRejects"),
            ExactRequiredRoleMandatory: GetBoolean(reader, "ExactRequiredRoleMandatory"),
            MissingAvailabilityMode: mode,
            MissingAvailabilityScore: GetDecimal(reader, "MissingAvailabilityScore"),
            MissingRouteScore: GetDecimal(reader, "MissingRouteScore"),
            MissingWorkloadScore: GetDecimal(reader, "MissingWorkloadScore"),
            MissingExperienceScore: GetDecimal(reader, "MissingExperienceScore"),
            NoRequirementsProfessionalFitScore: GetDecimal(reader, "NoRequirementsProfessionalFitScore"),
            UseContinuityAsTieBreak: GetBoolean(reader, "UseContinuityAsTieBreak"),
            EnableBatchSimulatedLoadBalancing: GetBoolean(reader, "EnableBatchSimulatedLoadBalancing"),
            UpdatedAtUtc: GetNullableDateTime(reader, "UpdatedAtUtc"),
            UpdatedByUserId: GetNullableInt32(reader, "UpdatedByUserId"));
    }

    private static object DbValue(string? value) =>
        string.IsNullOrWhiteSpace(value) ? DBNull.Value : value.Trim();

    private static bool HasColumn(SqlDataReader reader, string columnName)
    {
        for (var index = 0; index < reader.FieldCount; index++)
        {
            if (string.Equals(reader.GetName(index), columnName, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private static string? GetNullableString(SqlDataReader reader, string name) =>
        !HasColumn(reader, name) || reader[name] == DBNull.Value ? null : Convert.ToString(reader[name]);

    private static int GetInt32(SqlDataReader reader, string name) => Convert.ToInt32(reader[name]);

    private static int? GetNullableInt32(SqlDataReader reader, string name) =>
        !HasColumn(reader, name) || reader[name] == DBNull.Value ? null : Convert.ToInt32(reader[name]);

    private static decimal GetDecimal(SqlDataReader reader, string name) => Convert.ToDecimal(reader[name]);

    private static bool GetBoolean(SqlDataReader reader, string name) =>
        HasColumn(reader, name) && reader[name] != DBNull.Value && Convert.ToBoolean(reader[name]);

    private static DateTime? GetNullableDateTime(SqlDataReader reader, string name)
    {
        if (!HasColumn(reader, name) || reader[name] == DBNull.Value)
        {
            return null;
        }

        return DateTime.SpecifyKind(Convert.ToDateTime(reader[name]), DateTimeKind.Utc);
    }
}

public sealed class SmartAssignmentPolicyConcurrencyException : Exception
{
    public SmartAssignmentPolicyConcurrencyException(
        SmartAssignmentProfileKey profileKey,
        Exception innerException)
        : base($"Smart Assignment policy '{profileKey}' was changed by another user.", innerException)
    {
        ProfileKey = profileKey;
    }

    public SmartAssignmentProfileKey ProfileKey { get; }
}

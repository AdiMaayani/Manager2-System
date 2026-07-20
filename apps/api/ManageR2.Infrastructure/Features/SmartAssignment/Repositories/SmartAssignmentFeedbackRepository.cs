using System.Data;
using System.Text.Json;
using System.Text.Json.Serialization;
using ManageR2.Domain.Exceptions;
using ManageR2.Domain.Features.SmartAssignment;
using ManageR2.Infrastructure.DAL;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Features.SmartAssignment.Repositories;

public sealed class SmartAssignmentFeedbackRepository : ISmartAssignmentFeedbackRepository
{
    private const int BusinessErrorStart = 54000;
    private const int BusinessErrorEnd = 54999;
    private static readonly JsonSerializerOptions PolicySnapshotJsonOptions = new()
    {
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly DBServices _dbServices;
    private readonly ILogger<SmartAssignmentFeedbackRepository> _logger;

    public SmartAssignmentFeedbackRepository(
        DBServices dbServices,
        ILogger<SmartAssignmentFeedbackRepository> logger)
    {
        _dbServices = dbServices;
        _logger = logger;
    }

    public async Task<RecommendationFeedbackRecord> UpsertAsync(
        RecommendationFeedbackCommand feedback,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.Rec_UpsertRecommendationFeedback", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            AddIdentityParameters(command, feedback.Identity);
            command.Parameters.Add("@Rating", SqlDbType.TinyInt).Value = feedback.Rating;
            command.Parameters.Add("@Comment", SqlDbType.NVarChar, 1000).Value = DbValue(feedback.Comment);
            command.Parameters.Add("@ActingUserId", SqlDbType.Int).Value = feedback.ActingUserId;
            command.Parameters.Add("@ClientIp", SqlDbType.NVarChar, 64).Value = DbValue(feedback.ClientIp);
            command.Parameters.Add("@UserAgent", SqlDbType.NVarChar, 512).Value = DbValue(feedback.UserAgent);

            await connection.OpenAsync(cancellationToken);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                throw new UserValidationException(
                    "The recommendation feedback was saved but could not be reloaded.");
            }

            return MapFeedback(reader);
        }
        catch (SqlException ex) when (IsBusinessError(ex.Number))
        {
            throw new UserValidationException(ex.Message, ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(
                ex,
                "Failed to save Smart Assignment feedback for run {RecommendationRunId}, task {WorkItemId}, and employee {EmployeeId}.",
                feedback.Identity.RecommendationRunId,
                feedback.Identity.WorkItemId,
                feedback.Identity.RecommendedEmployeeId);
            throw new UserValidationException("Failed to save recommendation feedback.", ex);
        }
    }

    public async Task<RecommendationFeedbackRecord?> GetAsync(
        RecommendationFeedbackIdentity identity,
        int actingUserId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.Rec_GetRecommendationFeedback", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            AddIdentityParameters(command, identity);
            command.Parameters.Add("@ActingUserId", SqlDbType.Int).Value = actingUserId;

            await connection.OpenAsync(cancellationToken);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            return await reader.ReadAsync(cancellationToken) ? MapFeedback(reader) : null;
        }
        catch (SqlException ex) when (IsBusinessError(ex.Number))
        {
            throw new UserValidationException(ex.Message, ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(
                ex,
                "Failed to load Smart Assignment feedback for run {RecommendationRunId}, task {WorkItemId}, and employee {EmployeeId}.",
                identity.RecommendationRunId,
                identity.WorkItemId,
                identity.RecommendedEmployeeId);
            throw new UserValidationException("Failed to retrieve recommendation feedback.", ex);
        }
    }

    public async Task<TaskAssignmentFeedbackStateRecord?> GetTaskAssignmentStateAsync(
        int workItemId,
        int assignedEmployeeId,
        int actingUserId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await using var connection = _dbServices.CreateConnection();
            await using var command = new SqlCommand("dbo.Rec_GetTaskAssignmentFeedbackState", connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            command.Parameters.Add("@WorkItemId", SqlDbType.Int).Value = workItemId;
            command.Parameters.Add("@AssignedEmployeeId", SqlDbType.Int).Value = assignedEmployeeId;
            command.Parameters.Add("@ActingUserId", SqlDbType.Int).Value = actingUserId;

            await connection.OpenAsync(cancellationToken);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            return await reader.ReadAsync(cancellationToken) ? MapAssignmentState(reader) : null;
        }
        catch (SqlException ex) when (IsBusinessError(ex.Number))
        {
            throw new UserValidationException(ex.Message, ex);
        }
        catch (SqlException ex)
        {
            _logger.LogError(
                ex,
                "Failed to load Smart Assignment feedback state for task {WorkItemId} and employee {EmployeeId}.",
                workItemId,
                assignedEmployeeId);
            throw new UserValidationException("Failed to retrieve assignment feedback state.", ex);
        }
    }

    private static void AddIdentityParameters(SqlCommand command, RecommendationFeedbackIdentity identity)
    {
        command.Parameters.Add("@RecommendationRunId", SqlDbType.Int).Value = identity.RecommendationRunId;
        command.Parameters.Add("@WorkItemId", SqlDbType.Int).Value = identity.WorkItemId;
        command.Parameters.Add("@RecommendedEmployeeId", SqlDbType.Int).Value = identity.RecommendedEmployeeId;
        command.Parameters.Add("@PolicyProfileKey", SqlDbType.NVarChar, 30).Value = identity.PolicyProfileKey;
        command.Parameters.Add("@PolicyVersion", SqlDbType.Int).Value = identity.PolicyVersion;
    }

    private static RecommendationFeedbackRecord MapFeedback(SqlDataReader reader) =>
        new(
            Convert.ToInt64(reader["RecommendationFeedbackId"]),
            Convert.ToInt32(reader["RecommendationRunId"]),
            Convert.ToInt32(reader["WorkItemId"]),
            Convert.ToInt32(reader["RecommendedEmployeeId"]),
            Convert.ToString(reader["PolicyProfileKey"]) ?? string.Empty,
            Convert.ToInt32(reader["PolicyVersion"]),
            Convert.ToInt32(reader["Rating"]),
            GetNullableString(reader, "Comment"),
            Convert.ToInt32(reader["ActingUserId"]),
            AsUtc(reader["CreatedAtUtc"]),
            AsUtc(reader["UpdatedAtUtc"]),
            GetBoolean(reader, "WasCreated"),
            GetBoolean(reader, "WasChanged"));

    private static TaskAssignmentFeedbackStateRecord MapAssignmentState(SqlDataReader reader)
    {
        RecommendationFeedbackRecord? feedback = null;
        if (reader["RecommendationFeedbackId"] != DBNull.Value)
        {
            feedback = MapFeedback(reader);
        }

        TaskAssignmentRecommendationRecord? recommendation = null;
        var recommendationId = GetNullableInt(reader, "RecommendationId");
        var recommendationRunId = GetNullableInt(reader, "RecommendationRunId");
        var rankOrder = GetNullableInt(reader, "RankOrder");
        var totalScore = GetNullableDecimal(reader, "Score");
        if (recommendationId.HasValue
            && recommendationRunId.HasValue
            && rankOrder.HasValue
            && totalScore.HasValue)
        {
            recommendation = new TaskAssignmentRecommendationRecord(
                recommendationId.Value,
                recommendationRunId.Value,
                rankOrder.Value,
                totalScore.Value,
                GetNullableString(reader, "PolicyProfileKey"),
                GetNullableInt(reader, "PolicyVersion"),
                GetNullableString(reader, "PolicyDisplayName"),
                GetNullableInt(reader, "TravelMinutes"),
                GetNullableDecimal(reader, "DistanceKm"),
                BuildRecommendationFactors(
                    GetNullableDecimal(reader, "ProfessionalScore"),
                    GetNullableDecimal(reader, "AvailabilityScore"),
                    GetNullableDecimal(reader, "WorkloadScore"),
                    GetNullableDecimal(reader, "GeographicScore"),
                    GetNullableDecimal(reader, "ExperienceScore"),
                    GetNullableDecimal(reader, "ContinuityScore"),
                    GetNullableString(reader, "PolicySnapshotJson")));
        }

        return new TaskAssignmentFeedbackStateRecord(
            Convert.ToInt32(reader["WorkItemId"]),
            Convert.ToInt32(reader["AssignedEmployeeId"]),
            Convert.ToString(reader["AssignedEmployeeName"]) ?? string.Empty,
            GetBoolean(reader, "IsManualAssignment"),
            Convert.ToString(reader["AssignmentMethod"]) ?? "Manual",
            GetNullableInt(reader, "RecommendationRunId"),
            GetNullableString(reader, "PolicyProfileKey"),
            GetNullableInt(reader, "PolicyVersion"),
            rankOrder,
            totalScore,
            feedback,
            recommendation);
    }

    private static IReadOnlyList<TaskAssignmentRecommendationFactorRecord> BuildRecommendationFactors(
        decimal? professionalScore,
        decimal? availabilityScore,
        decimal? workloadScore,
        decimal? geographicScore,
        decimal? experienceScore,
        decimal? continuityScore,
        string? policySnapshotJson)
    {
        var weights = TryReadValidatedWeights(policySnapshotJson);
        return
        [
            CreateWeightedFactor(
                SmartAssignmentFactorCodes.ProfessionalFit,
                professionalScore,
                weights?.ProfessionalFit),
            CreateWeightedFactor(
                SmartAssignmentFactorCodes.Availability,
                availabilityScore,
                weights?.Availability),
            CreateWeightedFactor(
                SmartAssignmentFactorCodes.Workload,
                workloadScore,
                weights?.Workload),
            CreateWeightedFactor(
                SmartAssignmentFactorCodes.Geography,
                geographicScore,
                weights?.Geography),
            CreateWeightedFactor(
                SmartAssignmentFactorCodes.Experience,
                experienceScore,
                weights?.Experience),
            new TaskAssignmentRecommendationFactorRecord(
                SmartAssignmentFactorCodes.Continuity,
                continuityScore,
                null,
                null,
                IsTieBreak: true)
        ];
    }

    private static TaskAssignmentRecommendationFactorRecord CreateWeightedFactor(
        string key,
        decimal? score,
        decimal? weightPercent) =>
        new(
            key,
            score,
            weightPercent,
            score.HasValue && weightPercent.HasValue
                ? SmartAssignmentPolicyScoreCalculator.CalculateContribution(
                    score.Value,
                    weightPercent.Value)
                : null,
            IsTieBreak: false);

    private static SmartAssignmentWeights? TryReadValidatedWeights(string? policySnapshotJson)
    {
        if (string.IsNullOrWhiteSpace(policySnapshotJson))
        {
            return null;
        }

        try
        {
            var snapshot = JsonSerializer.Deserialize<SmartAssignmentPolicySnapshot>(
                policySnapshotJson,
                PolicySnapshotJsonOptions);
            return SmartAssignmentPolicyValidator.Validate(snapshot).IsValid
                ? snapshot!.Weights
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
        catch (NotSupportedException)
        {
            return null;
        }
    }

    private static object DbValue(string? value) => value is null ? DBNull.Value : value;

    private static string? GetNullableString(SqlDataReader reader, string name) =>
        reader[name] == DBNull.Value ? null : Convert.ToString(reader[name]);

    private static int? GetNullableInt(SqlDataReader reader, string name) =>
        reader[name] == DBNull.Value ? null : Convert.ToInt32(reader[name]);

    private static decimal? GetNullableDecimal(SqlDataReader reader, string name) =>
        reader[name] == DBNull.Value ? null : Convert.ToDecimal(reader[name]);

    private static bool GetBoolean(SqlDataReader reader, string name) =>
        reader[name] != DBNull.Value && Convert.ToBoolean(reader[name]);

    private static DateTime AsUtc(object value) =>
        DateTime.SpecifyKind(Convert.ToDateTime(value), DateTimeKind.Utc);

    private static bool IsBusinessError(int number) =>
        number is >= BusinessErrorStart and <= BusinessErrorEnd;
}

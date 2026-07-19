namespace ManageR2.Infrastructure.Features.SmartAssignment.Repositories;

public interface ISmartAssignmentFeedbackRepository
{
    Task<RecommendationFeedbackRecord> UpsertAsync(
        RecommendationFeedbackCommand command,
        CancellationToken cancellationToken = default);

    Task<RecommendationFeedbackRecord?> GetAsync(
        RecommendationFeedbackIdentity identity,
        int actingUserId,
        CancellationToken cancellationToken = default);

    Task<TaskAssignmentFeedbackStateRecord?> GetTaskAssignmentStateAsync(
        int workItemId,
        int assignedEmployeeId,
        int actingUserId,
        CancellationToken cancellationToken = default);
}

public sealed record RecommendationFeedbackIdentity(
    int RecommendationRunId,
    int WorkItemId,
    int RecommendedEmployeeId,
    string PolicyProfileKey,
    int PolicyVersion);

public sealed record RecommendationFeedbackCommand(
    RecommendationFeedbackIdentity Identity,
    int Rating,
    string? Comment,
    int ActingUserId,
    string? ClientIp,
    string? UserAgent);

public sealed record RecommendationFeedbackRecord(
    long RecommendationFeedbackId,
    int RecommendationRunId,
    int WorkItemId,
    int RecommendedEmployeeId,
    string PolicyProfileKey,
    int PolicyVersion,
    int Rating,
    string? Comment,
    int ActingUserId,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    bool WasCreated,
    bool WasChanged);

public sealed record TaskAssignmentFeedbackStateRecord(
    int WorkItemId,
    int AssignedEmployeeId,
    string AssignedEmployeeName,
    bool IsManualAssignment,
    string AssignmentMethod,
    int? RecommendationRunId,
    string? PolicyProfileKey,
    int? PolicyVersion,
    int? RankOrder,
    decimal? Score,
    RecommendationFeedbackRecord? Feedback,
    TaskAssignmentRecommendationRecord? Recommendation);

public sealed record TaskAssignmentRecommendationRecord(
    int RecommendationId,
    int RecommendationRunId,
    int RankOrder,
    decimal TotalScore,
    string? PolicyProfileKey,
    int? PolicyVersion,
    string? PolicyDisplayName,
    int? TravelMinutes,
    decimal? DistanceKm,
    IReadOnlyList<TaskAssignmentRecommendationFactorRecord> Factors);

public sealed record TaskAssignmentRecommendationFactorRecord(
    string Key,
    decimal? Score,
    decimal? WeightPercent,
    decimal? WeightedContribution,
    bool IsTieBreak);

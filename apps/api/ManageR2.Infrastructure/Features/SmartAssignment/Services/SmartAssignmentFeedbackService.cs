using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.Features.SmartAssignment.Repositories;

namespace ManageR2.Infrastructure.Services.SmartAssignment;

public interface ISmartAssignmentFeedbackService
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

public sealed class SmartAssignmentFeedbackService : ISmartAssignmentFeedbackService
{
    private readonly ISmartAssignmentFeedbackRepository _repository;

    public SmartAssignmentFeedbackService(ISmartAssignmentFeedbackRepository repository)
    {
        _repository = repository;
    }

    public Task<RecommendationFeedbackRecord> UpsertAsync(
        RecommendationFeedbackCommand command,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);
        var normalized = Normalize(command);
        Validate(normalized.Identity, normalized.ActingUserId, normalized.Rating, normalized.Comment);
        return _repository.UpsertAsync(normalized, cancellationToken);
    }

    public Task<RecommendationFeedbackRecord?> GetAsync(
        RecommendationFeedbackIdentity identity,
        int actingUserId,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(identity);
        var normalizedIdentity = Normalize(identity);
        Validate(normalizedIdentity, actingUserId);
        return _repository.GetAsync(normalizedIdentity, actingUserId, cancellationToken);
    }

    public Task<TaskAssignmentFeedbackStateRecord?> GetTaskAssignmentStateAsync(
        int workItemId,
        int assignedEmployeeId,
        int actingUserId,
        CancellationToken cancellationToken = default)
    {
        if (workItemId < 1 || assignedEmployeeId < 1 || actingUserId < 1)
        {
            throw new UserValidationException("Assignment feedback identifiers must be positive.");
        }

        return _repository.GetTaskAssignmentStateAsync(
            workItemId,
            assignedEmployeeId,
            actingUserId,
            cancellationToken);
    }

    private static RecommendationFeedbackCommand Normalize(RecommendationFeedbackCommand command) =>
        command with
        {
            Identity = Normalize(command.Identity),
            Comment = CleanOptional(command.Comment),
            ClientIp = CleanAndLimit(command.ClientIp, 64),
            UserAgent = CleanAndLimit(command.UserAgent, 512)
        };

    private static RecommendationFeedbackIdentity Normalize(RecommendationFeedbackIdentity identity) =>
        identity with { PolicyProfileKey = identity.PolicyProfileKey?.Trim() ?? string.Empty };

    private static void Validate(
        RecommendationFeedbackIdentity identity,
        int actingUserId,
        int? rating = null,
        string? comment = null)
    {
        if (identity.RecommendationRunId < 1
            || identity.WorkItemId < 1
            || identity.RecommendedEmployeeId < 1
            || actingUserId < 1)
        {
            throw new UserValidationException("Recommendation feedback identifiers must be positive.");
        }

        if (string.IsNullOrWhiteSpace(identity.PolicyProfileKey)
            || identity.PolicyProfileKey.Length > 30
            || identity.PolicyVersion < 1)
        {
            throw new UserValidationException("A valid persisted recommendation policy is required.");
        }

        if (rating is < 1 or > 10)
        {
            throw new UserValidationException("Rating must be between 1 and 10.");
        }

        if (comment?.Length > 1000)
        {
            throw new UserValidationException("Comment must be at most 1000 characters.");
        }
    }

    private static string? CleanOptional(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    private static string? CleanAndLimit(string? value, int maxLength)
    {
        var trimmed = CleanOptional(value);
        return trimmed is null || trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }
}

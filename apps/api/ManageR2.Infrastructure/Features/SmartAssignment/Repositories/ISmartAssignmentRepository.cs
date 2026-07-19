using ManageR2.Infrastructure.Models.SmartAssignment;

namespace ManageR2.Infrastructure.Repositories.SmartAssignment;

public interface ISmartAssignmentRepository
{
    Task<TaskRecommendationInputModel> GetTaskRecommendationInputAsync(int workItemId);

    Task<TaskRecommendationInputModel> GetDraftTaskRecommendationInputAsync(
        DraftTaskRecommendationContextModel context);

    Task<int> CreateRecommendationRunAsync(
        string scopeType,
        int? projectId,
        int? taskId,
        int? requestedByUserId,
        string algorithmVersion,
        string? inputSnapshotJson);

    Task SaveTaskAssignmentRecommendationAsync(
        int runId,
        int taskId,
        EmployeeCandidateModel candidate);

    Task CompleteRecommendationRunAsync(int runId);
}

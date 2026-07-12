using ManageR2.Infrastructure.Models.SmartAssignment;

namespace ManageR2.Infrastructure.Repositories.SmartAssignment
{
    // Provider-neutral contract for the SmartAssignment data layer (Wave 5 dual-run refactor).
    // Extracted from the concrete SmartAssignmentRepository so the SQL Server baseline, the
    // PostgreSQL implementation, and the dual-run router can all be resolved behind one abstraction.
    // Only data access lives here; all scoring/eligibility/ranking stays in SmartAssignmentService.
    public interface ISmartAssignmentRepository
    {
        // Loads the unified recommendation input for a saved work item (Rec_GetTaskRecommendationInput).
        Task<TaskRecommendationInputModel> GetTaskRecommendationInputAsync(int workItemId);

        // Loads the unified recommendation input for a not-yet-saved draft task
        // (Rec_GetDraftTaskRecommendationInput), synthesizing the task core row from the draft context.
        Task<TaskRecommendationInputModel> GetDraftTaskRecommendationInputAsync(
            DraftTaskRecommendationContextModel context);

        // Creates a recommendation run header and returns its new id (Rec_CreateRecommendationRun).
        Task<int> CreateRecommendationRunAsync(
            string scopeType,
            int? projectId,
            int? taskId,
            int? requestedByUserId,
            string algorithmVersion,
            string? inputSnapshotJson);

        // Persists one ranked candidate row for a task within a run (Rec_SaveTaskAssignmentRecommendation).
        Task SaveTaskAssignmentRecommendationAsync(int runId, int taskId, EmployeeCandidateModel candidate);
    }
}

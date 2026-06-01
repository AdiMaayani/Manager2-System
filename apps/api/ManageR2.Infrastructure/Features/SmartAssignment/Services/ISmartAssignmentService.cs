using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Services;

// Batch smart-assignment orchestration for SmartAssignmentController; DI supplies the concrete ISmartAssignmentService implementation.
public interface ISmartAssignmentService
{
    // Runs recommendation engine for many tasks (project or explicit ids) and returns run summary + per-task rows.
    Task<SmartAssignmentRunResultModel> GenerateRecommendationsAsync(SmartAssignmentRequestModel request);
}

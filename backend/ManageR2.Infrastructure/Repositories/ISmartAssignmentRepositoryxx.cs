using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Repositories;

public interface ISmartAssignmentRepository
{
    Task<SmartAssignmentInputModel> GetAssignmentInputAsync(int? projectId, List<int>? workItemIds, DateTime? planningDate);
    Task<int> CreateRecommendationRunAsync(SmartAssignmentRunResultModel run);
    Task SaveRecommendationsAsync(int recommendationRunId, List<SmartAssignmentRecommendationModel> recommendations);
    Task<SmartAssignmentRunResultModel?> GetRecommendationRunAsync(int recommendationRunId);
}

using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Services;

public interface ISmartAssignmentService
{
    Task<SmartAssignmentRunResultModel> GenerateRecommendationsAsync(SmartAssignmentRequestModel request);
}

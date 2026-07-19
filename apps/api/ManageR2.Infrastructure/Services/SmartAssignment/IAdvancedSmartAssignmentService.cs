using ManageR2.Infrastructure.Models.SmartAssignment;

using ManageR2.Domain.Features.SmartAssignment;

namespace ManageR2.Infrastructure.Services.SmartAssignment
{
    // English: single work-item ranked recommendations (AdvancedSmartAssignmentController → this → SmartAssignmentRepository).
    // Interface לשירות האלגוריתם המתקדם .
    // מגדיר מה ה-Service חייב לדעת לבצע.
    public interface IAdvancedSmartAssignmentService
    {
        // מקבל מזהה משימה ומחזיר רשימת עובדים מדורגת לפי האלגוריתם.
        Task<List<EmployeeCandidateModel>> GetRecommendationsAsync(int workItemId);

        Task<List<EmployeeCandidateModel>> GetRecommendationsAsync(
            int workItemId,
            CancellationToken cancellationToken);

        // מקבל הקשר של משימת טיוטה (משימה חדשה שעדיין לא נשמרה) ומחזיר רשימת עובדים מדורגת.
        Task<List<EmployeeCandidateModel>> GetRecommendationsForDraftAsync(
            DraftTaskRecommendationContextModel context);

        Task<List<EmployeeCandidateModel>> GetRecommendationsForDraftAsync(
            DraftTaskRecommendationContextModel context,
            CancellationToken cancellationToken);

        Task<SmartAssignmentEvaluationResult> EvaluateTaskAsync(
            int workItemId,
            SmartAssignmentEvaluationContext? evaluationContext = null,
            SmartAssignmentPolicySnapshot? policyOverride = null);

        Task<SmartAssignmentEvaluationResult> EvaluateTaskAsync(
            int workItemId,
            SmartAssignmentEvaluationContext? evaluationContext,
            SmartAssignmentPolicySnapshot? policyOverride,
            CancellationToken cancellationToken);

        Task<SmartAssignmentEvaluationResult> EvaluateDraftAsync(
            DraftTaskRecommendationContextModel context,
            SmartAssignmentEvaluationContext? evaluationContext = null,
            SmartAssignmentPolicySnapshot? policyOverride = null);

        Task<SmartAssignmentEvaluationResult> EvaluateDraftAsync(
            DraftTaskRecommendationContextModel context,
            SmartAssignmentEvaluationContext? evaluationContext,
            SmartAssignmentPolicySnapshot? policyOverride,
            CancellationToken cancellationToken);
    }
}

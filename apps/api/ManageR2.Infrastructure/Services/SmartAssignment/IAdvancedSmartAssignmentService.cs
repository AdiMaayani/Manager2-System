using ManageR2.Infrastructure.Models.SmartAssignment;

namespace ManageR2.Infrastructure.Services.SmartAssignment
{
    // English: single work-item ranked recommendations (AdvancedSmartAssignmentController → this → SmartAssignmentRepository).
    // Interface לשירות האלגוריתם המתקדם .
    // מגדיר מה ה-Service חייב לדעת לבצע.
    public interface IAdvancedSmartAssignmentService
    {
        // מקבל מזהה משימה ומחזיר רשימת עובדים מדורגת לפי האלגוריתם.
        Task<List<EmployeeCandidateModel>> GetRecommendationsAsync(int workItemId);

        // מקבל הקשר של משימת טיוטה (משימה חדשה שעדיין לא נשמרה) ומחזיר רשימת עובדים מדורגת.
        Task<List<EmployeeCandidateModel>> GetRecommendationsForDraftAsync(
            DraftTaskRecommendationContextModel context);
    }
}

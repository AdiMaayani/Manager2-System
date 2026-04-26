using ManageR2.Infrastructure.Models.SmartAssignment;

namespace ManageR2.Infrastructure.Services.SmartAssignment
{
    // Interface לשירות האלגוריתם המתקדם .
    // מגדיר מה ה-Service חייב לדעת לבצע.
    public interface IAdvancedSmartAssignmentService
    {
        // מקבל מזהה משימה ומחזיר רשימת עובדים מדורגת לפי האלגוריתם.
        Task<List<EmployeeCandidateModel>> GetRecommendationsAsync(int workItemId);
    }
}
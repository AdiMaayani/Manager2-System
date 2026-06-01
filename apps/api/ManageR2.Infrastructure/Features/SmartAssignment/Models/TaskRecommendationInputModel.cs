using System.Collections.Generic;

namespace ManageR2.Infrastructure.Models.SmartAssignment
{
    // English: hydrated by SmartAssignmentRepository from Rec_GetTaskRecommendationInput; consumed only inside Infrastructure services.
    // מחלקה זו מייצגת את כל הקלט לאלגוריתם Smart Assignment
    // זהו אובייקט מאוחד שמכיל את כל הנתונים שהגיעו מה-SP
    public class TaskRecommendationInputModel
    {
        // =========================================
        // נתוני המשימה
        // =========================================

        // המשימה עצמה (בד"כ תהיה אחת)
        public TaskCoreDataModel? Task { get; set; }

        // =========================================
        // דרישות מקצועיות
        // =========================================

        // רשימת כישורים נדרשים למשימה
        public List<RequiredSkillModel> RequiredSkills { get; set; } = new();

        // =========================================
        // עובדים
        // =========================================

        // רשימת כל העובדים המועמדים לשיבוץ
        public List<EmployeeCandidateModel> Employees { get; set; } = new();

        // כישורים של עובדים
        public List<EmployeeSkillModel> EmployeeSkills { get; set; } = new();

        // =========================================
        // זמינות ועומס
        // =========================================

        // זמינות עובדים לפי זמן
        public List<EmployeeAvailabilityModel> EmployeeAvailability { get; set; } = new();

        // קיבולת עובדים (כמה שעות יכולים לעבוד)
        public List<EmployeeCapacityModel> EmployeeCapacities { get; set; } = new();

        // =========================================
        // מיקום
        // =========================================

        // כתובות בסיס של עובדים
        public List<EmployeeBaseAddressModel> EmployeeBaseAddresses { get; set; } = new();

        // כתובת אתר המשימה
        public SiteAddressModel? SiteAddress { get; set; }

        // אזורי עבודה של עובדים
        public List<EmployeeWorkZoneModel> EmployeeWorkZones { get; set; } = new();

        // =========================================
        // היסטוריה ותכנון
        // =========================================

        // תחנות מתוכננות (איפה העובד אמור להיות)
        public List<EmployeePlannedStopModel> PlannedStops { get; set; } = new();

        // מיקומים בפועל (איפה העובד באמת היה)
        public List<EmployeeLocationEventModel> LocationEvents { get; set; } = new();

        // =========================================
        // חישובי מסלול
        // =========================================

        // מרחקים וזמני נסיעה
        public List<RouteEstimateModel> RouteEstimates { get; set; } = new();
    }
}
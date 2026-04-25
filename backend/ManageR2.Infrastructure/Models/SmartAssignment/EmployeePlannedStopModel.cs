using System;

namespace ManageR2.Infrastructure.Models.SmartAssignment
{
    // מחלקה זו מייצגת תחנה מתוכננת של עובד באותו יום
    // מגיעה מ-Result Set של Planned Stops מתוך ה-SP המאוחד
    public class EmployeePlannedStopModel
    {
        // מזהה העובד
        public int EmployeeId { get; set; }

        // מזהה האתר של התחנה המתוכננת
        public int? SiteId { get; set; }

        // זמן התחלה מתוכנן של התחנה
        public DateTime? PlannedStartAt { get; set; }

        // זמן סיום מתוכנן של התחנה
        public DateTime? PlannedEndAt { get; set; }

        // כתובת מסודרת של התחנה
        public string? FormattedAddress { get; set; }
    }
}
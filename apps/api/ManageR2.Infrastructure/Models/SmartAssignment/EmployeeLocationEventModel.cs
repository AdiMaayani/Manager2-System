using System;

namespace ManageR2.Infrastructure.Models.SmartAssignment
{
    // English: last-known / telemetry-style point used when choosing origin for distance estimates.
    // מחלקה זו מייצגת אירוע מיקום של עובד
    // מגיעה מ-Result Set של Location Events מתוך ה-SP המאוחד
    public class EmployeeLocationEventModel
    {
        // מזהה העובד
        public int EmployeeId { get; set; }

        // כתובת מסודרת של מיקום העובד באירוע
        public string? FormattedAddress { get; set; }

        // זמן האירוע
        public DateTime EventTime { get; set; }
    }
}
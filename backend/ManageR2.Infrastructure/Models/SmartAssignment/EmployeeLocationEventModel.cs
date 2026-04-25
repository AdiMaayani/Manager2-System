using System;

namespace ManageR2.Infrastructure.Models.SmartAssignment
{
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
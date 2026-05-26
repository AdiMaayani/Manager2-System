using System;

namespace ManageR2.Infrastructure.Models.SmartAssignment
{
    // English: time-window facts feeding availability score and eligibility (busy/leave blocks vs task window).
    // מחלקה זו מייצגת חלון זמינות או חוסר זמינות של עובד
    // מגיעה מ-Result Set של Availability מתוך ה-SP המאוחד
    public class EmployeeAvailabilityModel
    {
        // מזהה העובד
        public int EmployeeId { get; set; }

        // תחילת חלון הזמינות / אי הזמינות
        public DateTime AvailableFrom { get; set; }

        // סוף חלון הזמינות / אי הזמינות
        public DateTime AvailableTo { get; set; }

        // סוג הזמינות:
        // Available = זמין
        // Busy = תפוס
        // Leave = חופש
        // Sick = מחלה
        // Training = הדרכה
        public string? AvailabilityType { get; set; }

        // מקור הנתון:
        // Manual = הוזן ידנית
        // System = נוצר אוטומטית
        public string? Source { get; set; }
    }
}
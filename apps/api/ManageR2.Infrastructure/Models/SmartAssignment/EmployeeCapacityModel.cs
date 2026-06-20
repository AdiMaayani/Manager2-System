using System;

namespace ManageR2.Infrastructure.Models.SmartAssignment
{
    // English: effective-dated weekly capacity feeding workload balance against assigned hours.
    // מחלקה זו מייצגת קיבולת עבודה של עובד
    // מגיעה מ-Result Set של Capacity מתוך ה-SP המאוחד
    public class EmployeeCapacityModel
    {
        // מזהה העובד
        public int EmployeeId { get; set; }

        // קיבולת שבועית בשעות, לדוגמה: 40 שעות
        public decimal WeeklyCapacityHours { get; set; }

        // התאריך שממנו הקיבולת הזו תקפה
        public DateTime EffectiveFrom { get; set; }

        // התאריך שעד אליו הקיבולת תקפה
        // אם הערך NULL, המשמעות היא שאין תאריך סיום
        public DateTime? EffectiveTo { get; set; }
    }
}

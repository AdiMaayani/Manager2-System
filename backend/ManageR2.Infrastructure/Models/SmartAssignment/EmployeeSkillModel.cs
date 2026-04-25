using System;

namespace ManageR2.Infrastructure.Models.SmartAssignment
{
    // מחלקה זו מייצגת כישור של עובד
    // מגיעה מ-Result Set של Employee Skills מתוך ה-SP המאוחד
    public class EmployeeSkillModel
    {
        // מזהה העובד
        public int EmployeeId { get; set; }

        // מזהה הכישור
        public int SkillId { get; set; }

        // שם הכישור, לדוגמה: חשמל חכם
        public string? SkillName { get; set; }

        // רמת הכישור של העובד, בדרך כלל 1 עד 5
        public int SkillLevel { get; set; }

        // שנות ניסיון של העובד בכישור הזה
        public decimal? YearsExperience { get; set; }

        // האם לעובד יש הסמכה רשמית בכישור הזה
        public bool IsCertified { get; set; }
    }
}
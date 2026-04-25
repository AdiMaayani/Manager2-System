namespace ManageR2.Infrastructure.Models.SmartAssignment
{
    // מחלקה זו מייצגת כישור נדרש למשימה
    // מגיע מ-Result Set 2 ב-SP המאוחד
    public class RequiredSkillModel
    {
        // מזהה המשימה
        public int WorkItemId { get; set; }

        // מזהה הכישור
        public int SkillId { get; set; }

        // שם הכישור (לדוגמה: חשמל חכם)
        public string? SkillName { get; set; }

        // קטגוריה של הכישור (מערכות / תקשורת / אבטחה וכו')
        public string? SkillCategory { get; set; }

        // רמת הכישור הנדרשת למשימה (לדוגמה: 1–5)
        public int RequiredLevel { get; set; }

        // רמת חשיבות הכישור:
        // Critical = חובה
        // Important = חשוב
        // Preferred = יתרון
        public string? ImportanceLevel { get; set; }
    }
}
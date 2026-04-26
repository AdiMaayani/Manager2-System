namespace ManageR2.Api.DTOs
{
    // One ranked row returned by AdvancedSmartAssignmentController; hides full algorithm breakdown kept in service models.
    // DTO שמייצג עובד אחד ברשימת ההמלצות למנהל
    // המטרה: להחזיר ל-Frontend רק את המידע שצריך להציג,
    // ולא לחשוף את כל ציוני הביניים של האלגוריתם.
    public class AdvancedSmartAssignmentRecommendationDto
    {
        // דירוג העובד ברשימה
        // 1 = העובד המומלץ ביותר
        public int? RankOrder { get; set; }

        // מזהה העובד במערכת
        public int EmployeeId { get; set; }

        // שם מלא של העובד
        public string? FullName { get; set; }

        // תפקיד העובד
        public string? PrimaryRole { get; set; }

        // הציון הכולל בלבד
        public decimal? TotalScore { get; set; }

        // האם העובד כשיר לבחירה בפועל
        public bool IsEligible { get; set; }

        // אם העובד לא כשיר, כאן תופיע הסיבה
        // לדוגמה: "לא זמין"
        public string? ExclusionReason { get; set; }

        // טקסט סטטוס נוח להצגה
        // לדוגמה: "כשיר" / "לא זמין"
        public string Status { get; set; } = string.Empty;
    }
}
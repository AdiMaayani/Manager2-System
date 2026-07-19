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
        public List<string> Professions { get; set; } = new();

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

        // Additive structured explanation and policy metadata.
        public string? RecommendationSummary { get; set; }
        public List<RecommendationFactorDto> Factors { get; set; } = new();
        public List<RecommendationRejectionDto> RejectionReasons { get; set; } = new();
        public List<string> MissingInputCodes { get; set; } = new();
        public string? PolicyProfileKey { get; set; }
        public int? PolicyVersion { get; set; }
        public string? PolicyDisplayName { get; set; }
        public List<string> RequiredRoles { get; set; } = new();
        public List<string> MatchedRoles { get; set; } = new();
        public List<string> MissingRoles { get; set; } = new();
        public string? OriginTypeUsed { get; set; }
        public int? TravelMinutes { get; set; }
        public decimal? DistanceKm { get; set; }
    }
}

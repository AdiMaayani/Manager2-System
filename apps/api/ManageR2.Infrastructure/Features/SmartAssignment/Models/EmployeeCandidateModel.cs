using System;
using System.Collections.Generic;

namespace ManageR2.Infrastructure.Models.SmartAssignment
{
    // English: same instance accumulates DB roster fields then algorithm scores/eligibility before AdvancedSmartAssignmentController maps to DTOs.
    // מחלקה זו מייצגת עובד מועמד לשיבוץ
    // מגיע מ-Result Set של עובדים מתוך ה-SP המאוחד
    public class EmployeeCandidateModel
    {
        // מזהה העובד
        public int EmployeeId { get; set; }

        // שם מלא של העובד
        public string? FullName { get; set; }

        // תפקיד עיקרי (לדוגמה: טכנאי בכיר / בעלים)
        public string? PrimaryRole { get; set; }

        // האם העובד פעיל במערכת
        public bool IsActive { get; set; }

        // האם ניתן לשבץ את העובד למשימות
        public bool IsAssignable { get; set; }

        // כמות שעות עבודה יומית (לדוגמה: 8)
        public decimal? DailyCapacityHours { get; set; }

        // =========================
        // שדות עזר לאלגוריתם
        // =========================

        // טלפון (לא חובה לאלגוריתם, אך שימושי להצגה)
        public string? Phone { get; set; }

        // אימייל (כנ"ל)
        public string? Email { get; set; }

        // =========================
        // נתונים שיחושבו בהמשך
        // =========================

        /*
         * שדות אלה לא מגיעים מה-DB
         * אלא יחושבו בתוך האלגוריתם (Service)
         *
         * כרגע הם כאן כהכנה לשלב הבא
         */

        // English: scoring/eligibility block — populated in SmartAssignmentService, never sent as-is to the client.
        // ציון התאמה מקצועית
        public decimal? ProfessionalScore { get; set; }

        // ציון זמינות
        public decimal? AvailabilityScore { get; set; }

        // ציון עומס עבודה
        public decimal? WorkloadScore { get; set; }

        // ציון גיאוגרפי (מרחק / זמן נסיעה)
        public decimal? GeographicScore { get; set; }

        // ציון ניסיון
        public decimal? ExperienceScore { get; set; }

        // ציון רציפות (עבודה באותו אתר/לקוח)
        public decimal? ContinuityScore { get; set; }

        // ציון כולל
        public decimal? TotalScore { get; set; }

        // דירוג (1 = הכי מתאים)
        public int? RankOrder { get; set; }

        // סיכום מילולי של ההמלצה
        public string? RecommendationSummary { get; set; }

        // רשימת אזהרות (בפורמט JSON)
        public string? WarningsJson { get; set; }

        // האם העובד כשיר לבחירה בפועל
        public bool IsEligible { get; set; }

        // סיבת אי-כשירות, לדוגמה: לא זמין
        public string? ExclusionReason { get; set; }

        // =========================
        // Explainability + persistence detail
        // =========================

        // Per-factor breakdown (score, weight, explanation, data source) shown to the manager.
        public List<RecommendationFactorModel> Factors { get; set; } = new List<RecommendationFactorModel>();

        // Origin used for the geographic factor (HomeBase / PlannedStop / LastKnownLocation / ManualOverride).
        public string? OriginTypeUsed { get; set; }

        // Skill match counts used for explanation and persistence.
        public int? MatchedSkillsCount { get; set; }
        public int? MissingSkillsCount { get; set; }

        // Travel detail used by the geographic factor, when route data exists.
        public int? TravelMinutes { get; set; }
        public decimal? DistanceKm { get; set; }

        // Workload detail used by the workload factor and persisted for transparency.
        public int? OpenAssignmentsCount { get; set; }
        public decimal? CurrentWorkloadHours { get; set; }

        // Continuity detail used by the continuity factor and persisted for transparency.
        public bool? WorkedWithCustomerBefore { get; set; }
        public bool? WorkedAtSiteBefore { get; set; }
    }
}

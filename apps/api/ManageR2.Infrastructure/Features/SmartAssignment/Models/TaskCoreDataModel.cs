using System;

namespace ManageR2.Infrastructure.Models.SmartAssignment
{
    // English: first result set row shape for one work item; richer than a minimal DTO but still not the full WorkItem entity graph.
    // מחלקה זו מייצגת את נתוני הליבה של משימה כפי שהם מגיעים מה-DB
    // מדובר ב-Result Set הראשון מתוך ה-SP המאוחד
    public class TaskCoreDataModel
    {
        // מזהה המשימה
        public int WorkItemId { get; set; }

        // שם המשימה
        public string? Title { get; set; }

        // סוג המשימה (Project / Task / Milestone)
        public string? WorkType { get; set; }

        // סטטוס המשימה (Planned / Execution / Closed וכו')
        public string? Status { get; set; }

        // זמן התחלה מתוכנן (יכול להיות NULL)
        public DateTime? PlannedStart { get; set; }

        // זמן סיום מתוכנן (יכול להיות NULL)
        public DateTime? PlannedEnd { get; set; }

        // הערכת שעות לביצוע המשימה
        public decimal? EstimatedHours { get; set; }

        // עדיפות המשימה (Low / Medium / High / Critical)
        public string? Priority { get; set; }

        // תפקיד נדרש לביצוע המשימה (לדוגמה: טכנאי בכיר)
        public string? RequiredRole { get; set; }

        // האם המשימה נעולה (true = לא ניתן לשנות/לשבץ)
        public bool IsLocked { get; set; }

        // מזהה אתר (מיקום המשימה)
        public int? SiteId { get; set; }

        // מזהה לקוח
        public int? CustomerId { get; set; }

        // מזהה אב (לצורך היררכיה: Project → Milestone → Task)
        public int? ParentWorkItemId { get; set; }

        // =========================
        // שדות אלגוריתמיים (Rec_)
        // =========================

        // סוג פרויקט (לצורך חישוב ניסיון)
        public string? ProjectType { get; set; }

        // כמה עובדים נדרשים למשימה
        public int? RequiredWorkersCount { get; set; }

        // override לעדיפות (אם רוצים לעקוף את Priority הרגיל)
        public string? AlgorithmPriorityOverride { get; set; }

        // override לדחיפות (במקום לחשב לפי תאריך)
        public string? UrgencyOverride { get; set; }

        // הערות חופשיות לתכנון
        public string? PlanningNotes { get; set; }

        // =========================
        // כתובת מוצא ידנית (Override)
        // =========================

        /*
         * ברירת מחדל:
         * האלגוריתם קובע לבד את מיקום העובד:
         * - HomeBase (בית)
         * - PlannedStop (משימה קודמת באותו יום)
         * - LastKnownLocation (אם קיים)
         *
         * במידה והמשבץ רוצה:
         * ניתן להזין כתובת ידנית שממנה העובד יצא למשימה
         *
         * אם HasManualOriginOverride = true
         * האלגוריתם יכול להשתמש בכתובת הידנית במקום ברירת המחדל
         */

        // האם קיימת כתובת מוצא ידנית
        public bool HasManualOriginOverride { get; set; }

        // הכתובת כפי שהוזנה ע"י המשתמש
        public string? ManualOriginAddress { get; set; }

        // הכתובת לאחר עיבוד (לדוגמה: Geoapify / Google)
        public string? ManualOriginFormattedAddress { get; set; }

        // ספק ה-API שביצע את הולידציה (Geoapify / Google)
        public string? ManualOriginProvider { get; set; }

        // סטטוס הולידציה של הכתובת (Success / Pending / Failed)
        public string? ManualOriginValidationStatus { get; set; }

        // מזהה חיצוני מה-API (PlaceId וכדומה)
        public string? ManualOriginExternalPlaceRef { get; set; }

        // עיר של הכתובת
        public string? ManualOriginCity { get; set; }

        // אזור עבודה (ZoneId)
        public int? ManualOriginZoneId { get; set; }
    }
}
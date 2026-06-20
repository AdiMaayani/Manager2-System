namespace ManageR2.Infrastructure.Models.SmartAssignment
{
    // English: precomputed origin→site distance/time pair keyed by employee and origin strategy (from SP or routing helper).
    // מחלקה זו מייצגת חישוב מסלול / זמן נסיעה לעובד
    // מגיעה מ-Result Set של Route Estimates מתוך ה-SP המאוחד
    public class RouteEstimateModel
    {
        // מזהה העובד
        public int EmployeeId { get; set; }

        // מזהה אתר היעד
        public int TargetSiteId { get; set; }

        // סוג מקור החישוב:
        // HomeBase = כתובת בסיס
        // PlannedStop = תחנה מתוכננת
        // LastKnownLocation = מיקום ידוע אחרון
        // ManualOverride = כתובת ידנית שהמשבץ הזין
        public string? OriginType { get; set; }

        // מרחק מוערך בקילומטרים
        public decimal? EstimatedDistanceKm { get; set; }

        // זמן נסיעה מוערך בדקות
        public int? EstimatedTravelMinutes { get; set; }
    }
}

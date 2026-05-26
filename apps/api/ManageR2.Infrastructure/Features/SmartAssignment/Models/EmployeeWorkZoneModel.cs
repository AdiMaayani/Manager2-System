namespace ManageR2.Infrastructure.Models.SmartAssignment
{
    // English: ties employee to dispatch zone metadata (complements base address and site zone ids).
    // מחלקה זו מייצגת אזור עבודה של עובד
    // מגיעה מ-Result Set של Work Zones מתוך ה-SP המאוחד
    public class EmployeeWorkZoneModel
    {
        // מזהה העובד
        public int EmployeeId { get; set; }

        // מזהה אזור העבודה
        public int ZoneId { get; set; }

        // האם זה אזור העבודה הראשי של העובד
        public bool IsPrimary { get; set; }
    }
}
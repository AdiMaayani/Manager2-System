namespace ManageR2.Infrastructure.Models.SmartAssignment
{
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
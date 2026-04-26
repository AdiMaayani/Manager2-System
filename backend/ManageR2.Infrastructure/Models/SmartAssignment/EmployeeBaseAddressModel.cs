namespace ManageR2.Infrastructure.Models.SmartAssignment
{
    // English: home-base location row for geographic leg of scoring (paired with RouteEstimateModel).
    // מחלקה זו מייצגת כתובת בסיס של עובד
    // מגיעה מ-Result Set של Employee Base Addresses מתוך ה-SP המאוחד
    public class EmployeeBaseAddressModel
    {
        // מזהה העובד
        public int EmployeeId { get; set; }

        // כתובת מסודרת, לדוגמה: אבן יהודה, ישראל
        public string? FormattedAddress { get; set; }

        // עיר הכתובת
        public string? City { get; set; }

        // מזהה אזור עבודה
        public int? ZoneId { get; set; }
    }
}
namespace ManageR2.Infrastructure.Models.SmartAssignment
{
    // מחלקה זו מייצגת כתובת אתר של משימה
    // מגיעה מ-Result Set של Site Address מתוך ה-SP המאוחד
    public class SiteAddressModel
    {
        // מזהה האתר
        public int SiteId { get; set; }

        // כתובת מסודרת של האתר, לדוגמה: רחוב הבדיקה 10, תל אביב, ישראל
        public string? FormattedAddress { get; set; }

        // עיר האתר
        public string? City { get; set; }

        // מזהה אזור עבודה של האתר
        public int? ZoneId { get; set; }
    }
}
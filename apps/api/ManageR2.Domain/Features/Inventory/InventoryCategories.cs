namespace ManageR2.Domain.Entities;

// Canonical inventory category names — the single backend source of truth for category
// validation. Mirrors the frontend CANONICAL_CATEGORIES list so the two stay in lockstep.
public static class InventoryCategories
{
    public static readonly IReadOnlyList<string> Canonical = new[]
    {
        "חשמל חכם",
        "מולטימדיה",
        "שו\"ב",
        "רשת מחשבים",
        "מצלמות אבטחה",
        "מערכות אזעקה",
        "טלפוניה ואינטרקום",
        "כבילה ותשתיות",
    };

    // True only when the trimmed value exactly matches one of the canonical categories.
    public static bool IsValid(string? category)
    {
        if (string.IsNullOrWhiteSpace(category))
        {
            return false;
        }

        var trimmed = category.Trim();
        foreach (var canonical in Canonical)
        {
            if (string.Equals(canonical, trimmed, StringComparison.Ordinal))
            {
                return true;
            }
        }

        return false;
    }
}

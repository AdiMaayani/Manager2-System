namespace ManageR2.Domain.Entities;

// Company-wide stock catalog row used by the Inventory MVP.
public class InventoryItem
{
    public int InventoryItemId { get; set; }

    public string SkuCode { get; set; } = string.Empty;

    public string ItemName { get; set; } = string.Empty;

    public string? Category { get; set; }

    public decimal QuantityOnHand { get; set; }

    public string Unit { get; set; } = string.Empty;

    public decimal? MinimumQuantity { get; set; }

    public string? LocationName { get; set; }

    public string? Notes { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public DateTime? DeletedAt { get; set; }

    // Server-relative stored path of the product image (e.g. uploads/inventory/<guid>.webp). Null when no image.
    public string? ImagePath { get; set; }

    public string? ImageContentType { get; set; }

    public long? ImageFileSizeBytes { get; set; }
}

// Outcome of an image set/clear stored-procedure call. Distinguishes "item not found" (no row updated)
// from a successful update whose previously stored image path was NULL.
public sealed record InventoryImageMutationResult(bool ItemFound, string? PreviousImagePath);

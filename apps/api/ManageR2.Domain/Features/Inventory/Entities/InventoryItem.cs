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
}

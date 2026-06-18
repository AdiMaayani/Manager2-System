namespace ManageR2.Api.DTOs;

// InventoryController uses this for list/detail/create/update; audit columns stay in the domain entity.
public class InventoryItemDto
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

    // Absolute, browser-usable URL for the product image. Null when no image is set.
    // Server-only filesystem paths are never exposed; only this public URL is returned.
    public string? ImageUrl { get; set; }
}

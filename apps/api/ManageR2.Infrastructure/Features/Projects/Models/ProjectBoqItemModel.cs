namespace ManageR2.Infrastructure.Models;

public class ProjectBoqItemModel
{
    public int ProjectBoqItemId { get; set; }

    public int ProjectId { get; set; }

    public string? SystemName { get; set; }

    public int? InventoryItemId { get; set; }

    public string? InventorySkuCode { get; set; }

    public string? InventoryItemName { get; set; }

    public string? InventoryCategory { get; set; }

    public string ItemDescription { get; set; } = string.Empty;

    public decimal Quantity { get; set; }

    public string Unit { get; set; } = string.Empty;

    public decimal? UnitPrice { get; set; }

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}

public class ProjectBoqSortOrderModel
{
    public int ProjectBoqItemId { get; set; }

    public int SortOrder { get; set; }
}

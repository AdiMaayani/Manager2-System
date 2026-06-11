namespace ManageR2.Infrastructure.Models;

public class ProjectEquipmentItemModel
{
    public int ProjectEquipmentItemId { get; set; }

    public int ProjectId { get; set; }

    public int? InventoryItemId { get; set; }

    public string? InventorySkuCode { get; set; }

    public string? InventoryItemName { get; set; }

    public string? InventoryCategory { get; set; }

    public string EquipmentName { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string? Location { get; set; }

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}

public class ProjectEquipmentSortOrderModel
{
    public int ProjectEquipmentItemId { get; set; }

    public int SortOrder { get; set; }
}

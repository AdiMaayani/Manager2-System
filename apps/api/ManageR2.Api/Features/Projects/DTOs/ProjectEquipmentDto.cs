namespace ManageR2.Api.DTOs;

public class ProjectEquipmentItemDto
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

public class CreateProjectEquipmentItemRequestDto
{
    public string EquipmentName { get; set; } = string.Empty;

    public int? InventoryItemId { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? Location { get; set; }

    public int? SortOrder { get; set; }
}

public class UpdateProjectEquipmentItemRequestDto
{
    public string EquipmentName { get; set; } = string.Empty;

    public int? InventoryItemId { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? Location { get; set; }

    public int SortOrder { get; set; }
}

public class ReorderProjectEquipmentItemRequestDto
{
    public int ProjectEquipmentItemId { get; set; }

    public int SortOrder { get; set; }
}

public class ReorderProjectEquipmentRequestDto
{
    public List<ReorderProjectEquipmentItemRequestDto> Items { get; set; } = [];
}

namespace ManageR2.Api.Features.Reports.DTOs;

public class ReverseWorkReportRequestDto
{
    public string ReversalReason { get; set; } = string.Empty;
}

public class AddWorkReportInventoryLineRequestDto
{
    public int InventoryItemId { get; set; }
    public decimal Quantity { get; set; }
    public string UsageType { get; set; } = string.Empty;
}

public class UploadWorkReportAttachmentRequestDto
{
    public IFormFile? File { get; set; }
}

public class WorkReportInventoryLineDto
{
    public int WorkReportInventoryItemId { get; set; }
    public int InventoryItemId { get; set; }
    public decimal Quantity { get; set; }
    public string UsageType { get; set; } = string.Empty;
    public string? SkuSnapshot { get; set; }
    public string? ItemNameSnapshot { get; set; }
}

public class WorkReportAttachmentDto
{
    public int WorkReportAttachmentId { get; set; }
    public string MediaType { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string? ContentType { get; set; }
    public long FileSizeBytes { get; set; }
    public DateTime? UploadedAt { get; set; }
}

public class WorkReportLifecycleDto
{
    public int WorkReportId { get; set; }
    public string? Status { get; set; }
    public string LifecycleStatus { get; set; } = string.Empty;
    public DateTime? FinalizedAt { get; set; }
    public DateTime? ReversedAt { get; set; }
    public string? ReversalReason { get; set; }
}

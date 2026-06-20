namespace ManageR2.Infrastructure.Models;

public class WorkReportInventoryLineModel
{
    public int WorkReportInventoryItemId { get; set; }
    public int WorkReportId { get; set; }
    public int InventoryItemId { get; set; }
    public decimal Quantity { get; set; }
    public string UsageType { get; set; } = string.Empty;
    public string? SkuSnapshot { get; set; }
    public string? ItemNameSnapshot { get; set; }
    public DateTime? CreatedAt { get; set; }
    public int? CreatedByUserId { get; set; }
}

public class WorkReportAttachmentModel
{
    public int WorkReportAttachmentId { get; set; }
    public int WorkReportId { get; set; }
    public string MediaType { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public string? ContentType { get; set; }
    public long FileSizeBytes { get; set; }
    public DateTime? UploadedAt { get; set; }
    public int? UploadedByUserId { get; set; }
}

public class WorkReportLifecycleResultModel
{
    public int WorkReportId { get; set; }
    public string? Status { get; set; }
    public string LifecycleStatus { get; set; } = string.Empty;
    public DateTime? FinalizedAt { get; set; }
    public int? FinalizedByUserId { get; set; }
    public DateTime? ReversedAt { get; set; }
    public int? ReversedByUserId { get; set; }
    public string? ReversalReason { get; set; }
}

public class WorkReportAttachmentDeleteResultModel
{
    public int WorkReportAttachmentId { get; set; }
    public string? StoredFileName { get; set; }
    public string? FilePath { get; set; }
    public string? ContentType { get; set; }
    public long? FileSizeBytes { get; set; }
}

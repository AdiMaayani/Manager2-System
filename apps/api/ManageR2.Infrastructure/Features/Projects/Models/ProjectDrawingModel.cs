namespace ManageR2.Infrastructure.Models;

public class ProjectDrawingModel
{
    public int ProjectDrawingId { get; set; }

    public int ProjectId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Type { get; set; } = string.Empty;

    public DateOnly DrawingDate { get; set; }

    public string? Note { get; set; }

    public string? OriginalFileName { get; set; }

    public string? StoredFileName { get; set; }

    public string? FilePath { get; set; }

    public string? ContentType { get; set; }

    public long? FileSizeBytes { get; set; }

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}

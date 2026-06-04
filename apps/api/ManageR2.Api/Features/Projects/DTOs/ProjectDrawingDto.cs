namespace ManageR2.Api.DTOs;

public class ProjectDrawingDto
{
    public int ProjectDrawingId { get; set; }

    public int ProjectId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Type { get; set; } = string.Empty;

    public DateOnly DrawingDate { get; set; }

    public string? Note { get; set; }

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}

public class CreateProjectDrawingRequestDto
{
    public string Name { get; set; } = string.Empty;

    public string Type { get; set; } = string.Empty;

    public DateOnly DrawingDate { get; set; }

    public string? Note { get; set; }

    public int? SortOrder { get; set; }
}

public class UpdateProjectDrawingRequestDto
{
    public string Name { get; set; } = string.Empty;

    public string Type { get; set; } = string.Empty;

    public DateOnly DrawingDate { get; set; }

    public string? Note { get; set; }

    public int SortOrder { get; set; }
}

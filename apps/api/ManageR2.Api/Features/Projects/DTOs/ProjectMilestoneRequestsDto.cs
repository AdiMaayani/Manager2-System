namespace ManageR2.Api.Features.Projects.DTOs;

public class ProjectMilestoneResponseDto
{
    public int ProjectMilestoneId { get; set; }
    public int ProjectId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public string Status { get; set; } = string.Empty;
    public int? ManagerEmployeeId { get; set; }
    public DateTime? PlannedStart { get; set; }
    public DateTime? PlannedEnd { get; set; }
    public DateTime? ActualStart { get; set; }
    public DateTime? ActualEnd { get; set; }
    public int ProgressPercent { get; set; }
    public bool IsActive { get; set; }
    public int? LegacyWorkItemId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class CreateProjectMilestoneRequestDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? SortOrder { get; set; }
    public string Status { get; set; } = "Planned";
    public int ManagerEmployeeId { get; set; }
    public DateTime? PlannedStart { get; set; }
    public DateTime? PlannedEnd { get; set; }
}

public class UpdateProjectMilestoneRequestDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public string Status { get; set; } = string.Empty;
    public int? ManagerEmployeeId { get; set; }
    public DateTime? PlannedStart { get; set; }
    public DateTime? PlannedEnd { get; set; }
    public DateTime? ActualStart { get; set; }
    public DateTime? ActualEnd { get; set; }
    public int ProgressPercent { get; set; }
}

public class ReorderProjectMilestonesRequestDto
{
    public List<ProjectMilestoneSortItemDto> Items { get; set; } = new();
}

public class ProjectMilestoneSortItemDto
{
    public int ProjectMilestoneId { get; set; }
    public int SortOrder { get; set; }
}

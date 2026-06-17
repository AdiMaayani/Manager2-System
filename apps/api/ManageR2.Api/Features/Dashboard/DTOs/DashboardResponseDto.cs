namespace ManageR2.Api.Features.Dashboard.DTOs;

// Single response contract for GET /api/dashboard. Built server-side and already filtered to what the
// authenticated caller is permitted to see. Contains no Domain/Infrastructure types and no secret data.
public class DashboardResponseDto
{
    public DateTime GeneratedAtUtc { get; set; }

    public DashboardUserDto User { get; set; } = new();

    public List<DashboardKpiDto> Kpis { get; set; } = new();

    public List<DashboardTaskDto> PersonalTasksToday { get; set; } = new();

    public List<DashboardActionItemDto> Recommendations { get; set; } = new();

    public List<DashboardWarningDto> EarlyWarnings { get; set; } = new();

    public List<DashboardActivityDto> RecentActivity { get; set; } = new();
}

public class DashboardUserDto
{
    public string DisplayName { get; set; } = string.Empty;
    public List<string> RoleLabels { get; set; } = new();
    public string StateSummary { get; set; } = string.Empty;
}

public class DashboardKpiDto
{
    public string Id { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int Value { get; set; }
    public string? Context { get; set; }
    public string Tone { get; set; } = "primary";
    public string? ActionRoute { get; set; }
}

public class DashboardTaskDto
{
    public int WorkItemId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Status { get; set; }
    public DateTime? PlannedStart { get; set; }
    public DateTime? PlannedEnd { get; set; }
    public string? ProjectTitle { get; set; }
    public string? CustomerName { get; set; }
    public string? SiteName { get; set; }
    public string? ActionRoute { get; set; }
}

public class DashboardActionItemDto
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Severity { get; set; } = "info";
    public int PriorityScore { get; set; }
    public string? EntityType { get; set; }
    public int? EntityId { get; set; }
    public string ActionLabel { get; set; } = string.Empty;
    public string? ActionRoute { get; set; }
    public DateTime? RelevantDate { get; set; }
    public string? Context { get; set; }
}

public class DashboardWarningDto
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Severity { get; set; } = "attention";
    public string? EntityType { get; set; }
    public int? EntityId { get; set; }
    public string? ActionLabel { get; set; }
    public string? ActionRoute { get; set; }
    public DateTime? RelevantDate { get; set; }
    public string? Context { get; set; }
}

public class DashboardActivityDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ActorName { get; set; }
    public DateTime OccurredAtUtc { get; set; }
    public string Severity { get; set; } = "info";
    public string? EntityType { get; set; }
    public int? EntityId { get; set; }
    public string? ActionRoute { get; set; }
}

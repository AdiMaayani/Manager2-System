using ManageR2.Infrastructure.Models;

namespace ManageR2.Infrastructure.Features.WorkItems.Models;

public sealed class WorkPlanScheduleResult
{
    public List<WorkPlanScheduledTaskResult> ScheduledTasks { get; set; } = new();
    public List<WorkPlanScheduledTaskResult> UnscheduledTasks { get; set; } = new();
    public List<WorkPlanEmployeeResult> Employees { get; set; } = new();
    public List<WorkPlanAssignmentResult> Assignments { get; set; } = new();
}

public sealed class WorkPlanScheduledTaskResult
{
    public int WorkItemId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? WorkType { get; set; }
    public string? TaskCategory { get; set; }
    public string? Status { get; set; }
    public string? Priority { get; set; }
    public DateTime? PlannedStart { get; set; }
    public DateTime? PlannedEnd { get; set; }
    public int? DerivedDurationMinutes { get; set; }
    public decimal? EstimatedHours { get; set; }
    public bool IsLocked { get; set; }
    public bool IsArchived { get; set; }
    public int? CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public int? SiteId { get; set; }
    public string? SiteName { get; set; }
    public int? ProjectId { get; set; }
    public string? ProjectTitle { get; set; }
    public int? MilestoneId { get; set; }
    public string? MilestoneTitle { get; set; }
    public bool IsServiceCall { get; set; }
}

public sealed class WorkPlanEmployeeResult
{
    public int EmployeeId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? PrimaryRole { get; set; }
    public bool IsActive { get; set; }
    public bool IsAssignable { get; set; }
}

public sealed class WorkPlanScheduleQuery
{
    public string Scope { get; set; } = "company";
    public int? ProjectId { get; set; }
    public int? EmployeeId { get; set; }
    public string? Status { get; set; }
    public string? TaskCategory { get; set; }
    public DateTime? FromUtc { get; set; }
    public DateTime? ToUtc { get; set; }
    public bool IncludeUnscheduled { get; set; } = true;
    public int? CurrentUserEmployeeId { get; set; }
}

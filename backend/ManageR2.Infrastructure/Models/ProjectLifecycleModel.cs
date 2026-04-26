namespace ManageR2.Infrastructure.Models;

// Infrastructure aggregate from sp_GetProjectLifecycle (multi result set); API maps to ProjectLifecycleDto, not ManageR2.Domain entities.
// Domain model built from DB results before mapping to API DTOs.
public class ProjectLifecycleModel
{
    // Project row from the first result set.
    public ProjectLifecycleProjectModel Project { get; set; } = new();
    // Milestone rows from the second result set.
    public List<ProjectLifecycleMilestoneModel> Milestones { get; set; } = new();
    // Assignment rows from the third result set.
    public List<ProjectLifecycleAssignmentModel> Assignments { get; set; } = new();
    // Report rows from the fourth result set.
    public List<ProjectLifecycleReportModel> Reports { get; set; } = new();
    // Summary row from the final result set.
    public ProjectLifecycleSummaryModel Summary { get; set; } = new();
}

// First result set row from sp_GetProjectLifecycle (header fields + customer/site display names).
// Infrastructure model for top-level project lifecycle fields.
public class ProjectLifecycleProjectModel
{
    public int WorkItemId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? BillingType { get; set; }
    public int CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public int? SiteId { get; set; }
    public string? SiteName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    public DateTime? DealCloseDate { get; set; }
    public string? FinanceProjectNumber { get; set; }
    public string? InvoiceNumber { get; set; }
}

// Milestone/task slice from second result set (schedule + lock flags for lifecycle UI).
// Infrastructure model for milestone lifecycle fields.
public class ProjectLifecycleMilestoneModel
{
    public int WorkItemId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? BillingType { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? PlannedStart { get; set; }
    public DateTime? PlannedEnd { get; set; }
    public DateTime? ClosedAt { get; set; }
    public decimal? EstimatedHours { get; set; }
    public string? Priority { get; set; }
    public string? RequiredRole { get; set; }
    public bool IsLocked { get; set; }
}

// Third result set: who is assigned to which work item (employee or contractor).
// Infrastructure model for assignment lifecycle fields.
public class ProjectLifecycleAssignmentModel
{
    public int WorkItemId { get; set; }
    public int? EmployeeId { get; set; }
    public int? ContractorId { get; set; }
    public string AssignmentType { get; set; } = string.Empty;
    public string? AssignmentRole { get; set; }
    public decimal? AssignedHours { get; set; }
    public bool IsManualAssignment { get; set; }
    public string? EmployeeName { get; set; }
    public string? ContractorName { get; set; }
}

// Fourth result set: report history rows tied to the project/milestones narrative.
// Infrastructure model for work report lifecycle fields.
public class ProjectLifecycleReportModel
{
    public int WorkReportId { get; set; }
    public int? WorkItemId { get; set; }
    public string? ReportType { get; set; }
    public DateTime? ReportDate { get; set; }
    public string? Summary { get; set; }
    public string? Notes { get; set; }
    public string? ReporterName { get; set; }
    public string? Status { get; set; }
    public bool FollowUpRequired { get; set; }
}

// Fifth result set: KPI counters and risk/health strings computed in SQL for the summary card.
// Infrastructure model for aggregated lifecycle summary values.
public class ProjectLifecycleSummaryModel
{
    public int TotalMilestones { get; set; }
    public int OpenMilestones { get; set; }
    public int ClosedMilestones { get; set; }
    public int LockedMilestones { get; set; }
    public int CancelledMilestones { get; set; }
    public int DelayedMilestones { get; set; }
    public int InvalidScheduleMilestones { get; set; }
    public int UpcomingMilestones { get; set; }
    public string RiskLevel { get; set; } = string.Empty;
    public string HealthStatus { get; set; } = string.Empty;
    public string RiskReason { get; set; } = string.Empty;
    public decimal ProgressPercent { get; set; }
    public int TotalReports { get; set; }
    public bool HasFollowUps { get; set; }
}

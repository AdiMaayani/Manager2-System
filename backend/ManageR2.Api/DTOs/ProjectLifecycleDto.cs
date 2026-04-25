namespace ManageR2.Api.DTOs;

public class ProjectLifecycleDto
{
    public ProjectLifecycleProjectDto Project { get; set; } = new();
    public List<ProjectLifecycleMilestoneDto> Milestones { get; set; } = new();
    public List<ProjectLifecycleAssignmentDto> Assignments { get; set; } = new();
    public List<ProjectLifecycleReportDto> Reports { get; set; } = new();
    public ProjectLifecycleSummaryDto Summary { get; set; } = new();
}

public class ProjectLifecycleProjectDto
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

public class ProjectLifecycleMilestoneDto
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

public class ProjectLifecycleAssignmentDto
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

public class ProjectLifecycleReportDto
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

public class ProjectLifecycleSummaryDto
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

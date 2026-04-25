namespace ManageR2.Infrastructure.Models;

public class ProjectLifecycleModel
{
    public ProjectLifecycleProjectModel Project { get; set; } = new();
    public List<ProjectLifecycleMilestoneModel> Milestones { get; set; } = new();
    public List<ProjectLifecycleAssignmentModel> Assignments { get; set; } = new();
    public List<ProjectLifecycleReportModel> Reports { get; set; } = new();
    public ProjectLifecycleSummaryModel Summary { get; set; } = new();
}

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

public class ProjectLifecycleSummaryModel
{
    public int TotalMilestones { get; set; }
    public int OpenMilestones { get; set; }
    public int ClosedMilestones { get; set; }
    public int LockedMilestones { get; set; }
    public decimal ProgressPercent { get; set; }
    public int TotalReports { get; set; }
    public bool HasFollowUps { get; set; }
}

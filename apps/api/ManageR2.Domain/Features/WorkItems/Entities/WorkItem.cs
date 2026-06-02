namespace ManageR2.Domain.Entities;

// Core domain entity for any managed unit of work: project, task/milestone, or service-call item.
public class WorkItem
{
    public int WorkItemId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    // WorkType string discriminates Project vs Task (milestones often stored as Task) vs Service Call, etc.
    public string? WorkType { get; set; }
    public string? BillingType { get; set; }
    public string? Status { get; set; }

    public decimal? EstimatedHours { get; set; }
    public DateTime? ActualStart { get; set; }
    public DateTime? ActualEnd { get; set; }
    public decimal? ActualHours { get; set; }

    public string? Priority { get; set; }
    public DateTime? PlannedStart { get; set; }
    public DateTime? PlannedEnd { get; set; }
    public string? RequiredRole { get; set; }
    public bool IsLocked { get; set; }

    public int CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public int SiteId { get; set; }
    public string? SiteName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    // Parent link builds the hierarchy (project -> child tasks/milestones).
    public int? ParentWorkItemId { get; set; }

    public DateTime? DealCloseDate { get; set; }
    public string? FinanceProjectNumber { get; set; }
    public string? InvoiceNumber { get; set; }
}
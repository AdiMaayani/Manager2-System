namespace ManageR2.Infrastructure.Models;

// Raw, single-purpose carriers for the dbo.sp_Dashboard_* result sets. These mirror the SP columns
// exactly and are never returned from the API directly; DashboardService composes them into the
// permission-filtered DashboardModel and the controller maps that to DTOs.

public class DashboardPersonalTaskRow
{
    public int WorkItemId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Status { get; set; }
    public string? Priority { get; set; }
    public DateTime? PlannedStart { get; set; }
    public DateTime? PlannedEnd { get; set; }
    public int? ProjectId { get; set; }
    public string? ProjectTitle { get; set; }
    public string? ProjectNumber { get; set; }
    public string? CustomerName { get; set; }
    public string? SiteName { get; set; }
    public string? AssignmentRole { get; set; }
}

public class DashboardServiceCallRow
{
    public int WorkItemId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Status { get; set; }
    public string? Priority { get; set; }
    public DateTime? PlannedStart { get; set; }
    public DateTime? PlannedEnd { get; set; }
    public DateTime CreatedAt { get; set; }
    public int CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public int? SiteId { get; set; }
    public string? SiteName { get; set; }
    public bool IsUnassigned { get; set; }
    public bool IsAssignedToMe { get; set; }
    public bool IsUrgent { get; set; }
}

public class DashboardProjectAttentionRow
{
    public int WorkItemId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? FinanceProjectNumber { get; set; }
    public string? Status { get; set; }
    public string? CustomerName { get; set; }
    public string? ProjectManagerName { get; set; }
    public bool HasNoProjectManager { get; set; }
    public int OverdueTaskCount { get; set; }
    public DateTime? NearestOverdueDate { get; set; }
}

public class DashboardQuoteFollowUpRow
{
    public int QuoteId { get; set; }
    public string QuoteNumber { get; set; } = string.Empty;
    public int CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public int? ProjectId { get; set; }
    public string? ProjectTitle { get; set; }
    public string? Status { get; set; }
    public DateTime QuoteDate { get; set; }
    public DateTime? ValidUntil { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public decimal Total { get; set; }
    public int DaysSinceActivity { get; set; }
    public bool IsExpired { get; set; }
}

public class DashboardCustomerContactGapRow
{
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerType { get; set; }
    public string? City { get; set; }
    public string? Status { get; set; }
}

public class DashboardDraftReportRow
{
    public int WorkReportId { get; set; }
    public int? WorkItemId { get; set; }
    public string? ReportType { get; set; }
    public DateTime? ReportDate { get; set; }
    public string? ProjectName { get; set; }
    public string? CustomerName { get; set; }
    public string? Status { get; set; }
}

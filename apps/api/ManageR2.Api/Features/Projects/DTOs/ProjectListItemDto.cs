namespace ManageR2.Api.DTOs;

// WorkItemsController projects-list: denormalized labels (customer, site, PM) not stored on WorkItem row alone.
// Lightweight project list contract based on WorkItems with WorkType=Project.
public class ProjectListItemDto
{
    public int WorkItemId { get; set; }

    public string ProjectNumber { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string CustomerName { get; set; } = string.Empty;

    public string ProjectManagerName { get; set; } = "-";

    public string Status { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public string SiteName { get; set; } = "-";

    public string BillingType { get; set; } = string.Empty;

    public DateTime? DealCloseDate { get; set; }

    public string? FinanceProjectNumber { get; set; }

    public string? InvoiceNumber { get; set; }
}
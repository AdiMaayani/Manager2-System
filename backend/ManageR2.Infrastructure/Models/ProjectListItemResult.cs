namespace ManageR2.Infrastructure.Models;

// Denormalized list row (customer, PM, site labels from joins); differs from WorkItem entity which does not carry display names alone.
// Repository result model for project list rows built from WorkItems.
public class ProjectListItemResult
{
    public int WorkItemId { get; set; }

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
namespace ManageR2.Api.DTOs;

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
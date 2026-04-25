namespace ManageR2.Infrastructure.Models;

// Lightweight report list row used for reports table endpoints.
public class WorkReportListItemModel
{
    public int WorkReportId { get; set; }
    public DateTime? ReportDate { get; set; }
    public string? ProjectName { get; set; }
    public string? CustomerName { get; set; }
    public string? ReporterName { get; set; }
    public string? Status { get; set; }
    public bool FollowUpRequired { get; set; }
}
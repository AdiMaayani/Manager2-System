namespace ManageR2.Infrastructure.Models;

// Read model from WorkReportRepository.GetAllAsync (plain SELECT); smaller than WorkReportDetailsModel used on drill-down.
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
    public string? LifecycleStatus { get; set; }
    public DateTime? FinalizedAt { get; set; }
    public DateTime? ReversedAt { get; set; }
    public int? AmendsWorkReportId { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

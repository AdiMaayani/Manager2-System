namespace ManageR2.Infrastructure.Models;

public class WorkReportListItemModel
{
    public int WorkReportId { get; set; }
    public DateTime? ReportDate { get; set; }
    public string? ProjectName { get; set; }
    public string? CustomerName { get; set; }
    public string? ReporterName { get; set; }
    public bool FollowUpRequired { get; set; }
}
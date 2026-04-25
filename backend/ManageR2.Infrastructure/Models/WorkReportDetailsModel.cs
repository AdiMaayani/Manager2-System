namespace ManageR2.Infrastructure.Models;

// Full report details model returned by repository for report details endpoint.
public class WorkReportDetailsModel
{
    public int WorkReportId { get; set; }
    public string? ReportType { get; set; }
    public DateTime? ReportDate { get; set; }
    // Linked WorkItem id (project/task/service-call context for the report).
    public int? ProjectId { get; set; }
    public string? ProjectName { get; set; }
    public string? CustomerName { get; set; }
    public int? ServiceCallId { get; set; }
    public string? ServiceCallTitle { get; set; }
    public string? Site { get; set; }
    public string? Start { get; set; }
    public string? End { get; set; }
    public string? Summary { get; set; }
    public string? Notes { get; set; }
    public int? ReporterId { get; set; }
    public string? ReporterName { get; set; }
    public string? Role { get; set; }
    public string? Status { get; set; }
    public bool Followup { get; set; }
    public string? FollowupReason { get; set; }
    public List<string> Systems { get; set; } = new();
    public List<WorkReportRelatedWorkerModel> RelatedWorkers { get; set; } = new();
}
namespace ManageR2.Api.DTOs;

// Request contract for creating a report linked to a work item/project.
public class CreateWorkReportRequest
{
    public string? ReportType { get; set; }
    public string? Date { get; set; }
    public int? ProjectId { get; set; }
    public string? ProjectName { get; set; }
    public string? CustomerName { get; set; }
    // Optional service-call linkage when report is for a specific service call.
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
    public List<string> Systems { get; set; } = new();
    // Employees related to this report (not Users).
    public List<WorkReportRelatedWorkerDto> RelatedWorkers { get; set; } = new();
    public bool Followup { get; set; }
    public string? FollowupReason { get; set; }
}
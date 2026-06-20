namespace ManageR2.Api.DTOs;

// ReportsController POST success body; not the same as CreateWorkReportRequest (returns new id for client navigation).
// Response contract returned after successful report creation.
public class CreateWorkReportResponse
{
    public string Message { get; set; } = string.Empty;
    public int WorkReportId { get; set; }
}

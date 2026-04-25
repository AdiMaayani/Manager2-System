namespace ManageR2.Api.DTOs;

// Response contract returned after successful report creation.
public class CreateWorkReportResponse
{
    public string Message { get; set; } = string.Empty;
    public int WorkReportId { get; set; }
}
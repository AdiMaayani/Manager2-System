namespace ManageR2.Infrastructure.Models;

// Full report update payload; same editable surface as create plus the persisted report id.
public class WorkReportUpdateModel : WorkReportCreateModel
{
    public int WorkReportId { get; set; }
}

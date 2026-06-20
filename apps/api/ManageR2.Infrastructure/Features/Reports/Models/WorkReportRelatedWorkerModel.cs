namespace ManageR2.Infrastructure.Models;

// Child row model for sp_AddWorkReportEmployeeAssignment (embedded in create payload and detail read-back).
// Related employee model linked to a work report entry.
public class WorkReportRelatedWorkerModel
{
    public int? Id { get; set; }
    public string? Name { get; set; }
}

namespace ManageR2.Api.DTOs;

// Embedded in CreateWorkReportRequest; names workers on a report line, distinct from User accounts.
// Related employee item included in report create/read payloads.
public class WorkReportRelatedWorkerDto
{
    public int? Id { get; set; }
    public string? Name { get; set; }
}

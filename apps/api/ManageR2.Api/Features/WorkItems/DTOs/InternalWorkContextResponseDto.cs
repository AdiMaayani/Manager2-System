namespace ManageR2.Api.DTOs
{
    // Response contract for GET /api/WorkItems/internal-context.
    // Lets the WorkPlan create internal/office tasks under the reserved container project.
    public class InternalWorkContextResponseDto
    {
        public int CustomerId { get; set; }

        public int SiteId { get; set; }

        public int ContainerProjectId { get; set; }
    }
}

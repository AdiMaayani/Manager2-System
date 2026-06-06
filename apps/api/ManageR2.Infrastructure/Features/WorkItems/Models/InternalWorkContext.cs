namespace ManageR2.Infrastructure.Models
{
    // Reserved customer/site/container-project ids used to create and render
    // internal/office tasks through the existing project-bound WorkPlan pipeline.
    public class InternalWorkContext
    {
        public int CustomerId { get; set; }

        public int SiteId { get; set; }

        public int ContainerProjectId { get; set; }
    }
}

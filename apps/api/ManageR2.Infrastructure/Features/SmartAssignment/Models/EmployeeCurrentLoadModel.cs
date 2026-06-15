namespace ManageR2.Infrastructure.Models.SmartAssignment
{
    // Current workload snapshot for one employee on the task day, sourced from existing
    // WorkEmployeeAssignments joined to WorkItems (no new tables). Feeds the workload factor.
    public class EmployeeCurrentLoadModel
    {
        public int EmployeeId { get; set; }

        // How many other open work items the employee is already assigned to on the task day.
        public int OpenAssignmentsCount { get; set; }

        // Sum of estimated hours already committed on the task day (excludes the current task).
        public decimal CurrentAssignedHours { get; set; }
    }
}

namespace ManageR2.Infrastructure.Models.SmartAssignment
{
    // Prior-assignment continuity facts for one employee relative to the task's project / customer / site,
    // derived from existing WorkEmployeeAssignments + WorkItems (no new tables). Feeds the continuity factor.
    public class EmployeeContinuityModel
    {
        public int EmployeeId { get; set; }

        // Employee has previously been assigned to another task under the same project (parent work item).
        public bool WorkedOnProjectBefore { get; set; }

        // Employee has previously worked for the same customer.
        public bool WorkedWithCustomerBefore { get; set; }

        // Employee has previously worked at the same site.
        public bool WorkedAtSiteBefore { get; set; }

        // Total distinct prior assignments anywhere. 0 means we cannot infer continuity (no history at all).
        public int TotalPriorAssignments { get; set; }
    }
}

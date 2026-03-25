using System;
using System.Collections.Generic;
using ManageR2.Domain.Entities;

namespace ManageR2.Infrastructure.Models
{
    public class WorkPlanResult
    {
        public WorkItem Project { get; set; } = new WorkItem();

        public List<WorkItem> Tasks { get; set; } = new List<WorkItem>();

        public List<WorkPlanAssignmentResult> Assignments { get; set; } = new List<WorkPlanAssignmentResult>();
    }

    public class WorkPlanAssignmentResult
    {
        public int WorkItemId { get; set; }

        public int? EmployeeId { get; set; }

        public int? ContractorId { get; set; }

        public string AssignmentType { get; set; } = string.Empty;

        public string? AssignmentRole { get; set; }

        public string? EmployeeName { get; set; }

        public string? ContractorName { get; set; }
    }
}
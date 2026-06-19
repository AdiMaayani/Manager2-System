using System;
using System.Collections.Generic;
using ManageR2.Domain.Entities;

namespace ManageR2.Infrastructure.Models
{
    // Aggregated work-plan graph from WorkItemRepository (separate SPs); WorkItemsController maps this to WorkPlanDto (not raw SQL in API).
    // Repository result model used before mapping to WorkPlanDto.
    public class WorkPlanResult
    {
        // Reuses domain WorkItem for project/task rows; assignment links use a flatter join shape below.
        public WorkItem Project { get; set; } = new WorkItem();

        public List<WorkItem> Tasks { get; set; } = new List<WorkItem>();

        public List<WorkPlanAssignmentResult> Assignments { get; set; } = new List<WorkPlanAssignmentResult>();
    }

    // Employee/contractor assignment join row (names denormalized for UI); not the same as a single WorkItem entity.
    // Assignment row model returned from work plan assignment query.
    public class WorkPlanAssignmentResult
    {
        public int WorkItemId { get; set; }

        public int? EmployeeId { get; set; }

        public int? ContractorId { get; set; }

        public string AssignmentType { get; set; } = string.Empty;

        public string? AssignmentRole { get; set; }

        public decimal? AssignedHours { get; set; }

        public bool IsManualAssignment { get; set; }

        public string? EmployeeName { get; set; }

        public string? ContractorName { get; set; }

        public string? AssignmentSource { get; set; }
    }
}
using ManageR2.Api.DTOs;
using ManageR2.Infrastructure.Features.WorkItems.Models;
using ManageR2.Infrastructure.Models;

namespace ManageR2.Api.Features.WorkItems.Mapping;

public static class WorkPlanScheduleDtoFactory
{
    public static WorkPlanScheduleDto Create(WorkPlanScheduleResult schedule)
    {
        var assignmentsByTask = schedule.Assignments
            .GroupBy(assignment => assignment.WorkItemId)
            .ToDictionary(
                group => group.Key,
                group => group.Select(MapAssignment).ToList());

        return new WorkPlanScheduleDto
        {
            ScheduledTasks = schedule.ScheduledTasks
                .Select(task => MapScheduledTask(task, assignmentsByTask))
                .ToList(),
            UnscheduledTasks = schedule.UnscheduledTasks
                .Select(task => MapScheduledTask(task, assignmentsByTask))
                .ToList(),
            Employees = schedule.Employees.Select(MapEmployee).ToList()
        };
    }

    private static WorkPlanTaskAssignmentDto MapAssignment(WorkPlanAssignmentResult assignment)
    {
        return new WorkPlanTaskAssignmentDto
        {
            EmployeeId = assignment.EmployeeId,
            EmployeeName = assignment.EmployeeName,
            AssignmentRole = assignment.AssignmentRole,
            AssignedHours = assignment.AssignedHours,
            IsManualAssignment = assignment.IsManualAssignment,
            AssignmentSource = assignment.AssignmentSource ?? "Task"
        };
    }

    private static WorkPlanScheduledTaskDto MapScheduledTask(
        WorkPlanScheduledTaskResult task,
        IReadOnlyDictionary<int, List<WorkPlanTaskAssignmentDto>> assignmentsByTask)
    {
        assignmentsByTask.TryGetValue(task.WorkItemId, out var assignments);

        return new WorkPlanScheduledTaskDto
        {
            WorkItemId = task.WorkItemId,
            Title = task.Title,
            Description = task.Description,
            TaskCategory = task.TaskCategory,
            WorkType = task.WorkType,
            Status = task.Status,
            Priority = task.Priority,
            PlannedStart = task.PlannedStart,
            PlannedEnd = task.PlannedEnd,
            DerivedDurationMinutes = task.DerivedDurationMinutes,
            EstimatedHours = task.EstimatedHours,
            IsLocked = task.IsLocked,
            CustomerId = task.CustomerId,
            CustomerName = task.CustomerName,
            SiteId = task.SiteId,
            SiteName = task.SiteName,
            ProjectId = task.ProjectId,
            ProjectTitle = task.ProjectTitle,
            MilestoneId = task.MilestoneId,
            MilestoneTitle = task.MilestoneTitle,
            IsServiceCall = task.IsServiceCall,
            Assignments = assignments ?? new List<WorkPlanTaskAssignmentDto>()
        };
    }

    private static WorkPlanEmployeeDto MapEmployee(WorkPlanEmployeeResult employee)
    {
        return new WorkPlanEmployeeDto
        {
            EmployeeId = employee.EmployeeId,
            FullName = employee.FullName,
            PrimaryRole = employee.PrimaryRole,
            IsActive = employee.IsActive,
            IsAssignable = employee.IsAssignable
        };
    }
}

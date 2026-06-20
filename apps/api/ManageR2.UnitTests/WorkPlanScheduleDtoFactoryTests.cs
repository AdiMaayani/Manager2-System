using ManageR2.Api.DTOs;
using ManageR2.Api.Features.WorkItems.Mapping;
using ManageR2.Infrastructure.Features.WorkItems.Models;
using ManageR2.Infrastructure.Models;

namespace ManageR2.UnitTests;

public class WorkPlanScheduleDtoFactoryTests
{
    [Fact]
    public void Create_MapsScheduledUnscheduledEmployeesAndAssignments()
    {
        var schedule = new WorkPlanScheduleResult
        {
            ScheduledTasks =
            {
                new WorkPlanScheduledTaskResult
                {
                    WorkItemId = 1,
                    Title = "Scheduled",
                    TaskCategory = "Regular",
                    WorkType = "Task",
                    PlannedStart = DateTime.UtcNow,
                    PlannedEnd = DateTime.UtcNow.AddHours(2),
                    DerivedDurationMinutes = 120
                }
            },
            UnscheduledTasks =
            {
                new WorkPlanScheduledTaskResult
                {
                    WorkItemId = 2,
                    Title = "Unscheduled",
                    TaskCategory = "Project",
                    WorkType = "Task"
                }
            },
            Employees =
            {
                new WorkPlanEmployeeResult
                {
                    EmployeeId = 7,
                    FullName = "Worker",
                    IsActive = true,
                    IsAssignable = true
                }
            },
            Assignments =
            {
                new WorkPlanAssignmentResult
                {
                    WorkItemId = 1,
                    EmployeeId = 7,
                    EmployeeName = "Worker",
                    AssignmentSource = "Task",
                    AssignmentType = "Employee",
                    IsManualAssignment = true
                }
            }
        };

        var dto = WorkPlanScheduleDtoFactory.Create(schedule);

        Assert.Single(dto.ScheduledTasks);
        Assert.Single(dto.UnscheduledTasks);
        Assert.Single(dto.Employees);
        Assert.Equal("Scheduled", dto.ScheduledTasks[0].Title);
        Assert.Equal("Unscheduled", dto.UnscheduledTasks[0].Title);
        Assert.Equal("Worker", dto.Employees[0].FullName);
        Assert.Equal("Task", dto.ScheduledTasks[0].Assignments[0].AssignmentSource);
        Assert.Equal(7, dto.ScheduledTasks[0].Assignments[0].EmployeeId);
    }

    [Fact]
    public void Create_ExcludesMilestoneTasksFromResultSets()
    {
        var schedule = new WorkPlanScheduleResult
        {
            ScheduledTasks =
            {
                new WorkPlanScheduledTaskResult
                {
                    WorkItemId = 3,
                    Title = "Project task",
                    TaskCategory = "Project",
                    MilestoneId = 10,
                    MilestoneTitle = "Phase 1"
                }
            }
        };

        var dto = WorkPlanScheduleDtoFactory.Create(schedule);

        Assert.Equal(10, dto.ScheduledTasks[0].MilestoneId);
        Assert.Equal("Phase 1", dto.ScheduledTasks[0].MilestoneTitle);
        Assert.DoesNotContain(dto.ScheduledTasks, task => task.WorkType == "Milestone");
    }
}

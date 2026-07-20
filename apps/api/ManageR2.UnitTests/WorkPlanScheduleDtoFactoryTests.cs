using System.Text.Json;
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

    [Fact]
    public void Create_MarksUnspecifiedScheduleTimestampsAsUtc()
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
                    PlannedStart = new DateTime(2026, 7, 20, 11, 50, 0, DateTimeKind.Unspecified),
                    PlannedEnd = new DateTime(2026, 7, 20, 15, 50, 0, DateTimeKind.Unspecified)
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
            }
        };

        var dto = WorkPlanScheduleDtoFactory.Create(schedule);

        var scheduled = dto.ScheduledTasks[0];
        Assert.Equal(DateTimeKind.Utc, scheduled.PlannedStart!.Value.Kind);
        Assert.Equal(DateTimeKind.Utc, scheduled.PlannedEnd!.Value.Kind);
        // The wall-clock ticks must not be shifted, only re-labelled as UTC.
        Assert.Equal(
            new DateTime(2026, 7, 20, 11, 50, 0, DateTimeKind.Utc).Ticks,
            scheduled.PlannedStart.Value.Ticks);

        // Nullable timestamps remain null.
        Assert.Null(dto.UnscheduledTasks[0].PlannedStart);
        Assert.Null(dto.UnscheduledTasks[0].PlannedEnd);
    }

    [Fact]
    public void Create_DoesNotShiftTimestampsAlreadyMarkedUtc()
    {
        var utcStart = new DateTime(2026, 7, 20, 11, 50, 0, DateTimeKind.Utc);
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
                    PlannedStart = utcStart,
                    PlannedEnd = utcStart.AddHours(4)
                }
            }
        };

        var dto = WorkPlanScheduleDtoFactory.Create(schedule);

        Assert.Equal(DateTimeKind.Utc, dto.ScheduledTasks[0].PlannedStart!.Value.Kind);
        Assert.Equal(utcStart, dto.ScheduledTasks[0].PlannedStart!.Value);
    }

    [Fact]
    public void Create_JsonSerializationEmitsZForScheduleTimestampsAndKeepsNullsNull()
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
                    PlannedStart = new DateTime(2026, 7, 20, 11, 50, 0, DateTimeKind.Unspecified),
                    PlannedEnd = new DateTime(2026, 7, 20, 15, 50, 0, DateTimeKind.Unspecified)
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
            }
        };

        var dto = WorkPlanScheduleDtoFactory.Create(schedule);
        var json = JsonSerializer.Serialize(
            dto,
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });

        using var document = JsonDocument.Parse(json);
        var scheduledTask = document.RootElement.GetProperty("scheduledTasks")[0];

        var plannedStart = scheduledTask.GetProperty("plannedStart").GetString();
        var plannedEnd = scheduledTask.GetProperty("plannedEnd").GetString();
        Assert.EndsWith("Z", plannedStart, StringComparison.Ordinal);
        Assert.EndsWith("Z", plannedEnd, StringComparison.Ordinal);
        // The wall-clock instant must be re-labelled UTC, not shifted through a server-local timezone.
        Assert.StartsWith("2026-07-20T11:50:00", plannedStart, StringComparison.Ordinal);
        Assert.StartsWith("2026-07-20T15:50:00", plannedEnd, StringComparison.Ordinal);

        // Nullable timestamps remain null in the serialized contract.
        var unscheduledTask = document.RootElement.GetProperty("unscheduledTasks")[0];
        Assert.Equal(JsonValueKind.Null, unscheduledTask.GetProperty("plannedStart").ValueKind);
        Assert.Equal(JsonValueKind.Null, unscheduledTask.GetProperty("plannedEnd").ValueKind);
    }
}

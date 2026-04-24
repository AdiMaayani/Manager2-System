using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Repositories;

namespace ManageR2.Infrastructure.Services;

public class SmartAssignmentService : ISmartAssignmentService
{
    private readonly ISmartAssignmentRepository _smartAssignmentRepository;

    public SmartAssignmentService(ISmartAssignmentRepository smartAssignmentRepository)
    {
        _smartAssignmentRepository = smartAssignmentRepository;
    }

    public async Task<SmartAssignmentRunResultModel> GenerateRecommendationsAsync(SmartAssignmentRequestModel request)
    {
        if (request == null)
        {
            throw new ArgumentNullException(nameof(request));
        }

        var input = await _smartAssignmentRepository.GetAssignmentInputAsync(request.ProjectId, request.WorkItemIds, request.PlanningDate);
        var response = new SmartAssignmentRunResultModel
        {
            GeneratedAt = DateTime.UtcNow
        };

        foreach (var task in input.Tasks)
        {
            var taskResult = new SmartAssignmentTaskResultModel
            {
                WorkItemId = task.WorkItemId,
                TaskTitle = task.TaskTitle,
                Score = 0m
            };

            var currentAssignment = input.Assignments.FirstOrDefault(a => a.WorkItemId == task.WorkItemId);
            taskResult.CurrentEmployeeId = currentAssignment?.EmployeeId;
            taskResult.CurrentEmployeeName = currentAssignment?.EmployeeName;

            if (task.IsLocked && !request.IncludeLockedTasks)
            {
                taskResult.Warnings.Add("Task is locked.");
                taskResult.Reasons.Add("Locked task was skipped because IncludeLockedTasks is false.");
                response.TaskResults.Add(taskResult);
                continue;
            }

            if (!taskResult.CurrentEmployeeId.HasValue)
            {
                taskResult.Warnings.Add("Task has no employee assignment.");
            }

            if (!task.EstimatedHours.HasValue || task.EstimatedHours.Value <= 0m)
            {
                taskResult.Warnings.Add("Task has no estimated hours.");
            }

            var assignableEmployees = input.Employees
                .Where(e => e.IsActive && e.IsAssignable)
                .ToList();

            var recommendedEmployee = !string.IsNullOrWhiteSpace(task.RequiredRole)
                ? assignableEmployees.FirstOrDefault(e =>
                    !string.IsNullOrWhiteSpace(e.PrimaryRole) &&
                    string.Equals(e.PrimaryRole, task.RequiredRole, StringComparison.OrdinalIgnoreCase))
                : null;

            recommendedEmployee ??= assignableEmployees.FirstOrDefault();

            if (recommendedEmployee != null)
            {
                taskResult.RecommendedEmployeeId = recommendedEmployee.EmployeeId;
                taskResult.RecommendedEmployeeName = recommendedEmployee.EmployeeName;
                taskResult.Score = 1m;

                if (!string.IsNullOrWhiteSpace(task.RequiredRole) &&
                    !string.IsNullOrWhiteSpace(recommendedEmployee.PrimaryRole) &&
                    string.Equals(recommendedEmployee.PrimaryRole, task.RequiredRole, StringComparison.OrdinalIgnoreCase))
                {
                    taskResult.Reasons.Add("Recommended employee matches the required role.");
                }
                else if (!string.IsNullOrWhiteSpace(task.RequiredRole))
                {
                    taskResult.Reasons.Add("No role match found. Recommended first active assignable employee.");
                }
                else
                {
                    taskResult.Reasons.Add("Recommended first active assignable employee.");
                }
            }
            else
            {
                taskResult.Warnings.Add("No active assignable employees were found.");
                taskResult.Reasons.Add("Recommendation could not be generated.");
            }

            response.TaskResults.Add(taskResult);
        }

        var employeeLoad = input.Employees
            .Where(e => e.IsActive && e.IsAssignable)
            .Select(employee =>
            {
                var assignedHours = input.Assignments
                    .Where(a => a.EmployeeId == employee.EmployeeId)
                    .Sum(a => a.AssignedHours);

                var loadPercentage = employee.CapacityHours.HasValue && employee.CapacityHours.Value > 0m
                    ? (assignedHours / employee.CapacityHours.Value) * 100m
                    : 0m;

                return new SmartAssignmentEmployeeLoadModel
                {
                    EmployeeId = employee.EmployeeId,
                    EmployeeName = employee.EmployeeName,
                    AssignedHours = assignedHours,
                    CapacityHours = employee.CapacityHours,
                    LoadPercentage = loadPercentage
                };
            })
            .ToList();

        response.EmployeeLoad = employeeLoad;
        response.TotalTasks = response.TaskResults.Count;
        response.TasksWithRecommendations = response.TaskResults.Count(r => r.RecommendedEmployeeId.HasValue);
        response.ViolationsCount = response.TaskResults.Sum(r => r.Violations.Count);
        response.WarningsCount = response.TaskResults.Sum(r => r.Warnings.Count);
        response.Message = request.SaveRun
            ? "Recommendations generated. Save-run is not implemented in this milestone."
            : "Recommendations generated successfully.";

        return response;
    }
}

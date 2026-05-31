using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Models.SmartAssignment;
using ManageR2.Infrastructure.Repositories;
using ManageR2.Infrastructure.Services.SmartAssignment;

namespace ManageR2.Infrastructure.Services;

// Adapter for the existing project-level SmartAssignment endpoint.
// It keeps the public API stable while delegating scoring to the advanced per-task algorithm.
public class SmartAssignmentBatchService : ISmartAssignmentService
{
    private readonly IWorkItemRepository _workItemRepository;
    private readonly IAdvancedSmartAssignmentService _advancedSmartAssignmentService;

    public SmartAssignmentBatchService(
        IWorkItemRepository workItemRepository,
        IAdvancedSmartAssignmentService advancedSmartAssignmentService)
    {
        _workItemRepository = workItemRepository;
        _advancedSmartAssignmentService = advancedSmartAssignmentService;
    }

    public async Task<SmartAssignmentRunResultModel> GenerateRecommendationsAsync(
        SmartAssignmentRequestModel request)
    {
        var tasks = await ResolveTasksAsync(request);
        var taskResults = new List<SmartAssignmentTaskResultModel>();

        foreach (var task in tasks)
        {
            var candidates = await _advancedSmartAssignmentService.GetRecommendationsAsync(task.WorkItemId);
            var recommendation = candidates.FirstOrDefault(candidate => candidate.IsEligible)
                ?? candidates.FirstOrDefault();

            if (recommendation == null)
            {
                taskResults.Add(CreateEmptyResult(task));
                continue;
            }

            taskResults.Add(new SmartAssignmentTaskResultModel
            {
                WorkItemId = task.WorkItemId,
                TaskTitle = task.Title,
                RecommendedEmployeeId = recommendation.EmployeeId,
                RecommendedEmployeeName = recommendation.FullName,
                Score = recommendation.TotalScore ?? 0,
                Violations = recommendation.IsEligible
                    ? new List<string>()
                    : new List<string> { recommendation.ExclusionReason ?? "No eligible employee found." },
                Warnings = BuildWarnings(recommendation),
                Reasons = BuildReasons(recommendation)
            });
        }

        return new SmartAssignmentRunResultModel
        {
            GeneratedAt = DateTime.UtcNow,
            TotalTasks = tasks.Count,
            TasksWithRecommendations = taskResults.Count(result => result.RecommendedEmployeeId.HasValue),
            ViolationsCount = taskResults.Sum(result => result.Violations.Count),
            WarningsCount = taskResults.Sum(result => result.Warnings.Count),
            Message = taskResults.Count == 0
                ? "No tasks were available for smart assignment."
                : "Smart assignment recommendations generated successfully.",
            TaskResults = taskResults
        };
    }

    private async Task<List<WorkItem>> ResolveTasksAsync(SmartAssignmentRequestModel request)
    {
        var tasks = new List<WorkItem>();

        if (request.WorkItemIds is { Count: > 0 })
        {
            foreach (var workItemId in request.WorkItemIds.Distinct())
            {
                var workItem = await _workItemRepository.GetByIdAsync(workItemId);
                if (workItem != null)
                {
                    tasks.Add(workItem);
                }
            }
        }
        else if (request.ProjectId.HasValue)
        {
            tasks = await _workItemRepository.GetTasksByParentIdAsync(request.ProjectId.Value);
        }

        if (!request.IncludeLockedTasks)
        {
            tasks = tasks.Where(task => !task.IsLocked).ToList();
        }

        return tasks
            .Where(task => string.Equals(task.WorkType, "Task", StringComparison.OrdinalIgnoreCase))
            .ToList();
    }

    private static SmartAssignmentTaskResultModel CreateEmptyResult(WorkItem task)
    {
        return new SmartAssignmentTaskResultModel
        {
            WorkItemId = task.WorkItemId,
            TaskTitle = task.Title,
            Violations = new List<string> { "No recommendation could be generated." }
        };
    }

    private static List<string> BuildWarnings(EmployeeCandidateModel recommendation)
    {
        var warnings = new List<string>();

        if (!recommendation.IsEligible && !string.IsNullOrWhiteSpace(recommendation.ExclusionReason))
        {
            warnings.Add(recommendation.ExclusionReason);
        }

        return warnings;
    }

    private static List<string> BuildReasons(EmployeeCandidateModel recommendation)
    {
        return string.IsNullOrWhiteSpace(recommendation.RecommendationSummary)
            ? new List<string>()
            : new List<string> { recommendation.RecommendationSummary };
    }
}

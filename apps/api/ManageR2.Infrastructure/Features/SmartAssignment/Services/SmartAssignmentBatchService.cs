using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Models.SmartAssignment;
using ManageR2.Infrastructure.Repositories;
using ManageR2.Infrastructure.Repositories.SmartAssignment;
using ManageR2.Infrastructure.Services.SmartAssignment;

namespace ManageR2.Infrastructure.Services;

// Adapter for the existing project-level SmartAssignment endpoint.
// It keeps the public API stable while delegating scoring to the advanced per-task algorithm,
// and (when SaveRun is true) persists the run + ranked candidates via the Rec_ procedures.
public class SmartAssignmentBatchService : ISmartAssignmentService
{
    // How many ranked candidates to persist per task when a run is saved.
    private const int MaxPersistedCandidatesPerTask = 5;
    private const string AlgorithmVersion = "1.0";

    private readonly IWorkItemRepository _workItemRepository;
    private readonly IAdvancedSmartAssignmentService _advancedSmartAssignmentService;
    private readonly SmartAssignmentRepository _smartAssignmentRepository;

    public SmartAssignmentBatchService(
        IWorkItemRepository workItemRepository,
        IAdvancedSmartAssignmentService advancedSmartAssignmentService,
        SmartAssignmentRepository smartAssignmentRepository)
    {
        _workItemRepository = workItemRepository;
        _advancedSmartAssignmentService = advancedSmartAssignmentService;
        _smartAssignmentRepository = smartAssignmentRepository;
    }

    public async Task<SmartAssignmentRunResultModel> GenerateRecommendationsAsync(
        SmartAssignmentRequestModel request)
    {
        var tasks = await ResolveTasksAsync(request);
        var taskResults = new List<SmartAssignmentTaskResultModel>();

        // Keep the full ranked candidate list per task so a saved run can persist all of them.
        var rankedByTask = new Dictionary<int, List<EmployeeCandidateModel>>();

        foreach (var task in tasks)
        {
            var candidates = await _advancedSmartAssignmentService.GetRecommendationsAsync(task.WorkItemId);
            rankedByTask[task.WorkItemId] = candidates;

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
                Reasons = BuildReasons(recommendation),
                Factors = recommendation.Factors
            });
        }

        // Honor SaveRun: persist a run header plus the ranked candidates for every task in it.
        int? recommendationRunId = null;
        if (request.SaveRun && tasks.Count > 0)
        {
            recommendationRunId = await PersistRunAsync(request, rankedByTask);
        }

        return new SmartAssignmentRunResultModel
        {
            RecommendationRunId = recommendationRunId,
            GeneratedAt = DateTime.UtcNow,
            TotalTasks = tasks.Count,
            TasksWithRecommendations = taskResults.Count(result => result.RecommendedEmployeeId.HasValue),
            ViolationsCount = taskResults.Sum(result => result.Violations.Count),
            WarningsCount = taskResults.Sum(result => result.Warnings.Count),
            Message = taskResults.Count == 0
                ? "No tasks were available for smart assignment."
                : recommendationRunId.HasValue
                    ? "Smart assignment recommendations generated and saved successfully."
                    : "Smart assignment recommendations generated successfully.",
            TaskResults = taskResults
        };
    }

    // Creates one run header and persists up to MaxPersistedCandidatesPerTask ranked rows per task.
    private async Task<int?> PersistRunAsync(
        SmartAssignmentRequestModel request,
        Dictionary<int, List<EmployeeCandidateModel>> rankedByTask)
    {
        // ScopeType must match the DB CHECK constraint CK_Rec_RecommendationRuns_ScopeType,
        // which only permits 'Project', 'Task', or 'AllProjects'.
        string scopeType;
        int? runTaskId = null;
        if (request.ProjectId.HasValue)
        {
            scopeType = "Project";
        }
        else if (rankedByTask.Count == 1)
        {
            scopeType = "Task";
            runTaskId = rankedByTask.Keys.First();
        }
        else
        {
            scopeType = "AllProjects";
        }

        var runId = await _smartAssignmentRepository.CreateRecommendationRunAsync(
            scopeType,
            request.ProjectId,
            runTaskId,
            request.RequestedByUserId,
            AlgorithmVersion,
            inputSnapshotJson: null);

        if (runId <= 0)
        {
            return null;
        }

        foreach (var (taskId, candidates) in rankedByTask)
        {
            var topCandidates = candidates.Take(MaxPersistedCandidatesPerTask);
            foreach (var candidate in topCandidates)
            {
                await _smartAssignmentRepository.SaveTaskAssignmentRecommendationAsync(runId, taskId, candidate);
            }
        }

        return runId;
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

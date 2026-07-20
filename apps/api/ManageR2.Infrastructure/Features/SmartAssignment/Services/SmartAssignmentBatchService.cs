using System.Text.Json;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Features.WorkItems;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Models.SmartAssignment;
using ManageR2.Infrastructure.Repositories;
using ManageR2.Infrastructure.Repositories.SmartAssignment;
using ManageR2.Infrastructure.Services.SmartAssignment;

namespace ManageR2.Infrastructure.Services;

/// <summary>
/// Deterministic batch orchestration over the same policy resolver and scoring engine used by single-task flows.
/// Recommendations are previews only; simulated load is held in memory and never persists an assignment.
/// </summary>
public sealed class SmartAssignmentBatchService : ISmartAssignmentService
{
    private const string AlgorithmVersion = "2.1-decision-support";
    public const string PlanningDateCompatibilityWarning = "PlanningDateNotApplied";

    private readonly IWorkItemRepository _workItemRepository;
    private readonly IAdvancedSmartAssignmentService _advancedSmartAssignmentService;
    private readonly ISmartAssignmentRepository _smartAssignmentRepository;
    private readonly TimeProvider _timeProvider;

    public SmartAssignmentBatchService(
        IWorkItemRepository workItemRepository,
        IAdvancedSmartAssignmentService advancedSmartAssignmentService,
        ISmartAssignmentRepository smartAssignmentRepository,
        TimeProvider? timeProvider = null)
    {
        _workItemRepository = workItemRepository;
        _advancedSmartAssignmentService = advancedSmartAssignmentService;
        _smartAssignmentRepository = smartAssignmentRepository;
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public Task<SmartAssignmentRunResultModel> GenerateRecommendationsAsync(
        SmartAssignmentRequestModel request) =>
        GenerateRecommendationsAsync(request, CancellationToken.None);

    public async Task<SmartAssignmentRunResultModel> GenerateRecommendationsAsync(
        SmartAssignmentRequestModel request,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var tasks = await ResolveTasksAsync(request);
        var taskResults = new List<SmartAssignmentTaskResultModel>();
        var rankedByTask = new Dictionary<int, List<EmployeeCandidateModel>>();
        var simulatedLoad = new Dictionary<int, SimulatedWorkloadAdjustment>();
        var currentDate = _timeProvider.GetLocalNow().Date;

        foreach (var task in tasks)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var context = new SmartAssignmentEvaluationContext(
                currentDate,
                simulatedLoad,
                request.WeightsOverride);
            var evaluation = await _advancedSmartAssignmentService.EvaluateTaskAsync(
                task.WorkItemId,
                context,
                policyOverride: null,
                cancellationToken);
            var candidates = evaluation.Candidates.ToList();
            rankedByTask[task.WorkItemId] = candidates;

            var recommendation = candidates.FirstOrDefault();
            if (recommendation is null)
            {
                taskResults.Add(CreateNoCandidatesResult(task, evaluation));
                continue;
            }

            taskResults.Add(new SmartAssignmentTaskResultModel
            {
                WorkItemId = task.WorkItemId,
                TaskTitle = task.Title,
                RecommendedEmployeeId = recommendation.EmployeeId,
                RecommendedEmployeeName = recommendation.FullName,
                Score = recommendation.TotalScore ?? 0m,
                Warnings = BuildWarnings(recommendation),
                Reasons = BuildReasons(recommendation),
                Factors = recommendation.Factors,
                PolicyProfileKey = evaluation.Policy.ProfileKey.ToString(),
                PolicyVersion = evaluation.Policy.Version,
                PolicyDisplayName = evaluation.Policy.DisplayName,
                RequiredRoles = task.RequiredRoles
            });

            if (evaluation.Policy.EnableBatchSimulatedLoadBalancing)
            {
                AddSimulatedLoad(simulatedLoad, recommendation.EmployeeId, task.EstimatedHours);
            }
        }

        int? recommendationRunId = null;
        if (request.SaveRun && tasks.Count > 0)
        {
            cancellationToken.ThrowIfCancellationRequested();
            recommendationRunId = await PersistRunAsync(request, rankedByTask);
        }

        var compatibilityWarnings = request.PlanningDate.HasValue
            ? new List<string> { PlanningDateCompatibilityWarning }
            : new List<string>();

        return new SmartAssignmentRunResultModel
        {
            RecommendationRunId = recommendationRunId,
            GeneratedAt = _timeProvider.GetUtcNow().UtcDateTime,
            TotalTasks = tasks.Count,
            TasksWithRecommendations = taskResults.Count(result => result.RecommendedEmployeeId.HasValue),
            ViolationsCount = taskResults.Sum(result => result.Violations.Count),
            WarningsCount = taskResults.Sum(result => result.Warnings.Count) + compatibilityWarnings.Count,
            Message = taskResults.Count == 0
                ? "No tasks were available for smart assignment."
                : recommendationRunId.HasValue
                    ? "Smart assignment recommendations generated and saved successfully."
                    : "Smart assignment recommendations generated successfully.",
            CompatibilityWarnings = compatibilityWarnings,
            TaskResults = taskResults
        };
    }

    private static void AddSimulatedLoad(
        IDictionary<int, SimulatedWorkloadAdjustment> simulatedLoad,
        int employeeId,
        decimal? estimatedHours)
    {
        var current = simulatedLoad.TryGetValue(employeeId, out var existing)
            ? existing
            : new SimulatedWorkloadAdjustment(0m, 0);
        simulatedLoad[employeeId] = current with
        {
            AdditionalAssignedHours = current.AdditionalAssignedHours + Math.Max(estimatedHours ?? 0m, 0m),
            AdditionalAssignments = current.AdditionalAssignments + 1
        };
    }

    private async Task<int?> PersistRunAsync(
        SmartAssignmentRequestModel request,
        Dictionary<int, List<EmployeeCandidateModel>> rankedByTask)
    {
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

        var policySnapshotJson = JsonSerializer.Serialize(rankedByTask.ToDictionary(
            pair => pair.Key,
            pair =>
            {
                var candidate = pair.Value.FirstOrDefault();
                return new
                {
                    candidate?.PolicyProfileKey,
                    candidate?.PolicyVersion,
                    candidate?.PolicyDisplayName,
                    FactorWeights = candidate?.Factors.ToDictionary(factor => factor.Key, factor => factor.WeightPercent)
                };
            }));

        var runId = await _smartAssignmentRepository.CreateRecommendationRunAsync(
            scopeType,
            request.ProjectId,
            runTaskId,
            request.RequestedByUserId,
            AlgorithmVersion,
            policySnapshotJson);

        if (runId <= 0)
        {
            return null;
        }

        foreach (var (taskId, candidates) in rankedByTask.OrderBy(pair => pair.Key))
        {
            // Feedback can be submitted for any ranked employee, so a saved run must preserve
            // the complete active-employee ranking rather than only the first few rows.
            foreach (var candidate in candidates)
            {
                await _smartAssignmentRepository.SaveTaskAssignmentRecommendationAsync(runId, taskId, candidate);
            }
        }

        await _smartAssignmentRepository.CompleteRecommendationRunAsync(runId);

        return runId;
    }

    private async Task<List<WorkItem>> ResolveTasksAsync(SmartAssignmentRequestModel request)
    {
        var tasks = new List<WorkItem>();

        if (request.WorkItemIds is { Count: > 0 })
        {
            foreach (var workItemId in request.WorkItemIds.Distinct().OrderBy(id => id))
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
            .Where(IsSchedulableTask)
            .OrderBy(task => !task.PlannedStart.HasValue)
            .ThenBy(task => task.PlannedStart)
            .ThenBy(task => task.WorkItemId)
            .ToList();
    }

    private static bool IsSchedulableTask(WorkItem task) =>
        string.Equals(task.WorkType, WorkItemWorkTypes.Task, StringComparison.OrdinalIgnoreCase)
        || string.Equals(task.WorkType, WorkItemWorkTypes.ServiceCall, StringComparison.OrdinalIgnoreCase);

    private static SmartAssignmentTaskResultModel CreateNoCandidatesResult(
        WorkItem task,
        SmartAssignmentEvaluationResult evaluation)
    {
        return new SmartAssignmentTaskResultModel
        {
            WorkItemId = task.WorkItemId,
            TaskTitle = task.Title,
            Warnings = new List<string> { "No active employees were available for ranking." },
            PolicyProfileKey = evaluation.Policy.ProfileKey.ToString(),
            PolicyVersion = evaluation.Policy.Version,
            PolicyDisplayName = evaluation.Policy.DisplayName,
            RequiredRoles = task.RequiredRoles
        };
    }

    private static List<string> BuildWarnings(EmployeeCandidateModel candidate)
    {
        if (string.IsNullOrWhiteSpace(candidate.WarningsJson))
        {
            return new List<string>();
        }

        try
        {
            return JsonSerializer.Deserialize<List<string>>(candidate.WarningsJson) ?? new List<string>();
        }
        catch (JsonException)
        {
            return candidate.MissingInputCodes.ToList();
        }
    }

    private static List<string> BuildReasons(EmployeeCandidateModel candidate) =>
        string.IsNullOrWhiteSpace(candidate.RecommendationSummary)
            ? new List<string>()
            : new List<string> { candidate.RecommendationSummary };
}

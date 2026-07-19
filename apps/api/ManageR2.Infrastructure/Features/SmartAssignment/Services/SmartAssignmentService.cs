using ManageR2.Domain.Features.SmartAssignment;
using ManageR2.Domain.Features.WorkItems;
using ManageR2.Infrastructure.Features.SmartAssignment.Scoring;
using ManageR2.Infrastructure.Models.SmartAssignment;
using ManageR2.Infrastructure.Repositories.SmartAssignment;

namespace ManageR2.Infrastructure.Services.SmartAssignment;

/// <summary>
/// I/O orchestrator for saved and draft recommendations. All scoring remains in the shared pure engine.
/// </summary>
public sealed class SmartAssignmentService : IAdvancedSmartAssignmentService
{
    private readonly ISmartAssignmentRepository _repository;
    private readonly ISmartAssignmentPolicyProvider _policyProvider;
    private readonly ISmartAssignmentScoringEngine _scoringEngine;
    private readonly TimeProvider _timeProvider;
    private readonly ISmartAssignmentRouteEnricher? _routeEnricher;

    public SmartAssignmentService(
        ISmartAssignmentRepository repository,
        ISmartAssignmentPolicyProvider policyProvider,
        ISmartAssignmentScoringEngine scoringEngine,
        TimeProvider? timeProvider = null,
        ISmartAssignmentRouteEnricher? routeEnricher = null)
    {
        _repository = repository;
        _policyProvider = policyProvider;
        _scoringEngine = scoringEngine;
        _timeProvider = timeProvider ?? TimeProvider.System;
        _routeEnricher = routeEnricher;
    }

    public Task<List<EmployeeCandidateModel>> GetRecommendationsAsync(int workItemId) =>
        GetRecommendationsAsync(workItemId, CancellationToken.None);

    public async Task<List<EmployeeCandidateModel>> GetRecommendationsAsync(
        int workItemId,
        CancellationToken cancellationToken)
    {
        var evaluation = await EvaluateTaskAsync(
            workItemId,
            evaluationContext: null,
            policyOverride: null,
            cancellationToken);
        return evaluation.Candidates.ToList();
    }

    public Task<List<EmployeeCandidateModel>> GetRecommendationsForDraftAsync(
        DraftTaskRecommendationContextModel context) =>
        GetRecommendationsForDraftAsync(context, CancellationToken.None);

    public async Task<List<EmployeeCandidateModel>> GetRecommendationsForDraftAsync(
        DraftTaskRecommendationContextModel context,
        CancellationToken cancellationToken)
    {
        var evaluation = await EvaluateDraftAsync(
            context,
            evaluationContext: null,
            policyOverride: null,
            cancellationToken);
        return evaluation.Candidates.ToList();
    }

    public Task<SmartAssignmentEvaluationResult> EvaluateTaskAsync(
        int workItemId,
        SmartAssignmentEvaluationContext? evaluationContext = null,
        SmartAssignmentPolicySnapshot? policyOverride = null) =>
        EvaluateTaskAsync(
            workItemId,
            evaluationContext,
            policyOverride,
            CancellationToken.None);

    public async Task<SmartAssignmentEvaluationResult> EvaluateTaskAsync(
        int workItemId,
        SmartAssignmentEvaluationContext? evaluationContext,
        SmartAssignmentPolicySnapshot? policyOverride,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var input = await _repository.GetTaskRecommendationInputAsync(workItemId);
        if (input?.Task is null)
        {
            throw new InvalidOperationException($"No recommendation input found for WorkItemId = {workItemId}.");
        }

        var taskCategory = ResolveTaskCategory(input.Task);
        var policy = await ResolveEffectivePolicyAsync(
            taskCategory,
            policyOverride,
            evaluationContext?.WeightsOverride);
        var effectiveContext = evaluationContext ?? CreateDefaultContext();
        if (_routeEnricher is not null)
        {
            await _routeEnricher.EnrichAsync(input, cancellationToken);
        }

        return _scoringEngine.Evaluate(input, policy, effectiveContext);
    }

    public Task<SmartAssignmentEvaluationResult> EvaluateDraftAsync(
        DraftTaskRecommendationContextModel context,
        SmartAssignmentEvaluationContext? evaluationContext = null,
        SmartAssignmentPolicySnapshot? policyOverride = null) =>
        EvaluateDraftAsync(
            context,
            evaluationContext,
            policyOverride,
            CancellationToken.None);

    public async Task<SmartAssignmentEvaluationResult> EvaluateDraftAsync(
        DraftTaskRecommendationContextModel context,
        SmartAssignmentEvaluationContext? evaluationContext,
        SmartAssignmentPolicySnapshot? policyOverride,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(context);
        cancellationToken.ThrowIfCancellationRequested();

        var input = await _repository.GetDraftTaskRecommendationInputAsync(context);
        if (input?.Task is null)
        {
            throw new InvalidOperationException("No recommendation input found for the draft task context.");
        }

        // The current draft API cannot carry required skills; make that limitation explicit in the result.
        input.RequiredSkillsInputAvailable = false;
        var policy = await ResolveEffectivePolicyAsync(
            context.TaskCategory,
            policyOverride,
            context.WeightsOverride ?? evaluationContext?.WeightsOverride);
        var effectiveContext = evaluationContext ?? CreateDefaultContext();
        if (_routeEnricher is not null)
        {
            await _routeEnricher.EnrichAsync(input, cancellationToken);
        }

        return _scoringEngine.Evaluate(input, policy, effectiveContext);
    }

    private SmartAssignmentEvaluationContext CreateDefaultContext() =>
        SmartAssignmentEvaluationContext.Empty(_timeProvider.GetLocalNow().Date);

    private async Task<SmartAssignmentPolicySnapshot> ResolveEffectivePolicyAsync(
        string? taskCategory,
        SmartAssignmentPolicySnapshot? policyOverride,
        SmartAssignmentWeights? weightsOverride)
    {
        var baseline = policyOverride ?? await _policyProvider.ResolveAsync(taskCategory);
        return weightsOverride is null
            ? baseline
            : baseline with { Weights = weightsOverride };
    }

    internal static string? ResolveTaskCategory(TaskCoreDataModel task)
    {
        if (string.Equals(task.WorkType, WorkItemWorkTypes.ServiceCall, StringComparison.OrdinalIgnoreCase))
        {
            return WorkItemTaskCategories.ServiceCall;
        }

        if (!string.Equals(task.WorkType, WorkItemWorkTypes.Task, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return task.ParentWorkItemId.HasValue
            ? WorkItemTaskCategories.Project
            : WorkItemTaskCategories.Regular;
    }
}

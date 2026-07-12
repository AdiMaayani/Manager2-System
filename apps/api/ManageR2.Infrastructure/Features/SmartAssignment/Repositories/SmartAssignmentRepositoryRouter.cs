using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Models.SmartAssignment;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Repositories.SmartAssignment
{
    // Dual-run router for the SmartAssignment domain (Wave 5). Reads are shadow-compared with list-order
    // normalization (the recommendation-input result sets have no inherent ordering and the C# scoring is
    // order-insensitive); writes are dual-written best-effort. With default flags the router delegates
    // purely to the SQL Server repository and never touches Postgres.
    public sealed class SmartAssignmentRepositoryRouter : ISmartAssignmentRepository
    {
        private readonly SmartAssignmentRepository _sqlServer;
        private readonly PostgresSmartAssignmentRepository _postgres;
        private readonly IProviderConnectionResolver _resolver;
        private readonly IProviderDriftRecorder _driftRecorder;
        private readonly IPayloadParityComparer _parityComparer;
        private readonly ILogger<SmartAssignmentRepositoryRouter> _logger;

        // Maps the authoritative (SQL Server) run id to the best-effort Postgres run id created during the
        // same scoped request, so dual-written recommendation rows satisfy the Postgres run FK. A dual-write
        // save with no mapped run id is skipped and recorded (never silently converted into apparent parity).
        private readonly Dictionary<int, int> _dualWriteRunIdMap = new();

        public SmartAssignmentRepositoryRouter(
            SmartAssignmentRepository sqlServer,
            PostgresSmartAssignmentRepository postgres,
            IProviderConnectionResolver resolver,
            IProviderDriftRecorder driftRecorder,
            IPayloadParityComparer parityComparer,
            ILogger<SmartAssignmentRepositoryRouter> logger)
        {
            _sqlServer = sqlServer;
            _postgres = postgres;
            _resolver = resolver;
            _driftRecorder = driftRecorder;
            _parityComparer = parityComparer;
            _logger = logger;
        }

        private ISmartAssignmentRepository Primary =>
            _resolver.Options.Primary == DatabaseProvider.Postgres ? _postgres : _sqlServer;

        public async Task<TaskRecommendationInputModel> GetTaskRecommendationInputAsync(int workItemId)
        {
            var result = await Primary.GetTaskRecommendationInputAsync(workItemId);
            if (_resolver.ShadowRead is not null)
            {
                await ShadowCompareInputAsync("SmartAssignment.GetTaskRecommendationInput", result,
                    () => _postgres.GetTaskRecommendationInputAsync(workItemId));
            }

            return result;
        }

        public async Task<TaskRecommendationInputModel> GetDraftTaskRecommendationInputAsync(
            DraftTaskRecommendationContextModel context)
        {
            var result = await Primary.GetDraftTaskRecommendationInputAsync(context);
            if (_resolver.ShadowRead is not null)
            {
                await ShadowCompareInputAsync("SmartAssignment.GetDraftTaskRecommendationInput", result,
                    () => _postgres.GetDraftTaskRecommendationInputAsync(context));
            }

            return result;
        }

        public async Task<int> CreateRecommendationRunAsync(
            string scopeType,
            int? projectId,
            int? taskId,
            int? requestedByUserId,
            string algorithmVersion,
            string? inputSnapshotJson)
        {
            var runId = await Primary.CreateRecommendationRunAsync(
                scopeType, projectId, taskId, requestedByUserId, algorithmVersion, inputSnapshotJson);

            if (_resolver.DualWrite is not null && runId > 0)
            {
                await DualWriteAsync("SmartAssignment.CreateRecommendationRun", async () =>
                {
                    var postgresRunId = await _postgres.CreateRecommendationRunAsync(
                        scopeType, projectId, taskId, requestedByUserId, algorithmVersion, inputSnapshotJson);
                    if (postgresRunId > 0)
                    {
                        _dualWriteRunIdMap[runId] = postgresRunId;
                    }
                });
            }

            return runId;
        }

        public async Task SaveTaskAssignmentRecommendationAsync(int runId, int taskId, EmployeeCandidateModel candidate)
        {
            await Primary.SaveTaskAssignmentRecommendationAsync(runId, taskId, candidate);

            if (_resolver.DualWrite is not null)
            {
                await DualWriteAsync("SmartAssignment.SaveTaskAssignmentRecommendation", () =>
                {
                    if (!_dualWriteRunIdMap.TryGetValue(runId, out var postgresRunId))
                    {
                        // No Postgres run to attach to (create dual-write failed/skipped). Record and skip
                        // rather than writing an orphan row or faking parity.
                        _driftRecorder.RecordDriftDetected(
                            "SmartAssignment.SaveTaskAssignmentRecommendation",
                            "no mapped Postgres run id for dual-write");
                        return Task.CompletedTask;
                    }

                    return _postgres.SaveTaskAssignmentRecommendationAsync(postgresRunId, taskId, candidate);
                });
            }
        }

        private async Task ShadowCompareInputAsync(
            string operation,
            TaskRecommendationInputModel primaryResult,
            Func<Task<TaskRecommendationInputModel>> shadowRead)
        {
            try
            {
                _driftRecorder.RecordShadowCompared(operation);
                var shadowResult = await shadowRead();
                var comparison = _parityComparer.Compare(
                    SmartAssignmentInputParityNormalizer.Normalize(primaryResult),
                    SmartAssignmentInputParityNormalizer.Normalize(shadowResult));
                if (!comparison.IsMatch)
                {
                    _driftRecorder.RecordDriftDetected(operation, comparison.DiffSummary ?? "unspecified");
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Shadow read failed for {Operation}.", operation);
            }
        }

        private async Task DualWriteAsync(string operation, Func<Task> dualWrite)
        {
            try
            {
                _driftRecorder.RecordDualWriteAttempted(operation);
                await dualWrite();
            }
            catch (Exception ex)
            {
                _driftRecorder.RecordDualWriteFailed(operation, ex);
            }
        }
    }
}

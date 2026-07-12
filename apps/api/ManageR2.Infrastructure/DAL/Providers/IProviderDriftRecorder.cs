namespace ManageR2.Infrastructure.DAL.Providers;

// Observability surface for the dual-run. Implementations emit the signals described in
// docs/migration/30_observability_and_drift.md. The default implementation logs structured
// events; it can later be backed by a metrics exporter without changing call sites.
public interface IProviderDriftRecorder
{
    void RecordShadowCompared(string operation);

    // diffSummary must never contain sensitive payload data - only a stable description of what differed.
    void RecordDriftDetected(string operation, string diffSummary);

    void RecordDualWriteAttempted(string operation);

    void RecordDualWriteFailed(string operation, Exception exception);

    void RecordExceptionTranslated(string operation, DatabaseProvider provider, string? providerErrorCode);
}

using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.DAL.Providers;

// Default drift recorder: structured logs. Critical drift is logged at Warning so it is easy
// to alert on and to gate wave promotion (a wave requires zero critical drift over the window).
public sealed class LoggingProviderDriftRecorder : IProviderDriftRecorder
{
    private readonly ILogger<LoggingProviderDriftRecorder> _logger;

    public LoggingProviderDriftRecorder(ILogger<LoggingProviderDriftRecorder> logger)
    {
        _logger = logger;
    }

    public void RecordShadowCompared(string operation) =>
        _logger.LogInformation("provider.read.shadow_compared operation={Operation}", operation);

    public void RecordDriftDetected(string operation, string diffSummary) =>
        _logger.LogWarning("provider.read.drift_detected operation={Operation} diff={DiffSummary}", operation, diffSummary);

    public void RecordDualWriteAttempted(string operation) =>
        _logger.LogInformation("provider.write.dual_write_attempted operation={Operation}", operation);

    public void RecordDualWriteFailed(string operation, Exception exception) =>
        _logger.LogError(exception, "provider.write.dual_write_failed operation={Operation}", operation);

    public void RecordExceptionTranslated(string operation, DatabaseProvider provider, string? providerErrorCode) =>
        _logger.LogInformation(
            "provider.exception.translated operation={Operation} provider={Provider} code={Code}",
            operation, provider, providerErrorCode);
}

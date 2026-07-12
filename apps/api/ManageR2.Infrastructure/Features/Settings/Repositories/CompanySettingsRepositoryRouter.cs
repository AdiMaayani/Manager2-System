using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Repositories;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Features.Settings.Repositories;

// Dual-run router for the company-settings domain. This is the reference pattern every migrated
// domain follows:
//   - The response always comes from the configured primary provider.
//   - When SQL Server is primary and ShadowReadPostgres is on, the Postgres read runs too and is
//     compared for drift (failures never affect the response).
//   - When SQL Server is primary and DualWritePostgres is on, the write is also applied to Postgres
//     on a best-effort basis (failures are recorded, never surfaced to the caller).
// With default options (Primary=SqlServer, flags off) this delegates purely to the SQL Server
// repository, so baseline behavior is identical.
public sealed class CompanySettingsRepositoryRouter : ICompanySettingsRepository
{
    private readonly CompanySettingsRepository _sqlServer;
    private readonly PostgresCompanySettingsRepository _postgres;
    private readonly IProviderConnectionResolver _resolver;
    private readonly IProviderDriftRecorder _driftRecorder;
    private readonly IPayloadParityComparer _parityComparer;
    private readonly ILogger<CompanySettingsRepositoryRouter> _logger;

    public CompanySettingsRepositoryRouter(
        CompanySettingsRepository sqlServer,
        PostgresCompanySettingsRepository postgres,
        IProviderConnectionResolver resolver,
        IProviderDriftRecorder driftRecorder,
        IPayloadParityComparer parityComparer,
        ILogger<CompanySettingsRepositoryRouter> logger)
    {
        _sqlServer = sqlServer;
        _postgres = postgres;
        _resolver = resolver;
        _driftRecorder = driftRecorder;
        _parityComparer = parityComparer;
        _logger = logger;
    }

    private ICompanySettingsRepository Primary =>
        _resolver.Options.Primary == DatabaseProvider.Postgres ? _postgres : _sqlServer;

    public async Task<CompanySettings?> GetCompanySettingsAsync()
    {
        var result = await Primary.GetCompanySettingsAsync();

        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareGetAsync(result);
        }

        return result;
    }

    public async Task<CompanySettings> UpsertCompanySettingsAsync(CompanySettings companySettings)
    {
        var result = await Primary.UpsertCompanySettingsAsync(companySettings);

        if (_resolver.DualWrite is not null)
        {
            await DualWriteUpsertAsync(companySettings);
        }

        return result;
    }

    private async Task ShadowCompareGetAsync(CompanySettings? primaryResult)
    {
        const string operation = "CompanySettings.Get";
        try
        {
            _driftRecorder.RecordShadowCompared(operation);
            var shadowResult = await _postgres.GetCompanySettingsAsync();
            var comparison = _parityComparer.Compare(primaryResult, shadowResult);
            if (!comparison.IsMatch)
            {
                _driftRecorder.RecordDriftDetected(operation, comparison.DiffSummary ?? "unspecified");
            }
        }
        catch (Exception ex)
        {
            // Shadow reads must never affect the served response.
            _logger.LogWarning(ex, "Shadow read failed for {Operation}.", operation);
        }
    }

    private async Task DualWriteUpsertAsync(CompanySettings companySettings)
    {
        const string operation = "CompanySettings.Upsert";
        try
        {
            _driftRecorder.RecordDualWriteAttempted(operation);
            await _postgres.UpsertCompanySettingsAsync(companySettings);
        }
        catch (Exception ex)
        {
            // Best-effort: the primary write already succeeded; record and continue.
            _driftRecorder.RecordDualWriteFailed(operation, ex);
        }
    }
}

using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Repositories;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Features.Sites.Repositories;

// Dual-run router for the sites domain (Wave 2). See CompanySettingsRepositoryRouter for the pattern.
public sealed class SiteRepositoryRouter : ISiteRepository
{
    private readonly SiteRepository _sqlServer;
    private readonly PostgresSiteRepository _postgres;
    private readonly IProviderConnectionResolver _resolver;
    private readonly IProviderDriftRecorder _driftRecorder;
    private readonly IPayloadParityComparer _parityComparer;
    private readonly ILogger<SiteRepositoryRouter> _logger;

    public SiteRepositoryRouter(
        SiteRepository sqlServer,
        PostgresSiteRepository postgres,
        IProviderConnectionResolver resolver,
        IProviderDriftRecorder driftRecorder,
        IPayloadParityComparer parityComparer,
        ILogger<SiteRepositoryRouter> logger)
    {
        _sqlServer = sqlServer;
        _postgres = postgres;
        _resolver = resolver;
        _driftRecorder = driftRecorder;
        _parityComparer = parityComparer;
        _logger = logger;
    }

    private ISiteRepository Primary =>
        _resolver.Options.Primary == DatabaseProvider.Postgres ? _postgres : _sqlServer;

    public async Task<IEnumerable<Site>> GetAllAsync()
    {
        var result = await Primary.GetAllAsync();

        if (_resolver.ShadowRead is not null)
        {
            var materialized = result as ICollection<Site> ?? result.ToList();
            result = materialized;
            await ShadowCompareAsync("Sites.GetAll", materialized, () => _postgres.GetAllAsync());
        }

        return result;
    }

    public async Task<IEnumerable<Site>> GetByCustomerIdAsync(int customerId)
    {
        var result = await Primary.GetByCustomerIdAsync(customerId);

        if (_resolver.ShadowRead is not null)
        {
            var materialized = result as ICollection<Site> ?? result.ToList();
            result = materialized;
            await ShadowCompareAsync(
                "Sites.GetByCustomerId",
                materialized,
                () => _postgres.GetByCustomerIdAsync(customerId));
        }

        return result;
    }

    public async Task<Site?> GetByIdAsync(int siteId)
    {
        var result = await Primary.GetByIdAsync(siteId);

        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("Sites.GetById", result, () => _postgres.GetByIdAsync(siteId));
        }

        return result;
    }

    public async Task<int> CreateAsync(Site site)
    {
        var result = await Primary.CreateAsync(site);

        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Sites.Create", () => _postgres.CreateAsync(site));
        }

        return result;
    }

    public async Task<bool> UpdateAsync(Site site)
    {
        // Primary failures (including ownership violations) propagate unchanged.
        var result = await Primary.UpdateAsync(site);

        if (_resolver.DualWrite is not null)
        {
            // Best-effort secondary write: Postgres ownership guard still runs, and a mismatch is
            // logged clearly before DualWriteAsync records the failure without failing the primary.
            await DualWriteAsync("Sites.Update", async () =>
            {
                try
                {
                    await _postgres.UpdateAsync(site);
                }
                catch (UserValidationException ex) when (
                    ex.Message.Contains(
                        "Reassigning a site to another customer is not allowed",
                        StringComparison.Ordinal))
                {
                    _logger.LogWarning(
                        ex,
                        "Secondary PostgreSQL dual-write ownership mismatch for Sites.Update SiteId={SiteId} CustomerId={CustomerId}.",
                        site.SiteId,
                        site.CustomerId);
                    throw;
                }
            });
        }

        return result;
    }

    public async Task<bool> DeactivateAsync(int siteId)
    {
        var result = await Primary.DeactivateAsync(siteId);

        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Sites.Deactivate", () => _postgres.DeactivateAsync(siteId));
        }

        return result;
    }

    private async Task ShadowCompareAsync<T>(string operation, T primaryResult, Func<Task<T>> shadowRead)
    {
        try
        {
            _driftRecorder.RecordShadowCompared(operation);
            var shadowResult = await shadowRead();
            var comparison = _parityComparer.Compare(primaryResult, shadowResult);
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

using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Interfaces;
using ManageR2.Infrastructure.Repositories;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Features.Quotes.Repositories;

// Dual-run router for the Quotes domain (Wave 3). Reads are shadow-compared; writes are dual-written
// best-effort. With default flags the router delegates purely to the SQL Server repository.
public sealed class QuoteRepositoryRouter : IQuoteRepository
{
    private readonly QuoteRepository _sqlServer;
    private readonly PostgresQuoteRepository _postgres;
    private readonly IProviderConnectionResolver _resolver;
    private readonly IProviderDriftRecorder _driftRecorder;
    private readonly IPayloadParityComparer _parityComparer;
    private readonly ILogger<QuoteRepositoryRouter> _logger;

    public QuoteRepositoryRouter(
        QuoteRepository sqlServer,
        PostgresQuoteRepository postgres,
        IProviderConnectionResolver resolver,
        IProviderDriftRecorder driftRecorder,
        IPayloadParityComparer parityComparer,
        ILogger<QuoteRepositoryRouter> logger)
    {
        _sqlServer = sqlServer;
        _postgres = postgres;
        _resolver = resolver;
        _driftRecorder = driftRecorder;
        _parityComparer = parityComparer;
        _logger = logger;
    }

    private IQuoteRepository Primary =>
        _resolver.Options.Primary == DatabaseProvider.Postgres ? _postgres : _sqlServer;

    public async Task<IEnumerable<Quote>> GetListAsync(
        string? search, int? customerId, int? projectId, string? status,
        DateOnly? fromDate, DateOnly? toDate, bool includeInactive)
    {
        var result = await Primary.GetListAsync(search, customerId, projectId, status, fromDate, toDate, includeInactive);
        if (_resolver.ShadowRead is not null)
        {
            var materialized = result as ICollection<Quote> ?? result.ToList();
            result = materialized;
            await ShadowCompareAsync("Quotes.GetList", materialized,
                () => _postgres.GetListAsync(search, customerId, projectId, status, fromDate, toDate, includeInactive));
        }

        return result;
    }

    public async Task<Quote?> GetByIdAsync(int quoteId)
    {
        var result = await Primary.GetByIdAsync(quoteId);
        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("Quotes.GetById", result, () => _postgres.GetByIdAsync(quoteId));
        }

        return result;
    }

    public async Task<int> CreateAsync(Quote quote)
    {
        var result = await Primary.CreateAsync(quote);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Quotes.Create", () => _postgres.CreateAsync(quote));
        }

        return result;
    }

    public async Task<bool> UpdateAsync(Quote quote)
    {
        var result = await Primary.UpdateAsync(quote);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Quotes.Update", () => _postgres.UpdateAsync(quote));
        }

        return result;
    }

    public async Task<bool> DeactivateAsync(int quoteId, int? updatedByUserId)
    {
        var result = await Primary.DeactivateAsync(quoteId, updatedByUserId);
        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Quotes.Deactivate", () => _postgres.DeactivateAsync(quoteId, updatedByUserId));
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

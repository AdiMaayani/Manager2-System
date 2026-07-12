using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Interfaces;
using ManageR2.Infrastructure.Repositories;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Features.Contacts.Repositories;

// Dual-run router for the contacts domain (Wave 2). See CompanySettingsRepositoryRouter for the pattern.
public sealed class ContactRepositoryRouter : IContactRepository
{
    private readonly ContactRepository _sqlServer;
    private readonly PostgresContactRepository _postgres;
    private readonly IProviderConnectionResolver _resolver;
    private readonly IProviderDriftRecorder _driftRecorder;
    private readonly IPayloadParityComparer _parityComparer;
    private readonly ILogger<ContactRepositoryRouter> _logger;

    public ContactRepositoryRouter(
        ContactRepository sqlServer,
        PostgresContactRepository postgres,
        IProviderConnectionResolver resolver,
        IProviderDriftRecorder driftRecorder,
        IPayloadParityComparer parityComparer,
        ILogger<ContactRepositoryRouter> logger)
    {
        _sqlServer = sqlServer;
        _postgres = postgres;
        _resolver = resolver;
        _driftRecorder = driftRecorder;
        _parityComparer = parityComparer;
        _logger = logger;
    }

    private IContactRepository Primary =>
        _resolver.Options.Primary == DatabaseProvider.Postgres ? _postgres : _sqlServer;

    public async Task<IEnumerable<Contact>> GetAllAsync()
    {
        var result = await Primary.GetAllAsync();

        if (_resolver.ShadowRead is not null)
        {
            var materialized = result as ICollection<Contact> ?? result.ToList();
            result = materialized;
            await ShadowCompareAsync("Contacts.GetAll", materialized, () => _postgres.GetAllAsync());
        }

        return result;
    }

    public async Task<Contact?> GetByIdAsync(int contactId)
    {
        var result = await Primary.GetByIdAsync(contactId);

        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("Contacts.GetById", result, () => _postgres.GetByIdAsync(contactId));
        }

        return result;
    }

    public async Task<IEnumerable<Contact>> GetByCustomerIdAsync(int customerId)
    {
        var result = await Primary.GetByCustomerIdAsync(customerId);

        if (_resolver.ShadowRead is not null)
        {
            var materialized = result as ICollection<Contact> ?? result.ToList();
            result = materialized;
            await ShadowCompareAsync("Contacts.GetByCustomerId", materialized, () => _postgres.GetByCustomerIdAsync(customerId));
        }

        return result;
    }

    public async Task<int> CreateAsync(Contact contact)
    {
        var result = await Primary.CreateAsync(contact);

        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Contacts.Create", () => _postgres.CreateAsync(contact));
        }

        return result;
    }

    public async Task<bool> UpdateAsync(Contact contact)
    {
        var result = await Primary.UpdateAsync(contact);

        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Contacts.Update", () => _postgres.UpdateAsync(contact));
        }

        return result;
    }

    public async Task<bool> DeactivateAsync(int contactId, int updatedByUserId)
    {
        var result = await Primary.DeactivateAsync(contactId, updatedByUserId);

        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Contacts.Deactivate", () => _postgres.DeactivateAsync(contactId, updatedByUserId));
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

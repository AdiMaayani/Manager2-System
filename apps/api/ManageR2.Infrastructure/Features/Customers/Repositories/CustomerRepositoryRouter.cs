using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Interfaces;
using ManageR2.Infrastructure.Repositories;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Features.Customers.Repositories;

// Dual-run router for the customers domain (Wave 2), following the CompanySettings reference pattern:
//   - reads are served by the primary provider; when SQL Server is primary and shadow reads are on,
//     the Postgres read is compared for drift (never affecting the response);
//   - writes go to the primary; when dual writes are on they are also applied to Postgres best-effort.
// With default options this delegates purely to the SQL Server repository.
public sealed class CustomerRepositoryRouter : ICustomerRepository
{
    private readonly CustomerRepository _sqlServer;
    private readonly PostgresCustomerRepository _postgres;
    private readonly IProviderConnectionResolver _resolver;
    private readonly IProviderDriftRecorder _driftRecorder;
    private readonly IPayloadParityComparer _parityComparer;
    private readonly ILogger<CustomerRepositoryRouter> _logger;

    public CustomerRepositoryRouter(
        CustomerRepository sqlServer,
        PostgresCustomerRepository postgres,
        IProviderConnectionResolver resolver,
        IProviderDriftRecorder driftRecorder,
        IPayloadParityComparer parityComparer,
        ILogger<CustomerRepositoryRouter> logger)
    {
        _sqlServer = sqlServer;
        _postgres = postgres;
        _resolver = resolver;
        _driftRecorder = driftRecorder;
        _parityComparer = parityComparer;
        _logger = logger;
    }

    private ICustomerRepository Primary =>
        _resolver.Options.Primary == DatabaseProvider.Postgres ? _postgres : _sqlServer;

    public async Task<IEnumerable<Customer>> GetAllAsync()
    {
        var result = await Primary.GetAllAsync();

        if (_resolver.ShadowRead is not null)
        {
            var materialized = result as ICollection<Customer> ?? result.ToList();
            result = materialized;
            await ShadowCompareAsync("Customers.GetAll", materialized, () => _postgres.GetAllAsync());
        }

        return result;
    }

    public async Task<Customer?> GetByIdAsync(int customerId)
    {
        var result = await Primary.GetByIdAsync(customerId);

        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("Customers.GetById", result, () => _postgres.GetByIdAsync(customerId));
        }

        return result;
    }

    public async Task<int> CreateAsync(Customer customer)
    {
        var result = await Primary.CreateAsync(customer);

        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Customers.Create", () => _postgres.CreateAsync(customer));
        }

        return result;
    }

    public async Task<bool> UpdateAsync(Customer customer)
    {
        var result = await Primary.UpdateAsync(customer);

        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Customers.Update", () => _postgres.UpdateAsync(customer));
        }

        return result;
    }

    public async Task<bool> DeactivateAsync(int customerId, int updatedByUserId)
    {
        var result = await Primary.DeactivateAsync(customerId, updatedByUserId);

        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Customers.Deactivate", () => _postgres.DeactivateAsync(customerId, updatedByUserId));
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

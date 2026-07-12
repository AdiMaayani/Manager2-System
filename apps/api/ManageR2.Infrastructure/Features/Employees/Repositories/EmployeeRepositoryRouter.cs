using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Repositories;
using Microsoft.Extensions.Logging;

namespace ManageR2.Infrastructure.Features.Employees.Repositories;

// Dual-run router for the employees domain (Wave 2). See CompanySettingsRepositoryRouter for the pattern.
public sealed class EmployeeRepositoryRouter : IEmployeeRepository
{
    private readonly EmployeeRepository _sqlServer;
    private readonly PostgresEmployeeRepository _postgres;
    private readonly IProviderConnectionResolver _resolver;
    private readonly IProviderDriftRecorder _driftRecorder;
    private readonly IPayloadParityComparer _parityComparer;
    private readonly ILogger<EmployeeRepositoryRouter> _logger;

    public EmployeeRepositoryRouter(
        EmployeeRepository sqlServer,
        PostgresEmployeeRepository postgres,
        IProviderConnectionResolver resolver,
        IProviderDriftRecorder driftRecorder,
        IPayloadParityComparer parityComparer,
        ILogger<EmployeeRepositoryRouter> logger)
    {
        _sqlServer = sqlServer;
        _postgres = postgres;
        _resolver = resolver;
        _driftRecorder = driftRecorder;
        _parityComparer = parityComparer;
        _logger = logger;
    }

    private IEmployeeRepository Primary =>
        _resolver.Options.Primary == DatabaseProvider.Postgres ? _postgres : _sqlServer;

    public async Task<List<Employee>> GetAllAsync()
    {
        var result = await Primary.GetAllAsync();

        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("Employees.GetAll", result, () => _postgres.GetAllAsync());
        }

        return result;
    }

    public async Task<Employee?> GetByIdAsync(int employeeId)
    {
        var result = await Primary.GetByIdAsync(employeeId);

        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("Employees.GetById", result, () => _postgres.GetByIdAsync(employeeId));
        }

        return result;
    }

    public async Task<int> CreateAsync(Employee employee)
    {
        var result = await Primary.CreateAsync(employee);

        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Employees.Create", () => _postgres.CreateAsync(employee));
        }

        return result;
    }

    public async Task<bool> UpdateAsync(Employee employee)
    {
        var result = await Primary.UpdateAsync(employee);

        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Employees.Update", () => _postgres.UpdateAsync(employee));
        }

        return result;
    }

    public async Task<bool> SetActiveStatusAsync(int employeeId, bool isActive)
    {
        var result = await Primary.SetActiveStatusAsync(employeeId, isActive);

        if (_resolver.DualWrite is not null)
        {
            await DualWriteAsync("Employees.SetActiveStatus", () => _postgres.SetActiveStatusAsync(employeeId, isActive));
        }

        return result;
    }

    public async Task<List<string>> GetDistinctPrimaryRolesAsync()
    {
        var result = await Primary.GetDistinctPrimaryRolesAsync();

        if (_resolver.ShadowRead is not null)
        {
            await ShadowCompareAsync("Employees.GetDistinctPrimaryRoles", result, () => _postgres.GetDistinctPrimaryRolesAsync());
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

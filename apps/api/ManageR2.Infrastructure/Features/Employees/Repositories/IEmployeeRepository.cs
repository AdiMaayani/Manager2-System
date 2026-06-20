using ManageR2.Domain.Entities;

namespace ManageR2.Infrastructure.Repositories;

// Employee persistence contract backed by stored procedures.
public interface IEmployeeRepository
{
    Task<List<Employee>> GetAllAsync();
    Task<Employee?> GetByIdAsync(int employeeId);
    Task<int> CreateAsync(Employee employee);
    Task<bool> UpdateAsync(Employee employee);
    Task<bool> SetActiveStatusAsync(int employeeId, bool isActive);
    Task<List<string>> GetDistinctPrimaryRolesAsync();
}

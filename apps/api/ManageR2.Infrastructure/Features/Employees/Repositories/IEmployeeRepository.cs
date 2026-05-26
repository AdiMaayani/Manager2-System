using ManageR2.Domain.Entities;

namespace ManageR2.Infrastructure.Repositories;

// Read-only employee queries for assignment validation (EmployeeRepository uses direct SQL).
public interface IEmployeeRepository
{
    Task<List<Employee>> GetAllAsync();
    Task<Employee?> GetByIdAsync(int employeeId);
}
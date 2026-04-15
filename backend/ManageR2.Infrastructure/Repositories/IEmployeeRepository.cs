using ManageR2.Domain.Entities;

namespace ManageR2.Infrastructure.Repositories;

public interface IEmployeeRepository
{
    Task<List<Employee>> GetAllAsync();
    Task<Employee?> GetByIdAsync(int employeeId);
}
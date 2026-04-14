using ManageR2.Domain.Entities;

namespace ManageR2.Infrastructure.Interfaces;

public interface ICustomerRepository
{
    Task<IEnumerable<Customer>> GetAllAsync();

    Task<Customer?> GetByIdAsync(int customerId);

    Task<int> CreateAsync(Customer customer);

    Task<bool> UpdateAsync(Customer customer);

    Task<bool> DeactivateAsync(int customerId, int updatedByUserId);
}

using ManageR2.Domain.Entities;

namespace ManageR2.Infrastructure.Interfaces;

// Implemented by ContactRepository; surfaces domain Contact aggregates to ContactsController.
public interface IContactRepository
{
    Task<IEnumerable<Contact>> GetAllAsync();

    Task<Contact?> GetByIdAsync(int contactId);

    Task<IEnumerable<Contact>> GetByCustomerIdAsync(int customerId);

    Task<int> CreateAsync(Contact contact);

    Task<bool> UpdateAsync(Contact contact);

    Task<bool> DeactivateAsync(int contactId, int updatedByUserId);
}

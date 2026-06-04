using ManageR2.Domain.Entities;

namespace ManageR2.Infrastructure.Interfaces;

// DI abstraction for QuotesController; implementation uses dbo.sp_Quotes_* only.
public interface IQuoteRepository
{
    Task<IEnumerable<Quote>> GetListAsync(
        string? search,
        int? customerId,
        int? projectId,
        string? status,
        DateOnly? fromDate,
        DateOnly? toDate,
        bool includeInactive);

    Task<Quote?> GetByIdAsync(int quoteId);

    Task<int> CreateAsync(Quote quote);

    Task<bool> UpdateAsync(Quote quote);

    Task<bool> DeactivateAsync(int quoteId, int? updatedByUserId);
}

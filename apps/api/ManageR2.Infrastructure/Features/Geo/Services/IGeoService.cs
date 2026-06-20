using ManageR2.Infrastructure.Features.Geo.Models;

namespace ManageR2.Infrastructure.Features.Geo.Services;

public interface IGeoService
{
	Task<List<AddressSuggestionModel>> AutocompleteAsync(string text);

	Task<ValidatedAddressModel> ValidateAddressAsync(string text);
}
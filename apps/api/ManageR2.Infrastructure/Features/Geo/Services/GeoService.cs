using ManageR2.Infrastructure.Features.Geo.Clients;
using ManageR2.Infrastructure.Features.Geo.Models;

namespace ManageR2.Infrastructure.Features.Geo.Services;

public class GeoService : IGeoService
{
	private readonly GeoapifyClient _geoapifyClient;

	public GeoService(GeoapifyClient geoapifyClient)
	{
		_geoapifyClient = geoapifyClient;
	}

	public Task<List<AddressSuggestionModel>> AutocompleteAsync(string text)
	{
		return _geoapifyClient.AutocompleteAsync(text);
	}

	public Task<ValidatedAddressModel> ValidateAddressAsync(string text)
	{
		return _geoapifyClient.ValidateAddressAsync(text);
	}
}
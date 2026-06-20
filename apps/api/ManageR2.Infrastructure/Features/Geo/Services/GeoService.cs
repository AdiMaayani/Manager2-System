using ManageR2.Domain.Features.Geo;
using ManageR2.Infrastructure.Features.Geo.Clients;
using ManageR2.Infrastructure.Features.Geo.Models;

namespace ManageR2.Infrastructure.Features.Geo.Services;

public interface IGeoService
{
    Task<List<AddressSuggestionModel>> AutocompleteAsync(string text, CancellationToken cancellationToken);

    Task<ValidatedAddressModel> ValidateAddressAsync(string text, CancellationToken cancellationToken);
}

public class GeoService : IGeoService
{
    private readonly GeoapifyClient _geoapifyClient;

    public GeoService(GeoapifyClient geoapifyClient)
    {
        _geoapifyClient = geoapifyClient;
    }

    public Task<List<AddressSuggestionModel>> AutocompleteAsync(string text, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(text) || text.Trim().Length < AddressValidationConstants.MinAutocompleteLength)
        {
            return Task.FromResult(new List<AddressSuggestionModel>());
        }

        return _geoapifyClient.AutocompleteAsync(text, cancellationToken);
    }

    public Task<ValidatedAddressModel> ValidateAddressAsync(string text, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(text) || text.Trim().Length < AddressValidationConstants.MinAutocompleteLength)
        {
            return Task.FromResult(new ValidatedAddressModel
            {
                IsValid = false,
                ValidationScore = 0,
                ValidationMessage = "יש להזין לפחות 3 תווים לצורך אימות כתובת."
            });
        }

        return _geoapifyClient.ValidateAddressAsync(text, cancellationToken);
    }
}

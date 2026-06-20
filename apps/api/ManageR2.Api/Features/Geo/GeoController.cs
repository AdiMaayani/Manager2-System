using ManageR2.Api.Features.AddressProfiles;
using ManageR2.Api.Features.Geo.DTOs;
using ManageR2.Infrastructure.Features.Geo.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Features.Geo;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GeoController : ControllerBase
{
    private readonly IGeoService _geoService;

    public GeoController(IGeoService geoService)
    {
        _geoService = geoService;
    }

    [HttpGet("autocomplete")]
    public async Task<ActionResult<List<GeoAutocompleteSuggestionDto>>> Autocomplete(
        [FromQuery] string text,
        CancellationToken cancellationToken)
    {
        var suggestions = await _geoService.AutocompleteAsync(text, cancellationToken);
        return Ok(suggestions.Select(AddressProfileMapping.ToSuggestionDto).ToList());
    }

    [HttpGet("validate")]
    public async Task<ActionResult<ValidatedAddressResponseDto>> Validate(
        [FromQuery] string text,
        CancellationToken cancellationToken)
    {
        var result = await _geoService.ValidateAddressAsync(text, cancellationToken);
        return Ok(AddressProfileMapping.ToValidationDto(result));
    }
}

using Microsoft.AspNetCore.Mvc;
using ManageR2.Infrastructure.Features.Geo.Services;

namespace ManageR2.Api.Features.Geo;

[ApiController]
[Route("api/[controller]")]
public class GeoController : ControllerBase
{
    private readonly IGeoService _geoService;

    public GeoController(IGeoService geoService)
    {
        _geoService = geoService;
    }

    [HttpGet("autocomplete")]
    public async Task<IActionResult> Autocomplete(string text)
    {
        var result = await _geoService.AutocompleteAsync(text);
        return Ok(result);
    }

    [HttpGet("validate")]
    public async Task<IActionResult> Validate(string text)
    {
        var result = await _geoService.ValidateAddressAsync(text);
        return Ok(result);
    }
}
using ManageR2.Api.Authorization;
using ManageR2.Api.Features.AddressProfiles;
using ManageR2.Api.Features.AddressProfiles.DTOs;
using ManageR2.Infrastructure.Features.AddressProfiles.Repositories;
using ManageR2.Infrastructure.Features.AddressProfiles.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Features.SiteAddresses;

[ApiController]
[Route("api/sites")]
[Authorize(Policy = Policies.CanViewCustomers)]
public class SiteAddressProfilesController : ControllerBase
{
    private readonly IAddressProfileService _addressProfileService;

    public SiteAddressProfilesController(IAddressProfileService addressProfileService)
    {
        _addressProfileService = addressProfileService;
    }

    [HttpGet("{siteId:int}/address-profile")]
    public async Task<ActionResult<AddressProfileDto>> GetBySiteId(int siteId)
    {
        var profile = await _addressProfileService.GetSiteAddressProfileAsync(siteId);
        if (profile is null)
        {
            return NotFound(new { message = "Site address profile was not found." });
        }

        return Ok(AddressProfileMapping.ToDto(profile));
    }

    [Authorize(Policy = Policies.CanManageProjects)]
    [HttpPost("with-address-profile")]
    public async Task<ActionResult<SiteWithAddressProfileResponseDto>> CreateWithAddressProfile(
        [FromBody] SaveSiteWithAddressProfileRequestDto request)
    {
        var saved = await _addressProfileService.SaveSiteWithAddressProfileAsync(MapRequest(request, null));
        return CreatedAtAction(
            nameof(GetBySiteId),
            new { siteId = saved.SiteId },
            AddressProfileMapping.ToSiteResponse(saved));
    }

    [Authorize(Policy = Policies.CanManageProjects)]
    [HttpPut("{siteId:int}/with-address-profile")]
    public async Task<ActionResult<SiteWithAddressProfileResponseDto>> UpdateWithAddressProfile(
        int siteId,
        [FromBody] SaveSiteWithAddressProfileRequestDto request)
    {
        var saved = await _addressProfileService.SaveSiteWithAddressProfileAsync(MapRequest(request, siteId));
        return Ok(AddressProfileMapping.ToSiteResponse(saved));
    }

    private static SiteWithAddressProfileRecord MapRequest(
        SaveSiteWithAddressProfileRequestDto request,
        int? siteId)
    {
        return new SiteWithAddressProfileRecord
        {
            SiteId = siteId ?? request.SiteId,
            CustomerId = request.CustomerId,
            SiteName = request.SiteName,
            IsPrimary = request.IsPrimary,
            Notes = request.Notes,
            Profile = request.AddressProfile is null
                ? null
                : AddressProfileMapping.ToEntity(request.AddressProfile)
        };
    }
}

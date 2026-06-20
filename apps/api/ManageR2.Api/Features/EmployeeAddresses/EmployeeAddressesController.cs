using ManageR2.Api.Authorization;
using ManageR2.Api.Features.AddressProfiles;
using ManageR2.Api.Features.AddressProfiles.DTOs;
using ManageR2.Infrastructure.Features.AddressProfiles.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Features.EmployeeAddresses;

[ApiController]
[Route("api/employees/{employeeId:int}/base-address")]
public class EmployeeAddressesController : ControllerBase
{
    private readonly IAddressProfileService _addressProfileService;

    public EmployeeAddressesController(IAddressProfileService addressProfileService)
    {
        _addressProfileService = addressProfileService;
    }

    [Authorize(Policy = Policies.CanViewEmployees)]
    [HttpGet]
    public async Task<ActionResult<AddressProfileDto>> GetByEmployeeId(int employeeId)
    {
        var profile = await _addressProfileService.GetEmployeeBaseAddressAsync(employeeId);
        if (profile is null)
        {
            return NotFound(new { message = "Employee base address profile was not found." });
        }

        return Ok(AddressProfileMapping.ToDto(profile));
    }

    [Authorize(Roles = Roles.Admin)]
    [HttpPut]
    public async Task<ActionResult<AddressProfileDto>> Upsert(
        int employeeId,
        [FromBody] UpsertAddressProfileRequestDto request)
    {
        var saved = await _addressProfileService.UpsertEmployeeBaseAddressAsync(
            employeeId,
            AddressProfileMapping.ToEntity(request));

        return Ok(AddressProfileMapping.ToDto(saved));
    }
}

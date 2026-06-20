using ManageR2.Api.Authorization;
using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Controllers;

// System settings endpoints; currently limited to the persisted company profile.
// DTO validation runs via the global ValidationActionFilter; faults are shaped by GlobalExceptionHandler.
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SettingsController : ControllerBase
{
    private readonly ICompanySettingsRepository _companySettingsRepository;

    public SettingsController(ICompanySettingsRepository companySettingsRepository)
    {
        _companySettingsRepository = companySettingsRepository;
    }

    [Authorize(Policy = Policies.CanViewSettings)]
    [HttpGet("company")]
    public async Task<IActionResult> GetCompanySettings()
    {
        var companySettings = await _companySettingsRepository.GetCompanySettingsAsync();
        if (companySettings == null)
        {
            return NotFound(new { message = "Company settings were not initialized. Run the database migration script." });
        }

        return Ok(ToResponseDto(companySettings));
    }

    [Authorize(Policy = Policies.CanManageSettings)]
    [HttpPut("company")]
    public async Task<IActionResult> UpdateCompanySettings([FromBody] UpdateCompanySettingsRequestDto dto)
    {
        var currentUserIdClaim = User.FindFirst("userId")?.Value;
        if (string.IsNullOrWhiteSpace(currentUserIdClaim) || !int.TryParse(currentUserIdClaim, out var currentUserId))
        {
            return Unauthorized(new { message = "Invalid user token." });
        }

        var companySettings = new CompanySettings
        {
            CompanyName = dto.CompanyName.Trim(),
            LegalName = CleanOptionalValue(dto.LegalName),
            RegistrationNumber = CleanOptionalValue(dto.RegistrationNumber),
            Email = CleanOptionalValue(dto.Email),
            Phone = CleanOptionalValue(dto.Phone),
            Address = CleanOptionalValue(dto.Address),
            Website = CleanOptionalValue(dto.Website),
            UpdatedByUserId = currentUserId
        };

        var savedCompanySettings = await _companySettingsRepository.UpsertCompanySettingsAsync(companySettings);
        return Ok(ToResponseDto(savedCompanySettings));
    }

    private static CompanySettingsResponseDto ToResponseDto(CompanySettings companySettings)
    {
        return new CompanySettingsResponseDto
        {
            CompanyName = companySettings.CompanyName,
            LegalName = companySettings.LegalName,
            RegistrationNumber = companySettings.RegistrationNumber,
            Email = companySettings.Email,
            Phone = companySettings.Phone,
            Address = companySettings.Address,
            Website = companySettings.Website,
            UpdatedAt = companySettings.UpdatedAt
        };
    }

    private static string? CleanOptionalValue(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}

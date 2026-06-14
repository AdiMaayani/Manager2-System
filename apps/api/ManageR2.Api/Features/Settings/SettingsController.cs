using System.Net.Mail;
using ManageR2.Api.Authorization;
using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Controllers;

// System settings endpoints; currently limited to the persisted company profile.
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
        try
        {
            var companySettings = await _companySettingsRepository.GetCompanySettingsAsync();
            if (companySettings == null)
            {
                return NotFound(new { message = "Company settings were not initialized. Run the database migration script." });
            }

            return Ok(ToResponseDto(companySettings));
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageSettings)]
    [HttpPut("company")]
    public async Task<IActionResult> UpdateCompanySettings([FromBody] UpdateCompanySettingsRequestDto dto)
    {
        var validationError = ValidateCompanySettings(dto);
        if (validationError != null)
        {
            return BadRequest(new { message = validationError });
        }

        var currentUserIdClaim = User.FindFirst("userId")?.Value;
        if (string.IsNullOrWhiteSpace(currentUserIdClaim) || !int.TryParse(currentUserIdClaim, out var currentUserId))
        {
            return Unauthorized(new { message = "Invalid user token." });
        }

        try
        {
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
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
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

    private static string? ValidateCompanySettings(UpdateCompanySettingsRequestDto? dto)
    {
        if (dto == null)
        {
            return "Company settings are required.";
        }

        if (string.IsNullOrWhiteSpace(dto.CompanyName))
        {
            return "CompanyName is required.";
        }

        if (!string.IsNullOrWhiteSpace(dto.Email) && !IsValidEmail(dto.Email))
        {
            return "Email is invalid.";
        }

        if (!string.IsNullOrWhiteSpace(dto.Website) && !IsValidWebsite(dto.Website))
        {
            return "Website is invalid.";
        }

        return null;
    }

    private static string? CleanOptionalValue(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static bool IsValidEmail(string email)
    {
        try
        {
            var address = new MailAddress(email.Trim());
            return string.Equals(address.Address, email.Trim(), StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    private static bool IsValidWebsite(string website)
    {
        return Uri.TryCreate(website.Trim(), UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
    }
}

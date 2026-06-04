using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Controllers;

// Physical customer sites/locations; links to CustomerId; CRUD via ISiteRepository under JWT auth.
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SitesController : ControllerBase
{
    // Site persistence and validation are centralized in the repository layer (uses DBServices internally).
    private readonly ISiteRepository _repository;

    public SitesController(ISiteRepository repository)
    {
        _repository = repository;
    }

    // List all sites for dropdowns and site management pages.
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var sites = await _repository.GetAllAsync();

            var result = sites.Select(site => new SiteDto
            {
                SiteId = site.SiteId,
                CustomerId = site.CustomerId,
                SiteName = site.SiteName,
                AddressLine = site.AddressLine,
                City = site.City,
                IsPrimary = site.IsPrimary,
                Notes = site.Notes,
                CreatedAt = site.CreatedAt,
                UpdatedAt = site.UpdatedAt
            });

            return Ok(result);
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // Single site record for detail/edit views.
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        try
        {
            var site = await _repository.GetByIdAsync(id);

            if (site == null)
            {
                return NotFound(new { message = $"Site with id {id} was not found." });
            }

            return Ok(new SiteDto
            {
                SiteId = site.SiteId,
                CustomerId = site.CustomerId,
                SiteName = site.SiteName,
                AddressLine = site.AddressLine,
                City = site.City,
                IsPrimary = site.IsPrimary,
                Notes = site.Notes,
                CreatedAt = site.CreatedAt,
                UpdatedAt = site.UpdatedAt
            });
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // Create site under a valid customer; repository assigns timestamps and enforces referential rules.
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SiteDto dto)
    {
        if (dto.CustomerId <= 0)
        {
            return BadRequest(new { message = "CustomerId is required." });
        }

        if (string.IsNullOrWhiteSpace(dto.SiteName))
        {
            return BadRequest(new { message = "SiteName is required." });
        }

        try
        {
            var site = new Site
            {
                CustomerId = dto.CustomerId,
                SiteName = dto.SiteName,
                AddressLine = dto.AddressLine,
                City = dto.City,
                IsPrimary = dto.IsPrimary,
                Notes = dto.Notes
            };

            var id = await _repository.CreateAsync(site);

            var created = await _repository.GetByIdAsync(id);
            if (created == null)
            {
                return BadRequest(new { message = "Site was created but could not be reloaded." });
            }

            return CreatedAtAction(nameof(GetById), new { id }, new SiteDto
            {
                SiteId = created.SiteId,
                CustomerId = created.CustomerId,
                SiteName = created.SiteName,
                AddressLine = created.AddressLine,
                City = created.City,
                IsPrimary = created.IsPrimary,
                Notes = created.Notes,
                CreatedAt = created.CreatedAt,
                UpdatedAt = created.UpdatedAt
            });
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // Update site fields; full replace pattern on entity loaded from repository before save.
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] SiteDto dto)
    {
        if (dto.CustomerId <= 0)
        {
            return BadRequest(new { message = "CustomerId is required." });
        }

        if (string.IsNullOrWhiteSpace(dto.SiteName))
        {
            return BadRequest(new { message = "SiteName is required." });
        }

        try
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { message = $"Site with id {id} was not found." });
            }

            existing.CustomerId = dto.CustomerId;
            existing.SiteName = dto.SiteName;
            existing.AddressLine = dto.AddressLine;
            existing.City = dto.City;
            existing.IsPrimary = dto.IsPrimary;
            existing.Notes = dto.Notes;

            var success = await _repository.UpdateAsync(existing);

            if (!success)
            {
                return BadRequest(new { message = "Failed to update site." });
            }

            var updated = await _repository.GetByIdAsync(id);
            if (updated == null)
            {
                return NotFound(new { message = $"Site with id {id} was not found after update." });
            }

            return Ok(new SiteDto
            {
                SiteId = updated.SiteId,
                CustomerId = updated.CustomerId,
                SiteName = updated.SiteName,
                AddressLine = updated.AddressLine,
                City = updated.City,
                IsPrimary = updated.IsPrimary,
                Notes = updated.Notes,
                CreatedAt = updated.CreatedAt,
                UpdatedAt = updated.UpdatedAt
            });
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Deactivate(int id)
    {
        try
        {
            var success = await _repository.DeactivateAsync(id);

            if (!success)
            {
                return NotFound(new { message = $"Site with id {id} was not found." });
            }

            return NoContent();
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
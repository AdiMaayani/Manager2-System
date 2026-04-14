using System.Security.Claims;
using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ContactsController : ControllerBase
{
    private readonly IContactRepository _repository;

    public ContactsController(IContactRepository repository)
    {
        _repository = repository;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var contacts = await _repository.GetAllAsync();

            return Ok(contacts.Select(c => new ContactDto
            {
                ContactId = c.ContactId,
                FullName = c.FullName,
                JobTitle = c.JobTitle,
                ContactCategory = c.ContactCategory,
                CustomerId = c.CustomerId,
                CompanyName = c.CompanyName,
                Phone = c.Phone,
                SecondaryPhone = c.SecondaryPhone,
                Email = c.Email,
                PreferredChannel = c.PreferredChannel,
                City = c.City,
                Address = c.Address,
                Status = c.Status,
                Notes = c.Notes,
                IsActive = c.IsActive
            }));
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        try
        {
            var contact = await _repository.GetByIdAsync(id);

            if (contact == null)
            {
                return NotFound(new { message = $"Contact with id {id} was not found." });
            }

            return Ok(new ContactDto
            {
                ContactId = contact.ContactId,
                FullName = contact.FullName,
                JobTitle = contact.JobTitle,
                ContactCategory = contact.ContactCategory,
                CustomerId = contact.CustomerId,
                CompanyName = contact.CompanyName,
                Phone = contact.Phone,
                SecondaryPhone = contact.SecondaryPhone,
                Email = contact.Email,
                PreferredChannel = contact.PreferredChannel,
                City = contact.City,
                Address = contact.Address,
                Status = contact.Status,
                Notes = contact.Notes,
                IsActive = contact.IsActive
            });
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ContactDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.FullName))
        {
            return BadRequest(new { message = "FullName is required." });
        }

        if (string.IsNullOrWhiteSpace(dto.ContactCategory))
        {
            return BadRequest(new { message = "ContactCategory is required." });
        }

        if (string.IsNullOrWhiteSpace(dto.Phone) && string.IsNullOrWhiteSpace(dto.Email))
        {
            return BadRequest(new { message = "Phone or Email is required." });
        }

        var currentUserIdClaim = User.FindFirst("userId")?.Value;
        if (string.IsNullOrWhiteSpace(currentUserIdClaim) || !int.TryParse(currentUserIdClaim, out var currentUserId))
        {
            return Unauthorized(new { message = "Invalid user token." });
        }

        try
        {
            var contact = new Contact
            {
                FullName = dto.FullName,
                JobTitle = dto.JobTitle,
                ContactCategory = dto.ContactCategory,
                CustomerId = dto.CustomerId,
                CompanyName = dto.CompanyName,
                Phone = dto.Phone,
                SecondaryPhone = dto.SecondaryPhone,
                Email = dto.Email,
                PreferredChannel = dto.PreferredChannel,
                City = dto.City,
                Address = dto.Address,
                Status = dto.Status,
                Notes = dto.Notes,
                IsActive = dto.IsActive,
                CreatedByUserId = currentUserId
            };

            var id = await _repository.CreateAsync(contact);
            var created = await _repository.GetByIdAsync(id);

            if (created == null)
            {
                return BadRequest(new { message = "Contact was created but could not be reloaded." });
            }

            return CreatedAtAction(nameof(GetById), new { id }, new ContactDto
            {
                ContactId = created.ContactId,
                FullName = created.FullName,
                JobTitle = created.JobTitle,
                ContactCategory = created.ContactCategory,
                CustomerId = created.CustomerId,
                CompanyName = created.CompanyName,
                Phone = created.Phone,
                SecondaryPhone = created.SecondaryPhone,
                Email = created.Email,
                PreferredChannel = created.PreferredChannel,
                City = created.City,
                Address = created.Address,
                Status = created.Status,
                Notes = created.Notes,
                IsActive = created.IsActive
            });
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] ContactDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.FullName))
        {
            return BadRequest(new { message = "FullName is required." });
        }

        if (string.IsNullOrWhiteSpace(dto.ContactCategory))
        {
            return BadRequest(new { message = "ContactCategory is required." });
        }

        if (string.IsNullOrWhiteSpace(dto.Phone) && string.IsNullOrWhiteSpace(dto.Email))
        {
            return BadRequest(new { message = "Phone or Email is required." });
        }

        var currentUserIdClaim = User.FindFirst("userId")?.Value;
        if (string.IsNullOrWhiteSpace(currentUserIdClaim) || !int.TryParse(currentUserIdClaim, out var currentUserId))
        {
            return Unauthorized(new { message = "Invalid user token." });
        }

        try
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { message = $"Contact with id {id} was not found." });
            }

            existing.FullName = dto.FullName;
            existing.JobTitle = dto.JobTitle;
            existing.ContactCategory = dto.ContactCategory;
            existing.CustomerId = dto.CustomerId;
            existing.CompanyName = dto.CompanyName;
            existing.Phone = dto.Phone;
            existing.SecondaryPhone = dto.SecondaryPhone;
            existing.Email = dto.Email;
            existing.PreferredChannel = dto.PreferredChannel;
            existing.City = dto.City;
            existing.Address = dto.Address;
            existing.Status = dto.Status;
            existing.Notes = dto.Notes;
            existing.IsActive = dto.IsActive;
            existing.UpdatedByUserId = currentUserId;

            var success = await _repository.UpdateAsync(existing);

            if (!success)
            {
                return BadRequest(new { message = "Failed to update contact." });
            }

            var updated = await _repository.GetByIdAsync(id);
            if (updated == null)
            {
                return NotFound(new { message = $"Contact with id {id} was not found after update." });
            }

            return Ok(new ContactDto
            {
                ContactId = updated.ContactId,
                FullName = updated.FullName,
                JobTitle = updated.JobTitle,
                ContactCategory = updated.ContactCategory,
                CustomerId = updated.CustomerId,
                CompanyName = updated.CompanyName,
                Phone = updated.Phone,
                SecondaryPhone = updated.SecondaryPhone,
                Email = updated.Email,
                PreferredChannel = updated.PreferredChannel,
                City = updated.City,
                Address = updated.Address,
                Status = updated.Status,
                Notes = updated.Notes,
                IsActive = updated.IsActive
            });
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var currentUserIdClaim = User.FindFirst("userId")?.Value;
        if (string.IsNullOrWhiteSpace(currentUserIdClaim) || !int.TryParse(currentUserIdClaim, out var currentUserId))
        {
            return Unauthorized(new { message = "Invalid user token." });
        }

        try
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { message = $"Contact with id {id} was not found." });
            }

            var success = await _repository.DeactivateAsync(id, currentUserId);

            if (!success)
            {
                return BadRequest(new { message = "Failed to deactivate contact." });
            }

            return Ok(new { message = "Contact deactivated successfully." });
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
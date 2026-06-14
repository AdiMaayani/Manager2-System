using System.Security.Claims;
using ManageR2.Api.Authorization;
using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Controllers;

// Customer master data: CRUD for organizations served by the system; backed by ICustomerRepository.
[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = Policies.CanViewCustomers)]
public class CustomersController : ControllerBase
{
    // Data access isolated in repository; controller enforces HTTP validation and DTO mapping.
    private readonly ICustomerRepository _repository;

    public CustomersController(ICustomerRepository repository)
    {
        _repository = repository;
    }

    // List customers for CRM-style screens.
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var customers = await _repository.GetAllAsync();

            var result = customers.Select(c => new CustomerDto
            {
                CustomerId = c.CustomerId,
                CustomerName = c.CustomerName,
                CustomerType = c.CustomerType,
                PrimaryPhone = c.PrimaryPhone,
                PrimaryEmail = c.PrimaryEmail,
                City = c.City,
                Region = c.Region,
                Address = c.Address,
                Status = c.Status,
                Notes = c.Notes,
                IsActive = c.IsActive
            });

            return Ok(result);
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // Customer detail for edit forms and linked entities (sites, contacts).
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        try
        {
            var customer = await _repository.GetByIdAsync(id);

            if (customer == null)
            {
                return NotFound(new { message = $"Customer with id {id} was not found." });
            }

            return Ok(new CustomerDto
            {
                CustomerId = customer.CustomerId,
                CustomerName = customer.CustomerName,
                CustomerType = customer.CustomerType,
                PrimaryPhone = customer.PrimaryPhone,
                PrimaryEmail = customer.PrimaryEmail,
                City = customer.City,
                Region = customer.Region,
                Address = customer.Address,
                Status = customer.Status,
                Notes = customer.Notes,
                IsActive = customer.IsActive
            });
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // Create customer with audit user from JWT; repository enforces business rules (throws UserValidationException).
    [Authorize(Policy = Policies.CanManageCustomers)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CustomerDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.CustomerName))
        {
            return BadRequest(new { message = "CustomerName is required." });
        }

        if (string.IsNullOrWhiteSpace(dto.CustomerType))
        {
            return BadRequest(new { message = "CustomerType is required." });
        }

        var currentUserIdClaim = User.FindFirst("userId")?.Value;
        if (string.IsNullOrWhiteSpace(currentUserIdClaim) || !int.TryParse(currentUserIdClaim, out var currentUserId))
        {
            return Unauthorized(new { message = "Invalid user token." });
        }

        try
        {
            var customer = new Customer
            {
                CustomerName = dto.CustomerName,
                CustomerType = dto.CustomerType,
                PrimaryPhone = dto.PrimaryPhone,
                PrimaryEmail = dto.PrimaryEmail,
                City = dto.City,
                Region = dto.Region,
                Address = dto.Address,
                Status = dto.Status,
                Notes = dto.Notes,
                IsActive = dto.IsActive,
                CreatedByUserId = currentUserId
            };

            var id = await _repository.CreateAsync(customer);

            var created = await _repository.GetByIdAsync(id);
            if (created == null)
            {
                return BadRequest(new { message = "Customer was created but could not be reloaded." });
            }

            return CreatedAtAction(nameof(GetById), new { id }, new CustomerDto
            {
                CustomerId = created.CustomerId,
                CustomerName = created.CustomerName,
                CustomerType = created.CustomerType,
                PrimaryPhone = created.PrimaryPhone,
                PrimaryEmail = created.PrimaryEmail,
                City = created.City,
                Region = created.Region,
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

    // Update existing customer row and refresh DTO from database after successful save.
    [Authorize(Policy = Policies.CanManageCustomers)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] CustomerDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.CustomerName))
        {
            return BadRequest(new { message = "CustomerName is required." });
        }

        if (string.IsNullOrWhiteSpace(dto.CustomerType))
        {
            return BadRequest(new { message = "CustomerType is required." });
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
                return NotFound(new { message = $"Customer with id {id} was not found." });
            }

            existing.CustomerName = dto.CustomerName;
            existing.CustomerType = dto.CustomerType;
            existing.PrimaryPhone = dto.PrimaryPhone;
            existing.PrimaryEmail = dto.PrimaryEmail;
            existing.City = dto.City;
            existing.Region = dto.Region;
            existing.Address = dto.Address;
            existing.Status = dto.Status;
            existing.Notes = dto.Notes;
            existing.IsActive = dto.IsActive;
            existing.UpdatedByUserId = currentUserId;

            var success = await _repository.UpdateAsync(existing);

            if (!success)
            {
                return BadRequest(new { message = "Failed to update customer." });
            }

            var updated = await _repository.GetByIdAsync(id);
            if (updated == null)
            {
                return NotFound(new { message = $"Customer with id {id} was not found after update." });
            }

            return Ok(new CustomerDto
            {
                CustomerId = updated.CustomerId,
                CustomerName = updated.CustomerName,
                CustomerType = updated.CustomerType,
                PrimaryPhone = updated.PrimaryPhone,
                PrimaryEmail = updated.PrimaryEmail,
                City = updated.City,
                Region = updated.Region,
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

    // Deactivate customer (logical delete) while recording which user performed the change.
    [Authorize(Policy = Policies.CanManageCustomers)]
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
                return NotFound(new { message = $"Customer with id {id} was not found." });
            }

            var success = await _repository.DeactivateAsync(id, currentUserId);

            if (!success)
            {
                return BadRequest(new { message = "Failed to deactivate customer." });
            }

            return Ok(new { message = "Customer deactivated successfully." });
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
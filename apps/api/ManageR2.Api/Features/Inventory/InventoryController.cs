using ManageR2.Api.Authorization;
using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Controllers;

// Inventory MVP: company-wide stock catalog CRUD backed by stored procedures.
[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = Policies.CanViewInventory)]
public class InventoryController : ControllerBase
{
    private readonly IInventoryItemRepository _repository;

    public InventoryController(IInventoryItemRepository repository)
    {
        _repository = repository;
    }

    [HttpGet]
    public async Task<IActionResult> GetList(
        [FromQuery] string? search,
        [FromQuery] string? category,
        [FromQuery] string? status = "active",
        [FromQuery] bool lowStockOnly = false)
    {
        try
        {
            var inventoryItems = await _repository.GetListAsync(search, category, status, lowStockOnly);

            return Ok(inventoryItems.Select(MapToDto));
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
            var inventoryItem = await _repository.GetByIdAsync(id);

            if (inventoryItem == null)
            {
                return NotFound(new { message = $"Inventory item with id {id} was not found." });
            }

            return Ok(MapToDto(inventoryItem));
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageInventory)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] InventoryItemDto dto)
    {
        var validationError = ValidateDto(dto);
        if (validationError != null)
        {
            return BadRequest(new { message = validationError });
        }

        try
        {
            var inventoryItem = MapToEntity(dto);
            var id = await _repository.CreateAsync(inventoryItem);

            var created = await _repository.GetByIdAsync(id);
            if (created == null)
            {
                return BadRequest(new { message = "Inventory item was created but could not be reloaded." });
            }

            return CreatedAtAction(nameof(GetById), new { id }, MapToDto(created));
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageInventory)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] InventoryItemDto dto)
    {
        var validationError = ValidateDto(dto);
        if (validationError != null)
        {
            return BadRequest(new { message = validationError });
        }

        try
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { message = $"Inventory item with id {id} was not found." });
            }

            var inventoryItem = MapToEntity(dto);
            inventoryItem.InventoryItemId = id;

            var success = await _repository.UpdateAsync(inventoryItem);

            if (!success)
            {
                return BadRequest(new { message = "Failed to update inventory item." });
            }

            var updated = await _repository.GetByIdAsync(id);
            if (updated == null)
            {
                return NotFound(new { message = $"Inventory item with id {id} was not found after update." });
            }

            return Ok(MapToDto(updated));
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageInventory)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { message = $"Inventory item with id {id} was not found." });
            }

            var success = await _repository.DeactivateAsync(id);

            if (!success)
            {
                return BadRequest(new { message = "Failed to deactivate inventory item." });
            }

            return Ok(new { message = "Inventory item deactivated successfully." });
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private static string? ValidateDto(InventoryItemDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.SkuCode))
        {
            return "SkuCode is required.";
        }

        if (string.IsNullOrWhiteSpace(dto.ItemName))
        {
            return "ItemName is required.";
        }

        if (string.IsNullOrWhiteSpace(dto.Unit))
        {
            return "Unit is required.";
        }

        if (dto.QuantityOnHand < 0)
        {
            return "QuantityOnHand cannot be negative.";
        }

        if (dto.MinimumQuantity is < 0)
        {
            return "MinimumQuantity cannot be negative.";
        }

        return null;
    }

    private static InventoryItemDto MapToDto(InventoryItem inventoryItem)
    {
        return new InventoryItemDto
        {
            InventoryItemId = inventoryItem.InventoryItemId,
            SkuCode = inventoryItem.SkuCode,
            ItemName = inventoryItem.ItemName,
            Category = inventoryItem.Category,
            QuantityOnHand = inventoryItem.QuantityOnHand,
            Unit = inventoryItem.Unit,
            MinimumQuantity = inventoryItem.MinimumQuantity,
            LocationName = inventoryItem.LocationName,
            Notes = inventoryItem.Notes,
            IsActive = inventoryItem.IsActive
        };
    }

    private static InventoryItem MapToEntity(InventoryItemDto dto)
    {
        return new InventoryItem
        {
            InventoryItemId = dto.InventoryItemId,
            SkuCode = dto.SkuCode,
            ItemName = dto.ItemName,
            Category = dto.Category,
            QuantityOnHand = dto.QuantityOnHand,
            Unit = dto.Unit,
            MinimumQuantity = dto.MinimumQuantity,
            LocationName = dto.LocationName,
            Notes = dto.Notes,
            IsActive = dto.IsActive
        };
    }
}

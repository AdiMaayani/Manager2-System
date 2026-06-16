using ManageR2.Api.Authorization;
using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Controllers;

// Inventory MVP: company-wide stock catalog CRUD backed by stored procedures.
// DTO validation runs via the global ValidationActionFilter; faults are shaped by GlobalExceptionHandler.
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
        var inventoryItems = await _repository.GetListAsync(search, category, status, lowStockOnly);

        return Ok(inventoryItems.Select(MapToDto));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var inventoryItem = await _repository.GetByIdAsync(id);

        if (inventoryItem == null)
        {
            return NotFound(new { message = $"Inventory item with id {id} was not found." });
        }

        return Ok(MapToDto(inventoryItem));
    }

    [Authorize(Policy = Policies.CanManageInventory)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] InventoryItemDto dto)
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

    [Authorize(Policy = Policies.CanManageInventory)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] InventoryItemDto dto)
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

    [Authorize(Policy = Policies.CanManageInventory)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
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

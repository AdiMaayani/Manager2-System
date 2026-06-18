using ManageR2.Api.Authorization;
using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
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
    private const long MaxImageFileSizeBytes = 5 * 1024 * 1024;

    // Public web path (relative to wwwroot) under which product images are stored and served as static files.
    private const string ImageRelativeRoot = "uploads/inventory";

    private static readonly Dictionary<string, string> AllowedImageContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp"
    };

    private readonly IInventoryItemRepository _repository;
    private readonly IWebHostEnvironment _environment;

    public InventoryController(IInventoryItemRepository repository, IWebHostEnvironment environment)
    {
        _repository = repository;
        _environment = environment;
    }

    [HttpGet]
    public async Task<IActionResult> GetList(
        [FromQuery] string? search,
        [FromQuery] string? category,
        [FromQuery] string? status = "active",
        [FromQuery] bool lowStockOnly = false)
    {
        var inventoryItems = await _repository.GetListAsync(search, category, status, lowStockOnly);

        return Ok(inventoryItems.Select(MapToDto).ToList());
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
        var categoryError = ValidateCategory(dto.Category);
        if (categoryError != null)
        {
            return BadRequest(new { message = categoryError });
        }

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
        var categoryError = ValidateCategory(dto.Category);
        if (categoryError != null)
        {
            return BadRequest(new { message = categoryError });
        }

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

    [Authorize(Policy = Policies.CanManageInventory)]
    [HttpPost("{id:int}/image")]
    [RequestSizeLimit(MaxImageFileSizeBytes)]
    public async Task<IActionResult> UploadImage(int id, IFormFile? file)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null)
        {
            return NotFound(new { message = $"Inventory item with id {id} was not found." });
        }

        var validationError = ValidateImageFile(file);
        if (validationError != null)
        {
            return BadRequest(new { message = validationError });
        }

        // Never trust the original filename; derive the extension from the validated content type.
        var uploadedFile = file!;
        var extension = AllowedImageContentTypes[uploadedFile.ContentType];
        var storedFileName = $"{Guid.NewGuid():N}{extension}";
        var storageRoot = GetImageStorageRoot();
        var fullFilePath = Path.GetFullPath(Path.Combine(storageRoot, storedFileName));
        if (!fullFilePath.StartsWith(storageRoot, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Invalid upload path." });
        }

        var relativePath = $"{ImageRelativeRoot}/{storedFileName}";

        try
        {
            await using (var stream = System.IO.File.Create(fullFilePath))
            {
                await uploadedFile.CopyToAsync(stream);
            }

            var imageResult = await _repository.SetImageAsync(
                id,
                relativePath,
                uploadedFile.ContentType,
                uploadedFile.Length);

            // Item vanished between the existence check and the update (race): clean up the orphan file.
            if (!imageResult.ItemFound)
            {
                DeleteImageFileIfExists(relativePath);
                return NotFound(new { message = $"Inventory item with id {id} was not found." });
            }

            // Remove the replaced file only after the new one is persisted in the database.
            DeleteImageFileIfExists(imageResult.PreviousImagePath);

            var updated = await _repository.GetByIdAsync(id);
            if (updated == null)
            {
                DeleteImageFileIfExists(relativePath);
                return NotFound(new { message = $"Inventory item with id {id} was not found after image upload." });
            }

            return Ok(MapToDto(updated));
        }
        catch (UserValidationException ex)
        {
            DeleteImageFileIfExists(relativePath);
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageInventory)]
    [HttpDelete("{id:int}/image")]
    public async Task<IActionResult> DeleteImage(int id)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null)
        {
            return NotFound(new { message = $"Inventory item with id {id} was not found." });
        }

        // The item exists (checked above); a 0-row result here simply means it had no image to clear.
        var imageResult = await _repository.ClearImageAsync(id);
        DeleteImageFileIfExists(imageResult.PreviousImagePath);

        var updated = await _repository.GetByIdAsync(id);
        if (updated == null)
        {
            return NotFound(new { message = $"Inventory item with id {id} was not found after image removal." });
        }

        return Ok(MapToDto(updated));
    }

    private InventoryItemDto MapToDto(InventoryItem inventoryItem)
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
            IsActive = inventoryItem.IsActive,
            ImageUrl = BuildImageUrl(inventoryItem.ImagePath)
        };
    }

    private string? BuildImageUrl(string? imagePath)
    {
        if (string.IsNullOrWhiteSpace(imagePath))
        {
            return null;
        }

        // Compose an absolute URL so the SPA can use it directly in <img> regardless of its API base path.
        var normalizedPath = imagePath.Replace('\\', '/').TrimStart('/');
        return $"{Request.Scheme}://{Request.Host}{Request.PathBase}/{normalizedPath}";
    }

    private string GetImageStorageRoot()
    {
        var webRoot = string.IsNullOrWhiteSpace(_environment.WebRootPath)
            ? Path.Combine(_environment.ContentRootPath, "wwwroot")
            : _environment.WebRootPath;

        var storageRoot = Path.GetFullPath(Path.Combine(webRoot, "uploads", "inventory"));
        Directory.CreateDirectory(storageRoot);
        return storageRoot;
    }

    private void DeleteImageFileIfExists(string? relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath)) return;

        var fileName = Path.GetFileName(relativePath.Replace('\\', '/'));
        if (string.IsNullOrWhiteSpace(fileName)) return;

        var storageRoot = GetImageStorageRoot();
        var fullFilePath = Path.GetFullPath(Path.Combine(storageRoot, fileName));
        if (fullFilePath.StartsWith(storageRoot, StringComparison.OrdinalIgnoreCase)
            && System.IO.File.Exists(fullFilePath))
        {
            System.IO.File.Delete(fullFilePath);
        }
    }

    // Centralized category guard so create/update cannot persist a non-canonical category,
    // even when the API is called directly. The canonical list lives in the Domain layer.
    private static string? ValidateCategory(string? category)
    {
        return InventoryCategories.IsValid(category)
            ? null
            : "Category must be one of the supported inventory categories.";
    }

    private static string? ValidateImageFile(IFormFile? file)
    {
        if (file == null || file.Length == 0)
        {
            return "Image file is required.";
        }

        if (file.Length > MaxImageFileSizeBytes)
        {
            return "Image file is too large. Maximum size is 5 MB.";
        }

        if (string.IsNullOrWhiteSpace(file.ContentType) || !AllowedImageContentTypes.ContainsKey(file.ContentType))
        {
            return "Image must be a JPEG, PNG, or WebP file.";
        }

        return null;
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

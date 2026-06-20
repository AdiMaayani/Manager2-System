using ManageR2.Api.Authorization;
using ManageR2.Api.DTOs;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = Policies.CanViewProjects)]
// Thin controller: handles HTTP concerns and delegates lifecycle data loading to the repository.
public class ProjectsController : ControllerBase
{
    private const long MaxDrawingFileSizeBytes = 25 * 1024 * 1024;
    private static readonly HashSet<string> AllowedDrawingExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf",
        ".dwg"
    };

    // Aggregates project header, milestones, assignments, reports, and KPI summary (often via stored procedures).
    private readonly IProjectLifecycleRepository _projectLifecycleRepository;
    private readonly IProjectEquipmentRepository _projectEquipmentRepository;
    private readonly IProjectBoqRepository _projectBoqRepository;
    private readonly IProjectDrawingRepository _projectDrawingRepository;
    private readonly IWebHostEnvironment _environment;

    public ProjectsController(
        IProjectLifecycleRepository projectLifecycleRepository,
        IProjectEquipmentRepository projectEquipmentRepository,
        IProjectBoqRepository projectBoqRepository,
        IProjectDrawingRepository projectDrawingRepository,
        IWebHostEnvironment environment)
    {
        _projectLifecycleRepository = projectLifecycleRepository;
        _projectEquipmentRepository = projectEquipmentRepository;
        _projectBoqRepository = projectBoqRepository;
        _projectDrawingRepository = projectDrawingRepository;
        _environment = environment;
    }

    [HttpGet("{id:int}/lifecycle")]
    // Returns the full project lifecycle view for one project id.
    public async Task<ActionResult<ProjectLifecycleDto>> GetLifecycle(int id)
    {
        // Repository pattern keeps data access and stored procedure details outside the controller.
        var lifecycle = await _projectLifecycleRepository.GetProjectLifecycleAsync(id);

        if (lifecycle == null)
        {
            return NotFound(new { message = $"Project with id {id} was not found." });
        }

        // Maps Infrastructure model objects to API DTOs returned to the frontend.
        var dto = new ProjectLifecycleDto
        {
            // Project header section.
            Project = new ProjectLifecycleProjectDto
            {
                WorkItemId = lifecycle.Project.WorkItemId,
                Title = lifecycle.Project.Title,
                Description = lifecycle.Project.Description,
                Status = lifecycle.Project.Status,
                BillingType = lifecycle.Project.BillingType,
                CustomerId = lifecycle.Project.CustomerId,
                CustomerName = lifecycle.Project.CustomerName,
                SiteId = lifecycle.Project.SiteId,
                SiteName = lifecycle.Project.SiteName,
                CreatedAt = lifecycle.Project.CreatedAt,
                ClosedAt = lifecycle.Project.ClosedAt,
                DealCloseDate = lifecycle.Project.DealCloseDate,
                FinanceProjectNumber = lifecycle.Project.FinanceProjectNumber,
                InvoiceNumber = lifecycle.Project.InvoiceNumber
            },
            // Milestone list section.
            Milestones = lifecycle.Milestones.Select(m => new ProjectLifecycleMilestoneDto
            {
                WorkItemId = m.WorkItemId,
                Title = m.Title,
                Description = m.Description,
                Status = m.Status,
                BillingType = m.BillingType,
                CreatedAt = m.CreatedAt,
                PlannedStart = m.PlannedStart,
                PlannedEnd = m.PlannedEnd,
                ClosedAt = m.ClosedAt,
                EstimatedHours = m.EstimatedHours,
                Priority = m.Priority,
                RequiredRole = m.RequiredRole,
                IsLocked = m.IsLocked
            }).ToList(),
            // Assignment list section.
            Assignments = lifecycle.Assignments.Select(a => new ProjectLifecycleAssignmentDto
            {
                WorkItemId = a.WorkItemId,
                EmployeeId = a.EmployeeId,
                ContractorId = a.ContractorId,
                AssignmentType = a.AssignmentType,
                AssignmentRole = a.AssignmentRole,
                AssignedHours = a.AssignedHours,
                IsManualAssignment = a.IsManualAssignment,
                EmployeeName = a.EmployeeName,
                ContractorName = a.ContractorName
            }).ToList(),
            // Work report list section.
            Reports = lifecycle.Reports.Select(r => new ProjectLifecycleReportDto
            {
                WorkReportId = r.WorkReportId,
                WorkItemId = r.WorkItemId,
                ReportType = r.ReportType,
                ReportDate = r.ReportDate,
                Summary = r.Summary,
                Notes = r.Notes,
                ReporterName = r.ReporterName,
                Status = r.Status,
                FollowUpRequired = r.FollowUpRequired
            }).ToList(),
            // Summary section includes progress, risk, and health indicators.
            Summary = new ProjectLifecycleSummaryDto
            {
                TotalMilestones = lifecycle.Summary.TotalMilestones,
                OpenMilestones = lifecycle.Summary.OpenMilestones,
                ClosedMilestones = lifecycle.Summary.ClosedMilestones,
                LockedMilestones = lifecycle.Summary.LockedMilestones,
                CancelledMilestones = lifecycle.Summary.CancelledMilestones,
                DelayedMilestones = lifecycle.Summary.DelayedMilestones,
                InvalidScheduleMilestones = lifecycle.Summary.InvalidScheduleMilestones,
                UpcomingMilestones = lifecycle.Summary.UpcomingMilestones,
                RiskLevel = lifecycle.Summary.RiskLevel,
                HealthStatus = lifecycle.Summary.HealthStatus,
                RiskReason = lifecycle.Summary.RiskReason,
                ProgressPercent = lifecycle.Summary.ProgressPercent,
                TotalReports = lifecycle.Summary.TotalReports,
                HasFollowUps = lifecycle.Summary.HasFollowUps
            }
        };

        return Ok(dto);
    }

    [HttpGet("{projectId:int}/boq")]
    public async Task<ActionResult<List<ProjectBoqItemDto>>> GetBoq(int projectId)
    {
        try
        {
            var boqItems = await _projectBoqRepository.GetByProjectIdAsync(projectId);
            return Ok(boqItems.Select(MapProjectBoqItem).ToList());
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageProjects)]
    [HttpPost("{projectId:int}/boq")]
    public async Task<ActionResult<ProjectBoqItemDto>> CreateBoqItem(
        int projectId,
        [FromBody] CreateProjectBoqItemRequestDto request)
    {
        try
        {
            var boqItem = new ProjectBoqItemModel
            {
                ProjectId = projectId,
                SystemName = string.IsNullOrWhiteSpace(request.SystemName)
                    ? null
                    : request.SystemName.Trim(),
                InventoryItemId = request.InventoryItemId,
                ItemDescription = request.ItemDescription.Trim(),
                Quantity = request.Quantity,
                Unit = request.Unit.Trim(),
                UnitPrice = request.UnitPrice,
                SortOrder = request.SortOrder ?? 0
            };

            var boqItemId = await _projectBoqRepository.CreateAsync(boqItem);
            var created = await GetProjectBoqItemOrNullAsync(projectId, boqItemId);

            if (created == null)
            {
                return BadRequest(new { message = "Project BOQ item was created but could not be reloaded." });
            }

            return CreatedAtAction(
                nameof(GetBoq),
                new { projectId },
                MapProjectBoqItem(created));
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageProjects)]
    [HttpPut("{projectId:int}/boq/{boqItemId:int}")]
    public async Task<ActionResult<ProjectBoqItemDto>> UpdateBoqItem(
        int projectId,
        int boqItemId,
        [FromBody] UpdateProjectBoqItemRequestDto request)
    {
        try
        {
            var boqItem = new ProjectBoqItemModel
            {
                ProjectBoqItemId = boqItemId,
                ProjectId = projectId,
                SystemName = string.IsNullOrWhiteSpace(request.SystemName)
                    ? null
                    : request.SystemName.Trim(),
                InventoryItemId = request.InventoryItemId,
                ItemDescription = request.ItemDescription.Trim(),
                Quantity = request.Quantity,
                Unit = request.Unit.Trim(),
                UnitPrice = request.UnitPrice,
                SortOrder = request.SortOrder
            };

            var updated = await _projectBoqRepository.UpdateAsync(boqItem);

            if (!updated)
            {
                return NotFound(new { message = $"Project BOQ item with id {boqItemId} was not found." });
            }

            var reloaded = await GetProjectBoqItemOrNullAsync(projectId, boqItemId);

            if (reloaded == null)
            {
                return NotFound(new { message = $"Project BOQ item with id {boqItemId} was not found after update." });
            }

            return Ok(MapProjectBoqItem(reloaded));
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageProjects)]
    [HttpDelete("{projectId:int}/boq/{boqItemId:int}")]
    public async Task<IActionResult> DeleteBoqItem(int projectId, int boqItemId)
    {
        try
        {
            var deleted = await _projectBoqRepository.DeleteAsync(projectId, boqItemId);

            if (!deleted)
            {
                return NotFound(new { message = $"Project BOQ item with id {boqItemId} was not found." });
            }

            return NoContent();
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageProjects)]
    [HttpPut("{projectId:int}/boq/order")]
    public async Task<IActionResult> ReorderBoqItems(
        int projectId,
        [FromBody] ReorderProjectBoqRequestDto request)
    {
        if (request.Items.Any(item => item.ProjectBoqItemId <= 0 || item.SortOrder <= 0))
        {
            return BadRequest(new { message = "Every BOQ order item must include a valid id and sort order." });
        }

        try
        {
            var sortOrders = request.Items.Select(item => new ProjectBoqSortOrderModel
            {
                ProjectBoqItemId = item.ProjectBoqItemId,
                SortOrder = item.SortOrder
            }).ToList();

            var reordered = await _projectBoqRepository.ReorderAsync(projectId, sortOrders);

            if (!reordered)
            {
                return NotFound(new { message = "One or more project BOQ items were not found." });
            }

            return NoContent();
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("{projectId:int}/drawings")]
    public async Task<ActionResult<List<ProjectDrawingDto>>> GetDrawings(int projectId)
    {
        try
        {
            var drawings = await _projectDrawingRepository.GetByProjectIdAsync(projectId);
            return Ok(drawings.Select(MapProjectDrawing).ToList());
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageProjects)]
    [HttpPost("{projectId:int}/drawings")]
    public async Task<ActionResult<ProjectDrawingDto>> CreateDrawing(
        int projectId,
        [FromBody] CreateProjectDrawingRequestDto request)
    {
        try
        {
            var drawing = new ProjectDrawingModel
            {
                ProjectId = projectId,
                Name = request.Name.Trim(),
                Type = request.Type.Trim().ToUpperInvariant(),
                DrawingDate = request.DrawingDate,
                Note = string.IsNullOrWhiteSpace(request.Note)
                    ? null
                    : request.Note.Trim(),
                SortOrder = request.SortOrder ?? 0
            };

            var drawingId = await _projectDrawingRepository.CreateAsync(drawing);
            var created = await GetProjectDrawingOrNullAsync(projectId, drawingId);

            if (created == null)
            {
                return BadRequest(new { message = "Project drawing was created but could not be reloaded." });
            }

            return CreatedAtAction(
                nameof(GetDrawings),
                new { projectId },
                MapProjectDrawing(created));
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageProjects)]
    [HttpPost("{projectId:int}/drawings/upload")]
    [RequestSizeLimit(MaxDrawingFileSizeBytes)]
    public async Task<ActionResult<ProjectDrawingDto>> UploadDrawing(
        int projectId,
        [FromForm] UploadProjectDrawingRequestDto request)
    {
        var fileValidationError = ValidateDrawingFile(request.File);
        if (fileValidationError != null)
        {
            return BadRequest(new { message = fileValidationError });
        }

        var file = request.File!;
        var originalFileName = Path.GetFileName(file.FileName);
        var extension = Path.GetExtension(originalFileName);
        var storedFileName = $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        var relativeDirectory = projectId.ToString();
        var storageRoot = GetDrawingStorageRoot();
        var projectDirectory = Path.Combine(storageRoot, relativeDirectory);
        Directory.CreateDirectory(projectDirectory);

        var fullFilePath = Path.GetFullPath(Path.Combine(projectDirectory, storedFileName));
        if (!fullFilePath.StartsWith(storageRoot, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Invalid upload path." });
        }

        try
        {
            await using (var stream = System.IO.File.Create(fullFilePath))
            {
                await file.CopyToAsync(stream);
            }

            var drawing = new ProjectDrawingModel
            {
                ProjectId = projectId,
                Name = request.Name.Trim(),
                Type = request.Type.Trim().ToUpperInvariant(),
                DrawingDate = request.DrawingDate,
                Note = string.IsNullOrWhiteSpace(request.Note)
                    ? null
                    : request.Note.Trim(),
                OriginalFileName = originalFileName,
                StoredFileName = storedFileName,
                FilePath = Path.Combine(relativeDirectory, storedFileName),
                ContentType = string.IsNullOrWhiteSpace(file.ContentType)
                    ? "application/octet-stream"
                    : file.ContentType,
                FileSizeBytes = file.Length,
                SortOrder = request.SortOrder ?? 0
            };

            var drawingId = await _projectDrawingRepository.CreateAsync(drawing);
            var created = await GetProjectDrawingOrNullAsync(projectId, drawingId);

            if (created == null)
            {
                DeleteDrawingFileIfExists(drawing.FilePath);
                return BadRequest(new { message = "Project drawing was uploaded but could not be reloaded." });
            }

            return CreatedAtAction(
                nameof(GetDrawings),
                new { projectId },
                MapProjectDrawing(created));
        }
        catch (UserValidationException ex)
        {
            DeleteDrawingFileIfExists(Path.Combine(relativeDirectory, storedFileName));
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("{projectId:int}/drawings/{projectDrawingId:int}/file")]
    public async Task<IActionResult> DownloadDrawingFile(int projectId, int projectDrawingId)
    {
        var drawing = await GetProjectDrawingOrNullAsync(projectId, projectDrawingId);
        if (drawing == null)
        {
            return NotFound(new { message = $"Project drawing with id {projectDrawingId} was not found." });
        }

        if (string.IsNullOrWhiteSpace(drawing.FilePath))
        {
            return NotFound(new { message = "Project drawing has no uploaded file." });
        }

        var fullFilePath = GetSafeDrawingFilePath(drawing.FilePath);
        if (fullFilePath == null || !System.IO.File.Exists(fullFilePath))
        {
            return NotFound(new { message = "Project drawing file was not found." });
        }

        var contentType = string.IsNullOrWhiteSpace(drawing.ContentType)
            ? "application/octet-stream"
            : drawing.ContentType;
        var downloadName = string.IsNullOrWhiteSpace(drawing.OriginalFileName)
            ? drawing.Name
            : drawing.OriginalFileName;

        return PhysicalFile(fullFilePath, contentType, downloadName);
    }

    [Authorize(Policy = Policies.CanManageProjects)]
    [HttpPut("{projectId:int}/drawings/{projectDrawingId:int}")]
    public async Task<ActionResult<ProjectDrawingDto>> UpdateDrawing(
        int projectId,
        int projectDrawingId,
        [FromBody] UpdateProjectDrawingRequestDto request)
    {
        try
        {
            var drawing = new ProjectDrawingModel
            {
                ProjectDrawingId = projectDrawingId,
                ProjectId = projectId,
                Name = request.Name.Trim(),
                Type = request.Type.Trim().ToUpperInvariant(),
                DrawingDate = request.DrawingDate,
                Note = string.IsNullOrWhiteSpace(request.Note)
                    ? null
                    : request.Note.Trim(),
                SortOrder = request.SortOrder
            };

            var updated = await _projectDrawingRepository.UpdateAsync(drawing);

            if (!updated)
            {
                return NotFound(new { message = $"Project drawing with id {projectDrawingId} was not found." });
            }

            var reloaded = await GetProjectDrawingOrNullAsync(projectId, projectDrawingId);

            if (reloaded == null)
            {
                return NotFound(new { message = $"Project drawing with id {projectDrawingId} was not found after update." });
            }

            return Ok(MapProjectDrawing(reloaded));
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageProjects)]
    [HttpDelete("{projectId:int}/drawings/{projectDrawingId:int}")]
    public async Task<IActionResult> DeleteDrawing(int projectId, int projectDrawingId)
    {
        try
        {
            var drawing = await GetProjectDrawingOrNullAsync(projectId, projectDrawingId);
            var deleted = await _projectDrawingRepository.DeleteAsync(projectId, projectDrawingId);

            if (!deleted)
            {
                return NotFound(new { message = $"Project drawing with id {projectDrawingId} was not found." });
            }

            DeleteDrawingFileIfExists(drawing?.FilePath);
            return NoContent();
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("{projectId:int}/equipment")]
    public async Task<ActionResult<List<ProjectEquipmentItemDto>>> GetEquipment(int projectId)
    {
        try
        {
            var equipmentItems = await _projectEquipmentRepository.GetByProjectIdAsync(projectId);
            return Ok(equipmentItems.Select(MapProjectEquipmentItem).ToList());
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageProjects)]
    [HttpPost("{projectId:int}/equipment")]
    public async Task<ActionResult<ProjectEquipmentItemDto>> CreateEquipment(
        int projectId,
        [FromBody] CreateProjectEquipmentItemRequestDto request)
    {
        try
        {
            var equipmentItem = new ProjectEquipmentItemModel
            {
                ProjectId = projectId,
                InventoryItemId = request.InventoryItemId,
                EquipmentName = request.EquipmentName.Trim(),
                Status = request.Status.Trim(),
                Location = string.IsNullOrWhiteSpace(request.Location)
                    ? null
                    : request.Location.Trim(),
                SortOrder = request.SortOrder ?? 0
            };

            var equipmentItemId = await _projectEquipmentRepository.CreateAsync(equipmentItem);
            var created = await GetProjectEquipmentItemOrNullAsync(projectId, equipmentItemId);

            if (created == null)
            {
                return BadRequest(new { message = "Project equipment item was created but could not be reloaded." });
            }

            return CreatedAtAction(
                nameof(GetEquipment),
                new { projectId },
                MapProjectEquipmentItem(created));
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageProjects)]
    [HttpPut("{projectId:int}/equipment/{equipmentItemId:int}")]
    public async Task<ActionResult<ProjectEquipmentItemDto>> UpdateEquipment(
        int projectId,
        int equipmentItemId,
        [FromBody] UpdateProjectEquipmentItemRequestDto request)
    {
        try
        {
            var equipmentItem = new ProjectEquipmentItemModel
            {
                ProjectEquipmentItemId = equipmentItemId,
                ProjectId = projectId,
                InventoryItemId = request.InventoryItemId,
                EquipmentName = request.EquipmentName.Trim(),
                Status = request.Status.Trim(),
                Location = string.IsNullOrWhiteSpace(request.Location)
                    ? null
                    : request.Location.Trim(),
                SortOrder = request.SortOrder
            };

            var updated = await _projectEquipmentRepository.UpdateAsync(equipmentItem);

            if (!updated)
            {
                return NotFound(new { message = $"Project equipment item with id {equipmentItemId} was not found." });
            }

            var reloaded = await GetProjectEquipmentItemOrNullAsync(projectId, equipmentItemId);

            if (reloaded == null)
            {
                return NotFound(new { message = $"Project equipment item with id {equipmentItemId} was not found after update." });
            }

            return Ok(MapProjectEquipmentItem(reloaded));
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageProjects)]
    [HttpDelete("{projectId:int}/equipment/{equipmentItemId:int}")]
    public async Task<IActionResult> DeleteEquipment(int projectId, int equipmentItemId)
    {
        try
        {
            var deleted = await _projectEquipmentRepository.DeleteAsync(projectId, equipmentItemId);

            if (!deleted)
            {
                return NotFound(new { message = $"Project equipment item with id {equipmentItemId} was not found." });
            }

            return NoContent();
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageProjects)]
    [HttpPut("{projectId:int}/equipment/order")]
    public async Task<IActionResult> ReorderEquipment(
        int projectId,
        [FromBody] ReorderProjectEquipmentRequestDto request)
    {
        if (request.Items.Any(item => item.ProjectEquipmentItemId <= 0 || item.SortOrder <= 0))
        {
            return BadRequest(new { message = "Every equipment order item must include a valid id and sort order." });
        }

        try
        {
            var sortOrders = request.Items.Select(item => new ProjectEquipmentSortOrderModel
            {
                ProjectEquipmentItemId = item.ProjectEquipmentItemId,
                SortOrder = item.SortOrder
            }).ToList();

            var reordered = await _projectEquipmentRepository.ReorderAsync(projectId, sortOrders);

            if (!reordered)
            {
                return NotFound(new { message = "One or more project equipment items were not found." });
            }

            return NoContent();
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private async Task<ProjectEquipmentItemModel?> GetProjectEquipmentItemOrNullAsync(
        int projectId,
        int equipmentItemId)
    {
        var equipmentItems = await _projectEquipmentRepository.GetByProjectIdAsync(projectId);
        return equipmentItems.FirstOrDefault(item => item.ProjectEquipmentItemId == equipmentItemId);
    }

    private async Task<ProjectBoqItemModel?> GetProjectBoqItemOrNullAsync(
        int projectId,
        int boqItemId)
    {
        var boqItems = await _projectBoqRepository.GetByProjectIdAsync(projectId);
        return boqItems.FirstOrDefault(item => item.ProjectBoqItemId == boqItemId);
    }

    private async Task<ProjectDrawingModel?> GetProjectDrawingOrNullAsync(
        int projectId,
        int projectDrawingId)
    {
        var drawings = await _projectDrawingRepository.GetByProjectIdAsync(projectId);
        return drawings.FirstOrDefault(item => item.ProjectDrawingId == projectDrawingId);
    }

    private static ProjectBoqItemDto MapProjectBoqItem(ProjectBoqItemModel boqItem)
    {
        return new ProjectBoqItemDto
        {
            ProjectBoqItemId = boqItem.ProjectBoqItemId,
            ProjectId = boqItem.ProjectId,
            SystemName = boqItem.SystemName,
            InventoryItemId = boqItem.InventoryItemId,
            InventorySkuCode = boqItem.InventorySkuCode,
            InventoryItemName = boqItem.InventoryItemName,
            InventoryCategory = boqItem.InventoryCategory,
            ItemDescription = boqItem.ItemDescription,
            Quantity = boqItem.Quantity,
            Unit = boqItem.Unit,
            UnitPrice = boqItem.UnitPrice,
            SortOrder = boqItem.SortOrder,
            CreatedAt = boqItem.CreatedAt,
            UpdatedAt = boqItem.UpdatedAt
        };
    }

    private static ProjectEquipmentItemDto MapProjectEquipmentItem(
        ProjectEquipmentItemModel equipmentItem)
    {
        return new ProjectEquipmentItemDto
        {
            ProjectEquipmentItemId = equipmentItem.ProjectEquipmentItemId,
            ProjectId = equipmentItem.ProjectId,
            InventoryItemId = equipmentItem.InventoryItemId,
            InventorySkuCode = equipmentItem.InventorySkuCode,
            InventoryItemName = equipmentItem.InventoryItemName,
            InventoryCategory = equipmentItem.InventoryCategory,
            EquipmentName = equipmentItem.EquipmentName,
            Status = equipmentItem.Status,
            Location = equipmentItem.Location,
            SortOrder = equipmentItem.SortOrder,
            CreatedAt = equipmentItem.CreatedAt,
            UpdatedAt = equipmentItem.UpdatedAt
        };
    }

    private static ProjectDrawingDto MapProjectDrawing(ProjectDrawingModel drawing)
    {
        return new ProjectDrawingDto
        {
            ProjectDrawingId = drawing.ProjectDrawingId,
            ProjectId = drawing.ProjectId,
            Name = drawing.Name,
            Type = drawing.Type,
            DrawingDate = drawing.DrawingDate,
            Note = drawing.Note,
            OriginalFileName = drawing.OriginalFileName,
            StoredFileName = drawing.StoredFileName,
            FilePath = drawing.FilePath,
            ContentType = drawing.ContentType,
            FileSizeBytes = drawing.FileSizeBytes,
            SortOrder = drawing.SortOrder,
            CreatedAt = drawing.CreatedAt,
            UpdatedAt = drawing.UpdatedAt
        };
    }

    private string GetDrawingStorageRoot()
    {
        var storageRoot = Path.GetFullPath(Path.Combine(
            _environment.ContentRootPath,
            "App_Data",
            "project-drawings"));
        Directory.CreateDirectory(storageRoot);
        return storageRoot;
    }

    private string? GetSafeDrawingFilePath(string relativeFilePath)
    {
        var storageRoot = GetDrawingStorageRoot();
        var fullFilePath = Path.GetFullPath(Path.Combine(storageRoot, relativeFilePath));
        return fullFilePath.StartsWith(storageRoot, StringComparison.OrdinalIgnoreCase)
            ? fullFilePath
            : null;
    }

    private void DeleteDrawingFileIfExists(string? relativeFilePath)
    {
        if (string.IsNullOrWhiteSpace(relativeFilePath)) return;

        var fullFilePath = GetSafeDrawingFilePath(relativeFilePath);
        if (fullFilePath != null && System.IO.File.Exists(fullFilePath))
        {
            System.IO.File.Delete(fullFilePath);
        }
    }

    private static string? ValidateDrawingFile(IFormFile? file)
    {
        if (file == null || file.Length == 0)
        {
            return "Drawing file is required.";
        }

        if (file.Length > MaxDrawingFileSizeBytes)
        {
            return "Drawing file is too large.";
        }

        var extension = Path.GetExtension(file.FileName);
        if (!AllowedDrawingExtensions.Contains(extension))
        {
            return "Drawing file must be PDF or DWG.";
        }

        return null;
    }
}

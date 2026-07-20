using ManageR2.Api.Authorization;
using ManageR2.Api.DTOs;
using ManageR2.Api.Features.Reports.DTOs;
using ManageR2.Api.Features.Reports.Services;
using ManageR2.Domain.Exceptions;
using ManageR2.Domain.Features.Reports;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = Policies.CanViewReports)]
public class ReportsController : ControllerBase
{
    private readonly IWorkReportRepository _workReportRepository;
    private readonly IWorkReportAttachmentStorageService _attachmentStorageService;

    public ReportsController(
        IWorkReportRepository workReportRepository,
        IWorkReportAttachmentStorageService attachmentStorageService)
    {
        _workReportRepository = workReportRepository;
        _attachmentStorageService = attachmentStorageService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var reports = await _workReportRepository.GetAllAsync();
        return Ok(reports);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var report = await _workReportRepository.GetByIdAsync(id);
        if (report == null)
        {
            return NotFound(new { message = $"Report with id {id} was not found." });
        }

        return Ok(report);
    }

    [Authorize(Policy = Policies.CanEditReports)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateWorkReportRequest request)
    {
        if (request == null)
        {
            return BadRequest("Request is null");
        }

        var model = MapToModel(request);
        model.UpdatedByUserId = GetCurrentUserId();
        var newId = await _workReportRepository.CreateAsync(model);

        return Ok(new CreateWorkReportResponse
        {
            Message = "Report created successfully",
            WorkReportId = newId
        });
    }

    [Authorize(Policy = Policies.CanEditReports)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] CreateWorkReportRequest request)
    {
        if (request == null)
        {
            return BadRequest(new { message = "Request is null." });
        }

        var existingReport = await _workReportRepository.GetByIdAsync(id);
        if (existingReport == null)
        {
            return NotFound(new { message = $"Report with id {id} was not found." });
        }

        if (WorkReportLifecyclePolicy.IsReadOnly(existingReport.LifecycleStatus))
        {
            return BadRequest(new { message = "לא ניתן לערוך דיווח שהוחזר לטיוטה." });
        }

        var model = MapToUpdateModel(id, request);
        model.UpdatedByUserId = GetCurrentUserId();
        var wasUpdated = await _workReportRepository.UpdateAsync(model);
        if (!wasUpdated)
        {
            return BadRequest(new { message = "Failed to update report." });
        }

        var updatedReport = await _workReportRepository.GetByIdAsync(id);
        return Ok(updatedReport);
    }

    [Authorize(Policy = Policies.CanEditReports)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var existingReport = await _workReportRepository.GetByIdAsync(id);
        if (existingReport == null)
        {
            return NotFound(new { message = $"Report with id {id} was not found." });
        }

        if (!WorkReportLifecyclePolicy.CanDelete(existingReport.LifecycleStatus))
        {
            return BadRequest(new { message = "ניתן למחוק רק דיווח במצב טיוטת מלאי." });
        }

        if (existingReport.Attachments.Count > 0)
        {
            return BadRequest(new { message = "יש למחוק את הקבצים המצורפים לפני מחיקת הדיווח." });
        }

        try
        {
            var wasDeleted = await _workReportRepository.DeleteAsync(id);
            if (!wasDeleted)
            {
                return BadRequest(new { message = "מחיקת הדיווח נכשלה." });
            }

            return NoContent();
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex) when (
            ex.Message.Contains("51370", StringComparison.Ordinal)
            || ex.Message.Contains("Only Draft", StringComparison.Ordinal))
        {
            return BadRequest(new { message = "ניתן למחוק רק דיווח במצב טיוטת מלאי." });
        }
        catch (Exception ex) when (
            ex.Message.Contains("51371", StringComparison.Ordinal)
            || ex.Message.Contains("attachments", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "יש למחוק את הקבצים המצורפים לפני מחיקת הדיווח." });
        }
        catch (Exception ex) when (
            ex.Message.Contains("51372", StringComparison.Ordinal)
            || ex.Message.Contains("stock movements", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "לא ניתן למחוק דיווח שכבר נוצרו עבורו תנועות מלאי." });
        }
    }

    [Authorize(Policy = Policies.CanEditReports)]
    [HttpPost("{id:int}/finalize")]
    public async Task<IActionResult> Finalize(int id)
    {
        try
        {
            var result = await _workReportRepository.FinalizeAsync(id, GetCurrentUserId());
            if (result == null)
            {
                return NotFound(new { message = $"Report with id {id} was not found." });
            }

            return Ok(MapLifecycle(result));
        }
        catch (Exception ex) when (ex.Message.Contains("51341") || ex.Message.Contains("cannot be finalized"))
        {
            return BadRequest(new { message = "לא ניתן לסיים דיווח שהוחזר לטיוטה." });
        }
        catch (Exception ex) when (ex.Message.Contains("51340") || ex.Message.Contains("Work report not found"))
        {
            return NotFound(new { message = $"דיווח מספר {id} לא נמצא." });
        }
        catch (Exception ex) when (
            ex.Message.Contains("51332") ||
            ex.Message.Contains("51334") ||
            ex.Message.Contains("Insufficient or inactive inventory") ||
            ex.Message.Contains("already has usage movements"))
        {
            var message = ex.Message.Contains("51332") ||
                          ex.Message.Contains("Insufficient or inactive inventory")
                ? "לא ניתן לסיים את הדיווח: המלאי אינו מספיק או שאחד מפריטי המלאי אינו פעיל."
                : "לא ניתן לסיים את הדיווח משום שכבר קיימות עבורו תנועות מלאי לא תקינות.";
            return BadRequest(new { message });
        }
    }

    [Authorize(Policy = Policies.CanEditReports)]
    [HttpPost("{id:int}/reverse")]
    public async Task<IActionResult> Reverse(int id, [FromBody] ReverseWorkReportRequestDto request)
    {
        try
        {
            var result = await _workReportRepository.ReverseAsync(id, request.ReversalReason, GetCurrentUserId());
            if (result == null)
            {
                return NotFound(new { message = $"Report with id {id} was not found." });
            }

            return Ok(MapLifecycle(result));
        }
        catch (Exception ex) when (ex.Message.Contains("51350") || ex.Message.Contains("51352"))
        {
            var message = ex.Message.Contains("51352") || ex.Message.Contains("Draft")
                ? "לא ניתן להחזיר לטיוטה דיווח שכבר נמצא בטיוטה."
                : "יש להזין סיבה להחזרת הדיווח לטיוטה.";
            return BadRequest(new { message });
        }
        catch (Exception ex) when (ex.Message.Contains("51351") || ex.Message.Contains("Work report not found"))
        {
            return NotFound(new { message = $"דיווח מספר {id} לא נמצא." });
        }
        catch (Exception ex) when (
            ex.Message.Contains("51333") ||
            ex.Message.Contains("51335") ||
            ex.Message.Contains("51336") ||
            ex.Message.Contains("during reversal") ||
            ex.Message.Contains("Cannot reverse"))
        {
            return BadRequest(new
            {
                message = "לא ניתן להחזיר את הדיווח לטיוטה משום שתנועות המלאי שלו אינן תקינות."
            });
        }
    }

    [Authorize(Policy = Policies.CanEditReports)]
    [HttpPost("{id:int}/amend")]
    public async Task<IActionResult> Amend(int id)
    {
        var reversedReport = await _workReportRepository.GetByIdAsync(id);
        if (reversedReport == null)
        {
            return NotFound(new { message = $"Report with id {id} was not found." });
        }

        if (!string.Equals(reversedReport.LifecycleStatus, WorkReportLifecycleStatuses.Reversed, StringComparison.Ordinal))
        {
            return BadRequest(new { message = "ניתן ליצור דיווח מתקן רק מדיווח שהוחזר לטיוטה." });
        }

        var model = new WorkReportCreateModel
        {
            ReportType = reversedReport.ReportType,
            Date = reversedReport.ReportDate?.ToString("yyyy-MM-dd"),
            ProjectId = reversedReport.ProjectId,
            ProjectName = reversedReport.ProjectName,
            CustomerName = reversedReport.CustomerName,
            ServiceCallId = reversedReport.ServiceCallId,
            ServiceCallTitle = reversedReport.ServiceCallTitle,
            Site = reversedReport.Site,
            Start = reversedReport.Start,
            End = reversedReport.End,
            Summary = reversedReport.Summary,
            Notes = reversedReport.Notes,
            ReporterId = reversedReport.ReporterId,
            ReporterName = reversedReport.ReporterName,
            Role = reversedReport.Role,
            Status = reversedReport.Status,
            Systems = reversedReport.Systems.ToList(),
            RelatedWorkers = reversedReport.RelatedWorkers.ToList(),
            Followup = reversedReport.Followup,
            FollowupReason = reversedReport.FollowupReason,
            UpdatedByUserId = GetCurrentUserId()
        };

        var newReportId = await _workReportRepository.AmendAsync(id, model);
        var created = await _workReportRepository.GetByIdAsync(newReportId);
        return Ok(new { workReportId = newReportId, report = created });
    }

    [Authorize(Policy = Policies.CanEditReports)]
    [HttpPost("{id:int}/inventory")]
    public async Task<IActionResult> AddInventoryLine(int id, [FromBody] AddWorkReportInventoryLineRequestDto request)
    {
        try
        {
            var line = await _workReportRepository.AddInventoryLineAsync(
                id,
                request.InventoryItemId,
                request.Quantity,
                request.UsageType,
                GetCurrentUserId());

            if (line == null)
            {
                return BadRequest(new { message = "Failed to add inventory line." });
            }

            return Ok(line);
        }
        catch (Exception ex) when (ex.Message.Contains("51300") || ex.Message.Contains("Draft"))
        {
            return BadRequest(new { message = "ניתן לערוך שורות מלאי רק בדיווח שנמצא בטיוטה." });
        }
    }

    [Authorize(Policy = Policies.CanEditReports)]
    [HttpDelete("{id:int}/inventory/{inventoryLineId:int}")]
    public async Task<IActionResult> DeleteInventoryLine(int id, int inventoryLineId)
    {
        try
        {
            var deleted = await _workReportRepository.DeleteInventoryLineAsync(id, inventoryLineId);
            if (!deleted)
            {
                return NotFound(new { message = "Inventory line was not found." });
            }

            return NoContent();
        }
        catch (Exception ex) when (ex.Message.Contains("51310"))
        {
            return BadRequest(new { message = "ניתן לערוך שורות מלאי רק בדיווח שנמצא בטיוטה." });
        }
    }

    [Authorize(Policy = Policies.CanEditReports)]
    [HttpPost("{id:int}/attachments")]
    [RequestSizeLimit(50 * 1024 * 1024)]
    public async Task<IActionResult> UploadAttachment(int id, IFormFile? file)
    {
        var existingReport = await _workReportRepository.GetByIdAsync(id);
        if (existingReport == null)
        {
            return NotFound(new { message = $"Report with id {id} was not found." });
        }

        if (!WorkReportLifecyclePolicy.CanEditAttachments(existingReport.LifecycleStatus))
        {
            return BadRequest(new { message = "לא ניתן לשנות קבצים בדיווח שהוחזר לטיוטה." });
        }

        var validationError = _attachmentStorageService.ValidateAttachmentFile(file);
        if (validationError != null)
        {
            return BadRequest(new { message = validationError });
        }

        WorkReportAttachmentSaveResult savedFile;
        try
        {
            savedFile = await _attachmentStorageService.SaveAttachmentAsync(id, file!);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        try
        {
            var attachment = await _workReportRepository.AddAttachmentAsync(
                id,
                savedFile.MediaType,
                file!.FileName,
                savedFile.StoredFileName,
                savedFile.RelativeFilePath,
                savedFile.ContentType,
                file.Length,
                GetCurrentUserId());

            if (attachment == null)
            {
                _attachmentStorageService.DeleteFileIfExists(savedFile.RelativeFilePath);
                return BadRequest(new { message = "Attachment metadata could not be saved." });
            }

            return Ok(attachment);
        }
        catch
        {
            _attachmentStorageService.DeleteFileIfExists(savedFile.RelativeFilePath);
            throw;
        }
    }

    [Authorize(Policy = Policies.CanEditReports)]
    [HttpDelete("{id:int}/attachments/{attachmentId:int}")]
    public async Task<IActionResult> DeleteAttachment(int id, int attachmentId)
    {
        var existingReport = await _workReportRepository.GetByIdAsync(id);
        if (existingReport == null)
        {
            return NotFound(new { message = $"Report with id {id} was not found." });
        }

        if (!WorkReportLifecyclePolicy.CanEditAttachments(existingReport.LifecycleStatus))
        {
            return BadRequest(new { message = "לא ניתן לשנות קבצים בדיווח שהוחזר לטיוטה." });
        }

        var deleted = await _workReportRepository.DeleteAttachmentAsync(id, attachmentId);
        if (deleted == null)
        {
            return NotFound(new { message = "Attachment was not found." });
        }

        _attachmentStorageService.DeleteFileIfExists(deleted.FilePath);
        return NoContent();
    }

    [HttpGet("{id:int}/attachments/{attachmentId:int}/file")]
    public async Task<IActionResult> DownloadAttachment(int id, int attachmentId)
    {
        var attachment = await _workReportRepository.GetAttachmentAsync(id, attachmentId);
        if (attachment == null)
        {
            return NotFound(new { message = "Attachment was not found." });
        }

        var fullFilePath = _attachmentStorageService.GetSafeFilePath(attachment.FilePath);
        if (fullFilePath == null)
        {
            return NotFound(new { message = "Attachment file was not found." });
        }

        var contentType = string.IsNullOrWhiteSpace(attachment.ContentType)
            ? "application/octet-stream"
            : attachment.ContentType;

        return PhysicalFile(fullFilePath, contentType, attachment.OriginalFileName);
    }

    private int? GetCurrentUserId()
    {
        return int.TryParse(User.FindFirst("userId")?.Value, out var userId) && userId > 0
            ? userId
            : null;
    }

    private static WorkReportLifecycleDto MapLifecycle(WorkReportLifecycleResultModel result)
    {
        return new WorkReportLifecycleDto
        {
            WorkReportId = result.WorkReportId,
            Status = result.Status,
            LifecycleStatus = result.LifecycleStatus,
            FinalizedAt = result.FinalizedAt,
            ReversedAt = result.ReversedAt,
            ReversalReason = result.ReversalReason
        };
    }

    private static WorkReportCreateModel MapToModel(CreateWorkReportRequest request)
    {
        return new WorkReportCreateModel
        {
            ReportType = request.ReportType,
            Date = request.Date,
            WorkItemId = request.WorkItemId,
            ProjectId = request.ProjectId,
            ProjectName = request.ProjectName,
            CustomerName = request.CustomerName,
            ServiceCallId = request.ServiceCallId,
            ServiceCallTitle = request.ServiceCallTitle,
            Site = request.Site,
            Start = request.Start,
            End = request.End,
            Summary = request.Summary,
            Notes = request.Notes,
            ReporterId = request.ReporterId,
            ReporterName = request.ReporterName,
            Role = request.Role,
            Status = request.Status,
            Systems = request.Systems ?? new List<string>(),
            RelatedWorkers = request.RelatedWorkers?.Select(worker => new WorkReportRelatedWorkerModel
            {
                Id = worker.Id,
                Name = worker.Name
            }).ToList() ?? new List<WorkReportRelatedWorkerModel>(),
            Followup = request.Followup,
            FollowupReason = request.FollowupReason
        };
    }

    private static WorkReportUpdateModel MapToUpdateModel(int workReportId, CreateWorkReportRequest request)
    {
        var model = new WorkReportUpdateModel
        {
            WorkReportId = workReportId,
            ReportType = request.ReportType,
            Date = request.Date,
            WorkItemId = request.WorkItemId,
            ProjectId = request.ProjectId,
            ProjectName = request.ProjectName,
            CustomerName = request.CustomerName,
            ServiceCallId = request.ServiceCallId,
            ServiceCallTitle = request.ServiceCallTitle,
            Site = request.Site,
            Start = request.Start,
            End = request.End,
            Summary = request.Summary,
            Notes = request.Notes,
            ReporterId = request.ReporterId,
            ReporterName = request.ReporterName,
            Role = request.Role,
            Status = request.Status,
            Systems = request.Systems ?? new List<string>(),
            RelatedWorkers = request.RelatedWorkers?.Select(worker => new WorkReportRelatedWorkerModel
            {
                Id = worker.Id,
                Name = worker.Name
            }).ToList() ?? new List<WorkReportRelatedWorkerModel>(),
            Followup = request.Followup,
            FollowupReason = request.FollowupReason
        };

        return model;
    }
}

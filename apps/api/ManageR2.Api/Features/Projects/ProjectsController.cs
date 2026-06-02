using ManageR2.Api.DTOs;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
// Thin controller: handles HTTP concerns and delegates lifecycle data loading to the repository.
public class ProjectsController : ControllerBase
{
    // Aggregates project header, milestones, assignments, reports, and KPI summary (often via stored procedures).
    private readonly IProjectLifecycleRepository _projectLifecycleRepository;
    private readonly IProjectEquipmentRepository _projectEquipmentRepository;

    public ProjectsController(
        IProjectLifecycleRepository projectLifecycleRepository,
        IProjectEquipmentRepository projectEquipmentRepository)
    {
        _projectLifecycleRepository = projectLifecycleRepository;
        _projectEquipmentRepository = projectEquipmentRepository;
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

    [HttpPost("{projectId:int}/equipment")]
    public async Task<ActionResult<ProjectEquipmentItemDto>> CreateEquipment(
        int projectId,
        [FromBody] CreateProjectEquipmentItemRequestDto request)
    {
        var validationError = ValidateProjectEquipmentRequest(
            request.EquipmentName,
            request.Status);

        if (validationError != null)
        {
            return BadRequest(new { message = validationError });
        }

        try
        {
            var equipmentItem = new ProjectEquipmentItemModel
            {
                ProjectId = projectId,
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

    [HttpPut("{projectId:int}/equipment/{equipmentItemId:int}")]
    public async Task<ActionResult<ProjectEquipmentItemDto>> UpdateEquipment(
        int projectId,
        int equipmentItemId,
        [FromBody] UpdateProjectEquipmentItemRequestDto request)
    {
        var validationError = ValidateProjectEquipmentRequest(
            request.EquipmentName,
            request.Status);

        if (validationError != null)
        {
            return BadRequest(new { message = validationError });
        }

        try
        {
            var equipmentItem = new ProjectEquipmentItemModel
            {
                ProjectEquipmentItemId = equipmentItemId,
                ProjectId = projectId,
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

    private static string? ValidateProjectEquipmentRequest(string equipmentName, string status)
    {
        if (string.IsNullOrWhiteSpace(equipmentName))
        {
            return "EquipmentName is required.";
        }

        if (string.IsNullOrWhiteSpace(status))
        {
            return "Status is required.";
        }

        return null;
    }

    private static ProjectEquipmentItemDto MapProjectEquipmentItem(
        ProjectEquipmentItemModel equipmentItem)
    {
        return new ProjectEquipmentItemDto
        {
            ProjectEquipmentItemId = equipmentItem.ProjectEquipmentItemId,
            ProjectId = equipmentItem.ProjectId,
            EquipmentName = equipmentItem.EquipmentName,
            Status = equipmentItem.Status,
            Location = equipmentItem.Location,
            SortOrder = equipmentItem.SortOrder,
            CreatedAt = equipmentItem.CreatedAt,
            UpdatedAt = equipmentItem.UpdatedAt
        };
    }
}

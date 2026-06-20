using ManageR2.Api.Authorization;
using ManageR2.Api.Features.Projects.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Features.Projects;

[ApiController]
[Route("api/projects/{projectId:int}/milestones")]
[Authorize(Policy = Policies.CanViewProjects)]
public class ProjectMilestonesController : ControllerBase
{
    private readonly IWorkItemRepository _workItemRepository;
    private readonly IProjectMilestoneRepository _projectMilestoneRepository;

    public ProjectMilestonesController(
        IWorkItemRepository workItemRepository,
        IProjectMilestoneRepository projectMilestoneRepository)
    {
        _workItemRepository = workItemRepository;
        _projectMilestoneRepository = projectMilestoneRepository;
    }

    [HttpGet]
    public async Task<ActionResult<List<ProjectMilestoneResponseDto>>> GetByProject(int projectId)
    {
        var validationError = await ValidateProjectAsync(projectId);
        if (validationError != null)
        {
            return validationError;
        }

        var milestones = await _projectMilestoneRepository.GetByProjectIdAsync(projectId);
        return Ok(milestones.Select(MapToResponse).ToList());
    }

    [HttpGet("{milestoneId:int}")]
    public async Task<ActionResult<ProjectMilestoneResponseDto>> GetById(int projectId, int milestoneId)
    {
        var validationError = await ValidateProjectAsync(projectId);
        if (validationError != null)
        {
            return validationError;
        }

        var milestone = await _projectMilestoneRepository.GetByIdAsync(milestoneId);
        if (milestone == null || milestone.ProjectId != projectId)
        {
            return NotFound(new { message = $"Project milestone with id {milestoneId} was not found." });
        }

        return Ok(MapToResponse(milestone));
    }

    [Authorize(Policy = Policies.CanManageProjects)]
    [HttpPost]
    public async Task<IActionResult> Create(int projectId, [FromBody] CreateProjectMilestoneRequestDto request)
    {
        var validationError = await ValidateProjectAsync(projectId);
        if (validationError != null)
        {
            return validationError;
        }

        var existing = await _projectMilestoneRepository.GetByProjectIdAsync(projectId);
        var nextSortOrder = request.SortOrder ?? (existing.Count == 0 ? 0 : existing.Max(m => m.SortOrder) + 1);

        var milestone = new ProjectMilestone
        {
            ProjectId = projectId,
            Title = request.Title.Trim(),
            Description = request.Description,
            SortOrder = nextSortOrder,
            Status = request.Status,
            ManagerEmployeeId = request.ManagerEmployeeId,
            PlannedStart = request.PlannedStart,
            PlannedEnd = request.PlannedEnd
        };

        var newId = await _projectMilestoneRepository.CreateAsync(milestone);
        if (newId <= 0)
        {
            return BadRequest(new { message = "Failed to create project milestone." });
        }

        var created = await _projectMilestoneRepository.GetByIdAsync(newId);
        return Ok(new
        {
            message = "Project milestone created successfully.",
            projectMilestoneId = newId,
            milestone = created == null ? null : MapToResponse(created)
        });
    }

    [Authorize(Policy = Policies.CanManageProjects)]
    [HttpPut("{milestoneId:int}")]
    public async Task<IActionResult> Update(
        int projectId,
        int milestoneId,
        [FromBody] UpdateProjectMilestoneRequestDto request)
    {
        var validationError = await ValidateProjectAsync(projectId);
        if (validationError != null)
        {
            return validationError;
        }

        var existing = await _projectMilestoneRepository.GetByIdAsync(milestoneId);
        if (existing == null || existing.ProjectId != projectId || !existing.IsActive)
        {
            return NotFound(new { message = $"Project milestone with id {milestoneId} was not found." });
        }

        var milestone = new ProjectMilestone
        {
            ProjectMilestoneId = milestoneId,
            ProjectId = projectId,
            Title = request.Title.Trim(),
            Description = request.Description,
            SortOrder = request.SortOrder,
            Status = request.Status,
            ManagerEmployeeId = request.ManagerEmployeeId ?? existing.ManagerEmployeeId,
            PlannedStart = request.PlannedStart,
            PlannedEnd = request.PlannedEnd,
            ActualStart = request.ActualStart,
            ActualEnd = request.ActualEnd,
            ProgressPercent = request.ProgressPercent,
            IsActive = true
        };

        var updated = await _projectMilestoneRepository.UpdateAsync(milestone);
        if (!updated)
        {
            return BadRequest(new { message = "Failed to update project milestone." });
        }

        return Ok(new { message = "Project milestone updated successfully." });
    }

    [Authorize(Policy = Policies.CanManageProjects)]
    [HttpPut("reorder")]
    public async Task<IActionResult> Reorder(int projectId, [FromBody] ReorderProjectMilestonesRequestDto request)
    {
        var validationError = await ValidateProjectAsync(projectId);
        if (validationError != null)
        {
            return validationError;
        }

        var items = request.Items
            .Select(item => (item.ProjectMilestoneId, item.SortOrder))
            .ToList();

        var reordered = await _projectMilestoneRepository.ReorderAsync(projectId, items);
        if (!reordered)
        {
            return BadRequest(new { message = "Failed to reorder project milestones." });
        }

        return Ok(new { message = "Project milestones reordered successfully." });
    }

    [Authorize(Policy = Policies.CanManageProjects)]
    [HttpPut("{milestoneId:int}/deactivate")]
    public async Task<IActionResult> Deactivate(int projectId, int milestoneId)
    {
        var validationError = await ValidateProjectAsync(projectId);
        if (validationError != null)
        {
            return validationError;
        }

        var existing = await _projectMilestoneRepository.GetByIdAsync(milestoneId);
        if (existing == null || existing.ProjectId != projectId)
        {
            return NotFound(new { message = $"Project milestone with id {milestoneId} was not found." });
        }

        var deactivated = await _projectMilestoneRepository.DeactivateAsync(projectId, milestoneId);
        if (!deactivated)
        {
            return BadRequest(new { message = "Failed to deactivate project milestone." });
        }

        return Ok(new { message = "Project milestone deactivated successfully." });
    }

    private async Task<ActionResult?> ValidateProjectAsync(int projectId)
    {
        var project = await _workItemRepository.GetByIdAsync(projectId);
        if (project == null)
        {
            return NotFound(new { message = $"Project with id {projectId} was not found." });
        }

        if (!string.Equals(project.WorkType, "Project", StringComparison.OrdinalIgnoreCase) || project.IsArchived)
        {
            return BadRequest(new { message = $"WorkItem {projectId} is not an active project." });
        }

        return null;
    }

    private static ProjectMilestoneResponseDto MapToResponse(ProjectMilestone milestone)
    {
        return new ProjectMilestoneResponseDto
        {
            ProjectMilestoneId = milestone.ProjectMilestoneId,
            ProjectId = milestone.ProjectId,
            Title = milestone.Title,
            Description = milestone.Description,
            SortOrder = milestone.SortOrder,
            Status = milestone.Status,
            ManagerEmployeeId = milestone.ManagerEmployeeId,
            PlannedStart = milestone.PlannedStart,
            PlannedEnd = milestone.PlannedEnd,
            ActualStart = milestone.ActualStart,
            ActualEnd = milestone.ActualEnd,
            ProgressPercent = milestone.ProgressPercent,
            IsActive = milestone.IsActive,
            LegacyWorkItemId = milestone.LegacyWorkItemId,
            CreatedAt = milestone.CreatedAt,
            UpdatedAt = milestone.UpdatedAt
        };
    }
}

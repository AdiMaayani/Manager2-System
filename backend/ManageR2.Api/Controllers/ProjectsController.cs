using ManageR2.Api.DTOs;
using ManageR2.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProjectsController : ControllerBase
{
    private readonly IProjectLifecycleRepository _projectLifecycleRepository;

    public ProjectsController(IProjectLifecycleRepository projectLifecycleRepository)
    {
        _projectLifecycleRepository = projectLifecycleRepository;
    }

    [HttpGet("{id:int}/lifecycle")]
    public async Task<ActionResult<ProjectLifecycleDto>> GetLifecycle(int id)
    {
        var lifecycle = await _projectLifecycleRepository.GetProjectLifecycleAsync(id);

        if (lifecycle == null)
        {
            return NotFound(new { message = $"Project with id {id} was not found." });
        }

        var dto = new ProjectLifecycleDto
        {
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
            Summary = new ProjectLifecycleSummaryDto
            {
                TotalMilestones = lifecycle.Summary.TotalMilestones,
                OpenMilestones = lifecycle.Summary.OpenMilestones,
                ClosedMilestones = lifecycle.Summary.ClosedMilestones,
                LockedMilestones = lifecycle.Summary.LockedMilestones,
                ProgressPercent = lifecycle.Summary.ProgressPercent,
                TotalReports = lifecycle.Summary.TotalReports,
                HasFollowUps = lifecycle.Summary.HasFollowUps
            }
        };

        return Ok(dto);
    }
}

using ManageR2.Api.Authorization;
using ManageR2.Api.DTOs;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = Policies.CanViewReports)]
// Thin API controller for creating and reading work reports linked to work items.
public class ReportsController : ControllerBase
{
    private readonly IWorkReportRepository _workReportRepository;

    public ReportsController(IWorkReportRepository workReportRepository)
    {
        _workReportRepository = workReportRepository;
    }

    // GET handlers return persisted work reports for dashboards (no DTO mapping on read paths).
    [HttpGet]
// Returns all reports for list pages and recent activity views.
public async Task<IActionResult> GetAll()
{
    var reports = await _workReportRepository.GetAllAsync();
    return Ok(reports);
}

[HttpGet("{id:int}")]
// Returns one full report with details by report id.
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
    // Creates a report and delegates persistence to the report repository.
    public async Task<IActionResult> Create([FromBody] CreateWorkReportRequest request)
    {
        if (request == null)
        {
            return BadRequest("Request is null");
        }

        // Maps incoming API request fields to infrastructure create model.
        var model = MapToModel(request);

        var newId = await _workReportRepository.CreateAsync(model);

        var response = new CreateWorkReportResponse
        {
            Message = "Report created successfully",
            WorkReportId = newId
        };

        return Ok(response);
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

        var model = MapToUpdateModel(id, request);
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

        var wasDeleted = await _workReportRepository.DeleteAsync(id);
        if (!wasDeleted)
        {
            return BadRequest(new { message = "Failed to delete report." });
        }

        return NoContent();
    }

    private static WorkReportCreateModel MapToModel(CreateWorkReportRequest request)
    {
        // Keeps controller thin by centralizing DTO-to-model mapping in one place.
        return new WorkReportCreateModel
        {
            ReportType = request.ReportType,
            Date = request.Date,
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
            RelatedWorkers = request.RelatedWorkers?.Select(w => new WorkReportRelatedWorkerModel
            {
                Id = w.Id,
                Name = w.Name
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
            RelatedWorkers = request.RelatedWorkers?.Select(w => new WorkReportRelatedWorkerModel
            {
                Id = w.Id,
                Name = w.Name
            }).ToList() ?? new List<WorkReportRelatedWorkerModel>(),
            Followup = request.Followup,
            FollowupReason = request.FollowupReason
        };

        return model;
    }
}
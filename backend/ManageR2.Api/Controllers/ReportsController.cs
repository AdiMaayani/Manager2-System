using ManageR2.Api.DTOs;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReportsController : ControllerBase
{
    private readonly IWorkReportRepository _workReportRepository;

    public ReportsController(IWorkReportRepository workReportRepository)
    {
        _workReportRepository = workReportRepository;
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

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateWorkReportRequest request)
    {
        if (request == null)
        {
            return BadRequest("Request is null");
        }

        var model = MapToModel(request);

        var newId = await _workReportRepository.CreateAsync(model);

        var response = new CreateWorkReportResponse
        {
            Message = "Report created successfully",
            WorkReportId = newId
        };

        return Ok(response);
    }

    private static WorkReportCreateModel MapToModel(CreateWorkReportRequest request)
    {
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
}
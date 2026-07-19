using ManageR2.Api.Authorization;
using ManageR2.Api.Features.Audit;
using ManageR2.Api.Features.ServiceCalls.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Features.WorkItems;
using ManageR2.Domain.Features.SmartAssignment;
using ManageR2.Infrastructure.Features.WorkItems.Services;
using ManageR2.Infrastructure.Repositories;
using ManageR2.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Features.ServiceCalls;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = Policies.CanViewServiceCalls)]
public class ServiceCallsController : ControllerBase
{
    private readonly IWorkItemRepository _workItemRepository;
    private readonly IWorkItemTaskService _workItemTaskService;
    private readonly IAuditLogService _auditLogService;

    public ServiceCallsController(
        IWorkItemRepository workItemRepository,
        IWorkItemTaskService workItemTaskService,
        IAuditLogService auditLogService)
    {
        _workItemRepository = workItemRepository;
        _workItemTaskService = workItemTaskService;
        _auditLogService = auditLogService;
    }

    [HttpGet]
    public async Task<ActionResult<List<ServiceCallResponseDto>>> GetAll()
    {
        var serviceCalls = await _workItemRepository.GetByTypeAsync(WorkItemWorkTypes.ServiceCall);
        return Ok(serviceCalls.Select(MapToResponse).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ServiceCallResponseDto>> GetById(int id)
    {
        var serviceCall = await GetServiceCallOrNullAsync(id);
        if (serviceCall == null)
        {
            return NotFound($"Service call with ID {id} was not found.");
        }

        return Ok(MapToResponse(serviceCall));
    }

    [Authorize(Policy = Policies.CanManageServiceCalls)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateServiceCallRequestDto request)
    {
        try
        {
            var serviceCall = BuildServiceCall(request);
            var newWorkItemId = await _workItemRepository.CreateAsync(serviceCall);

            if (newWorkItemId <= 0)
            {
                return BadRequest("Failed to create service call.");
            }

            await _auditLogService.LogAsync(this.BuildAuditEvent(
                AuditActions.ServiceCallCreated,
                AuditEntityTypes.ServiceCall,
                $"Service call '{serviceCall.Title}' (#{newWorkItemId}) created.",
                entityId: newWorkItemId,
                metadata: new Dictionary<string, object?>
                {
                    ["customerId"] = serviceCall.CustomerId,
                    ["siteId"] = serviceCall.SiteId,
                    ["status"] = serviceCall.Status,
                    ["priority"] = serviceCall.Priority
                }));

            return Ok(new
            {
                message = "Service call created successfully.",
                workItemId = newWorkItemId
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageServiceCalls)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateServiceCallRequestDto request)
    {
        var existingServiceCall = await GetServiceCallOrNullAsync(id);
        if (existingServiceCall == null)
        {
            return NotFound($"Service call with ID {id} was not found.");
        }

        if (existingServiceCall.IsArchived)
        {
            return BadRequest(new { message = "Archived service calls cannot be edited or reassigned." });
        }

        if (existingServiceCall.IsLocked && request.EmployeeReplacements is { Count: > 0 })
        {
            return BadRequest(new { message = "Locked service calls cannot be reassigned." });
        }

        try
        {
            var serviceCall = BuildServiceCall(request, existingServiceCall);
            var replacements = (request.EmployeeReplacements ?? new List<ServiceCallEmployeeReplacementRequestDto>())
                .Select(replacement => (
                    replacement.WorkEmployeeAssignmentId,
                    replacement.EmployeeId))
                .ToList();
            var updated = replacements.Count > 0
                ? await _workItemRepository.UpdateWithEmployeeReplacementsAsync(
                    id,
                    serviceCall,
                    replacements)
                : await _workItemRepository.UpdateAsync(id, serviceCall);

            if (!updated)
            {
                return BadRequest("Failed to update service call.");
            }

            await _auditLogService.LogAsync(this.BuildAuditEvent(
                AuditActions.ServiceCallUpdated,
                AuditEntityTypes.ServiceCall,
                $"Service call '{serviceCall.Title}' (#{id}) updated.",
                entityId: id,
                metadata: new Dictionary<string, object?>
                {
                    ["status"] = serviceCall.Status,
                    ["priority"] = serviceCall.Priority,
                    ["employeeReplacementCount"] = replacements.Count
                }));

            return Ok(new { message = "Service call updated successfully." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageServiceCalls)]
    [HttpPut("{id:int}/close")]
    public async Task<IActionResult> Close(int id)
    {
        var existingServiceCall = await GetServiceCallOrNullAsync(id);
        if (existingServiceCall == null)
        {
            return NotFound($"Service call with ID {id} was not found.");
        }

        var closed = await _workItemRepository.CloseAsync(id);
        if (!closed)
        {
            return BadRequest("Failed to close service call.");
        }

        await _auditLogService.LogAsync(this.BuildAuditEvent(
            AuditActions.ServiceCallClosed,
            AuditEntityTypes.ServiceCall,
            $"Service call '{existingServiceCall.Title}' (#{id}) closed.",
            entityId: id));

        return Ok(new { message = "Service call closed successfully." });
    }

    [Authorize(Policy = Policies.CanManageServiceCalls)]
    [HttpPost("{id:int}/assign-employee")]
    public async Task<IActionResult> AssignEmployee(int id, [FromBody] AssignServiceCallEmployeeRequestDto request)
    {
        var existingServiceCall = await GetServiceCallOrNullAsync(id);
        if (existingServiceCall == null)
        {
            return NotFound($"Service call with ID {id} was not found.");
        }

        try
        {
            var assigned = await _workItemRepository.AssignEmployeeToWorkAsync(
                id,
                request.EmployeeId,
                request.AssignmentRole,
                request.RecommendationRunId);

            if (!assigned)
            {
                return BadRequest("Failed to assign employee to service call.");
            }

            await _auditLogService.LogAsync(this.BuildAuditEvent(
                AuditActions.ServiceCallAssigned,
                AuditEntityTypes.ServiceCall,
                $"Employee #{request.EmployeeId} assigned to service call '{existingServiceCall.Title}' (#{id}).",
                entityId: id,
                metadata: new Dictionary<string, object?>
                {
                    ["employeeId"] = request.EmployeeId,
                    ["assignmentRole"] = request.AssignmentRole,
                    ["assignmentMethod"] = request.RecommendationRunId.HasValue
                        ? "SmartAssignment"
                        : "Manual",
                    ["recommendationRunId"] = request.RecommendationRunId
                }));

            return Ok(new { message = "Employee assigned to service call successfully." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    private async Task<WorkItem?> GetServiceCallOrNullAsync(int workItemId)
    {
        var workItem = await _workItemRepository.GetByIdAsync(workItemId);
        if (workItem == null ||
            !string.Equals(workItem.WorkType, WorkItemWorkTypes.ServiceCall, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return workItem;
    }

    private WorkItem BuildServiceCall(CreateServiceCallRequestDto request, WorkItem? existingServiceCall = null)
    {
        var (plannedStartUtc, plannedEndUtc) = UtcDateTimeNormalizer.NormalizePlannedRange(
            request.PlannedStart,
            request.PlannedEnd);

        var validationInput = new WorkItemTaskValidationInput
        {
            TaskCategory = WorkItemTaskCategories.ServiceCall,
            CustomerId = request.CustomerId,
            SiteId = request.SiteId,
            PlannedStartUtc = plannedStartUtc,
            PlannedEndUtc = plannedEndUtc
        };

        _workItemTaskService.ValidateCreateOrUpdate(validationInput, isServiceCallPath: true);

        var requiredRoles = existingServiceCall is null
            ? ProfessionCollection.Resolve(request.RequiredRoles, request.RequiredRole)
            : ProfessionCollection.ResolveForUpdate(
                request.RequiredRoles,
                request.RequiredRole,
                existingServiceCall.RequiredRoles,
                existingServiceCall.RequiredRole,
                request.RequiredRoleWasProvided);

        return _workItemTaskService.ApplyCanonicalFields(new WorkItem
        {
            Title = request.Title.Trim(),
            Description = request.Description,
            Status = ResolveTaskStatus(request.Status, existingServiceCall?.Status),
            BillingType = request.BillingType,
            Priority = request.Priority,
            ActualStart = request.ActualStart,
            ActualEnd = request.ActualEnd,
            ActualHours = request.ActualHours,
            RequiredRole = requiredRoles.FirstOrDefault(),
            RequiredRoles = requiredRoles.ToList(),
            IsLocked = request.IsLocked
        }, validationInput);
    }

    private static string ResolveTaskStatus(string? requestedStatus, string? existingStatus = null) =>
        string.IsNullOrWhiteSpace(requestedStatus)
            ? (existingStatus ?? WorkItemDefaultStatuses.Planned)
            : requestedStatus;

    private static ServiceCallResponseDto MapToResponse(WorkItem serviceCall)
    {
        return new ServiceCallResponseDto
        {
            WorkItemId = serviceCall.WorkItemId,
            Title = serviceCall.Title,
            Description = serviceCall.Description,
            WorkType = serviceCall.WorkType ?? WorkItemWorkTypes.ServiceCall,
            TaskCategory = serviceCall.TaskCategory,
            Status = serviceCall.Status ?? string.Empty,
            BillingType = serviceCall.BillingType,
            CustomerId = serviceCall.CustomerId,
            CustomerName = serviceCall.CustomerName,
            SiteId = serviceCall.SiteId,
            SiteName = serviceCall.SiteName,
            Priority = serviceCall.Priority,
            PlannedStart = serviceCall.PlannedStart,
            PlannedEnd = serviceCall.PlannedEnd,
            EstimatedHours = serviceCall.EstimatedHours,
            ActualStart = serviceCall.ActualStart,
            ActualEnd = serviceCall.ActualEnd,
            ActualHours = serviceCall.ActualHours,
            RequiredRole = serviceCall.RequiredRole,
            RequiredRoles = serviceCall.RequiredRoles,
            IsLocked = serviceCall.IsLocked,
            CreatedAt = serviceCall.CreatedAt,
            ClosedAt = serviceCall.ClosedAt
        };
    }
}

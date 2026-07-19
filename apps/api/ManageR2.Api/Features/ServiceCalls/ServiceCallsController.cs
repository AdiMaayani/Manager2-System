using ManageR2.Api.Authorization;
using ManageR2.Api.Features.Audit;
using ManageR2.Api.Features.ServiceCalls.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Domain.Features.WorkItems;
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
        return Ok(serviceCalls.Select(ServiceCallResponseMapper.Map).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ServiceCallResponseDto>> GetById(int id)
    {
        var serviceCall = await GetServiceCallOrNullAsync(id);
        if (serviceCall == null)
        {
            return NotFound($"Service call with ID {id} was not found.");
        }

        return Ok(ServiceCallResponseMapper.Map(serviceCall));
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

        try
        {
            var statusTransitionError = ServiceCallLifecycleRules.ValidateStatusTransitionForUpdate(
                existingServiceCall.Status,
                request.Status);
            if (statusTransitionError != null)
            {
                return BadRequest(new { message = statusTransitionError });
            }

            var serviceCall = BuildServiceCall(request, existingServiceCall.Status);
            var updated = await _workItemRepository.UpdateAsync(id, serviceCall);

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
                    ["priority"] = serviceCall.Priority
                }));

            return Ok(new { message = "Service call updated successfully." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Cancels a Service Call (Status = Cancelled, ClosedAt = UTC now).
    /// Route retained as /close for compatibility with existing clients; behavior is cancellation.
    /// </summary>
    [Authorize(Policy = Policies.CanManageServiceCalls)]
    [HttpPut("{id:int}/close")]
    public async Task<IActionResult> Cancel(int id)
    {
        var existingServiceCall = await GetServiceCallOrNullAsync(id);
        if (existingServiceCall == null)
        {
            return NotFound($"Service call with ID {id} was not found.");
        }

        if (!ServiceCallLifecycleRules.CanCancel(existingServiceCall.Status, existingServiceCall.ClosedAt))
        {
            return BadRequest(new { message = "לא ניתן לבטל את קריאת השירות במצב הנוכחי." });
        }

        try
        {
            var cancelled = await _workItemRepository.CancelServiceCallAsync(id);
            if (!cancelled)
            {
                return BadRequest(new { message = "ביטול קריאת השירות נכשל." });
            }

            await _auditLogService.LogAsync(this.BuildAuditEvent(
                AuditActions.ServiceCallCancelled,
                AuditEntityTypes.ServiceCall,
                $"Service call '{existingServiceCall.Title}' (#{id}) cancelled.",
                entityId: id));

            return Ok(new { message = "Service call cancelled successfully." });
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = Policies.CanManageServiceCalls)]
    [HttpPut("{id:int}/reopen")]
    public async Task<IActionResult> Reopen(int id)
    {
        var existingServiceCall = await GetServiceCallOrNullAsync(id);
        if (existingServiceCall == null)
        {
            return NotFound($"Service call with ID {id} was not found.");
        }

        if (!ServiceCallLifecycleRules.CanReopen(existingServiceCall.Status, existingServiceCall.ClosedAt))
        {
            return BadRequest(new { message = "לא ניתן לפתוח מחדש את קריאת השירות במצב הנוכחי." });
        }

        try
        {
            var reopened = await _workItemRepository.ReopenServiceCallAsync(id);
            if (!reopened)
            {
                return BadRequest(new { message = "פתיחה מחדש של קריאת השירות נכשלה." });
            }

            await _auditLogService.LogAsync(this.BuildAuditEvent(
                AuditActions.ServiceCallReopened,
                AuditEntityTypes.ServiceCall,
                $"Service call '{existingServiceCall.Title}' (#{id}) reopened.",
                entityId: id));

            return Ok(new { message = "Service call reopened successfully." });
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
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
                request.AssignmentRole);

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
                    ["assignmentRole"] = request.AssignmentRole
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

    private WorkItem BuildServiceCall(CreateServiceCallRequestDto request, string? existingStatus = null)
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

        return _workItemTaskService.ApplyCanonicalFields(new WorkItem
        {
            Title = request.Title.Trim(),
            Description = request.Description,
            Status = ResolveTaskStatus(request.Status, existingStatus),
            BillingType = request.BillingType,
            Priority = request.Priority,
            ActualStart = request.ActualStart,
            ActualEnd = request.ActualEnd,
            ActualHours = request.ActualHours,
            RequiredRole = request.RequiredRole,
            IsLocked = request.IsLocked
        }, validationInput);
    }

    private static string ResolveTaskStatus(string? requestedStatus, string? existingStatus = null) =>
        string.IsNullOrWhiteSpace(requestedStatus)
            ? (existingStatus ?? WorkItemDefaultStatuses.Planned)
            : requestedStatus;
}

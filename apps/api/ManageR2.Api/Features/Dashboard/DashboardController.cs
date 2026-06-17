using System.Security.Claims;
using ManageR2.Api.Features.Dashboard.DTOs;
using ManageR2.Infrastructure.Models;
using ManageR2.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Features.Dashboard;

// Single, role-aware entry point for the dashboard command center. Thin by design: it resolves the
// caller's identity/roles from the JWT, delegates all composition and permission filtering to
// DashboardService, and maps the resulting model to DTOs. No business logic and no SQL live here.
//
// The route is intentionally available to every authenticated user (the global fallback policy already
// requires authentication). The returned content is filtered server-side by identity and roles, so no
// dashboard-specific authorization policy is required.
[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;

    public DashboardController(IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    // GET /api/dashboard
    [HttpGet]
    public async Task<ActionResult<DashboardResponseDto>> Get()
    {
        var userIdClaim = User.FindFirst("userId")?.Value;
        if (string.IsNullOrWhiteSpace(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { message = "Invalid user token." });
        }

        int? employeeId = null;
        if (int.TryParse(User.FindFirst("employeeId")?.Value, out var parsedEmployeeId) && parsedEmployeeId > 0)
        {
            employeeId = parsedEmployeeId;
        }

        var roles = User.FindAll(ClaimTypes.Role)
            .Select(claim => claim.Value)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .ToList();

        var displayName =
            User.FindFirst("unique_name")?.Value
            ?? User.Identity?.Name
            ?? User.FindFirst(ClaimTypes.Email)?.Value
            ?? string.Empty;

        var context = new DashboardContext
        {
            UserId = userId,
            EmployeeId = employeeId,
            Roles = roles,
            DisplayName = displayName,
        };

        var model = await _dashboardService.GetDashboardAsync(context);

        return Ok(ToResponseDto(model));
    }

    private static DashboardResponseDto ToResponseDto(DashboardModel model)
    {
        return new DashboardResponseDto
        {
            GeneratedAtUtc = DateTime.UtcNow,
            User = new DashboardUserDto
            {
                DisplayName = model.User.DisplayName,
                RoleLabels = model.User.RoleLabels.ToList(),
                StateSummary = model.User.StateSummary,
            },
            Kpis = model.Kpis.Select(kpi => new DashboardKpiDto
            {
                Id = kpi.Id,
                Label = kpi.Label,
                Value = kpi.Value,
                Context = kpi.Context,
                Tone = kpi.Tone,
                ActionRoute = kpi.ActionRoute,
            }).ToList(),
            PersonalTasksToday = model.PersonalTasksToday.Select(task => new DashboardTaskDto
            {
                WorkItemId = task.WorkItemId,
                Title = task.Title,
                Status = task.Status,
                PlannedStart = task.PlannedStart,
                PlannedEnd = task.PlannedEnd,
                ProjectTitle = task.ProjectTitle,
                CustomerName = task.CustomerName,
                SiteName = task.SiteName,
                ActionRoute = task.ActionRoute,
            }).ToList(),
            Recommendations = model.Recommendations.Select(item => new DashboardActionItemDto
            {
                Id = item.Id,
                Type = item.Type,
                Title = item.Title,
                Description = item.Description,
                Severity = item.Severity,
                PriorityScore = item.PriorityScore,
                EntityType = item.EntityType,
                EntityId = item.EntityId,
                ActionLabel = item.ActionLabel,
                ActionRoute = item.ActionRoute,
                RelevantDate = item.RelevantDate,
                Context = item.Context,
            }).ToList(),
            EarlyWarnings = model.EarlyWarnings.Select(warning => new DashboardWarningDto
            {
                Id = warning.Id,
                Type = warning.Type,
                Title = warning.Title,
                Description = warning.Description,
                Severity = warning.Severity,
                EntityType = warning.EntityType,
                EntityId = warning.EntityId,
                ActionLabel = warning.ActionLabel,
                ActionRoute = warning.ActionRoute,
                RelevantDate = warning.RelevantDate,
                Context = warning.Context,
            }).ToList(),
            RecentActivity = model.RecentActivity.Select(activity => new DashboardActivityDto
            {
                Id = activity.Id,
                Title = activity.Title,
                Description = activity.Description,
                ActorName = activity.ActorName,
                OccurredAtUtc = activity.OccurredAtUtc,
                Severity = activity.Severity,
                EntityType = activity.EntityType,
                EntityId = activity.EntityId,
                ActionRoute = activity.ActionRoute,
            }).ToList(),
        };
    }
}

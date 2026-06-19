using System.Security.Claims;
using ManageR2.Api.Authorization;
using ManageR2.Api.DTOs;
using ManageR2.Api.Features.Audit;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Repositories;
using ManageR2.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ManageR2.Api.Controllers;

// User accounts: login/token issuance, profile CRUD, and admin directory endpoints over IUserRepository + security services.
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    // Persistence for users, roles, departments; used by both admin screens and login flow.
    private readonly IUserRepository _userRepository;
    // Builds signed JWT after successful authentication (claims include userId and roles).
    private readonly IJwtTokenService _jwtTokenService;
    // Hashing/verification only; raw passwords never stored beyond the request boundary.
    private readonly IPasswordService _passwordService;
    // Fine-grained rules (e.g. who may view another user's record) beyond simple role checks.
    private readonly IUserAuthorizationService _userAuthorizationService;
    // Best-effort audit trail for security-sensitive user/login events.
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<UsersController> _logger;

    public UsersController(
        IUserRepository userRepository,
        IJwtTokenService jwtTokenService,
        IPasswordService passwordService,
        IUserAuthorizationService userAuthorizationService,
        IAuditLogService auditLogService,
        ILogger<UsersController> logger)
    {
        _userRepository = userRepository;
        _jwtTokenService = jwtTokenService;
        _passwordService = passwordService;
        _userAuthorizationService = userAuthorizationService;
        _auditLogService = auditLogService;
        _logger = logger;
    }

    // Shapes a User entity into a response DTO without exposing password hash/salt.
    private async Task<UserResponseDto> ToSafeUserAsync(User u)
    {
        var roles = await _userRepository.GetUserRolesAsync(u.UserId);
        var departments = await _userRepository.GetUserDepartmentsAsync(u.UserId);

        return new UserResponseDto
        {
            UserId = u.UserId,
            EmployeeId = u.EmployeeId,
            Username = u.Username,
            Email = u.Email,
            IsActive = u.IsActive,
            LastLoginAt = u.LastLoginAt,
            CreatedAt = u.CreatedAt,
            Roles = roles,
            Departments = departments,
            Phone = u.Phone,
            Notes = u.Notes,
        };
    }

    // Shared input cleanup for role/department name lists (trim, dedupe, case-insensitive).
    private static List<string> NormalizeNamesList(List<string>? values)
    {
        if (values == null || values.Count == 0)
        {
            return new List<string>();
        }

        return values
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    // Admin directory: enumerate all users with roles/departments for back-office management.
    [Authorize(Policy = Policies.CanViewUsers)]
    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _userRepository.GetUsersAsync();

        var response = new List<UserResponseDto>();

        foreach (var user in users)
        {
            response.Add(await ToSafeUserAsync(user));
        }

        return Ok(response);
    }

    // Lookup list for role assignment UI (admin only).
    [Authorize(Policy = Policies.CanViewUsers)]
    [HttpGet("roles")]
    public async Task<IActionResult> GetAllRoles()
    {
        var roles = await _userRepository.GetAllRoleNamesAsync();
        return Ok(roles);
    }

    // Lookup list for department assignment UI (admin only).
    [Authorize(Policy = Policies.CanViewUsers)]
    [HttpGet("departments")]
    public async Task<IActionResult> GetAllDepartments()
    {
        var departments = await _userRepository.GetAllDepartmentNamesAsync();
        return Ok(departments);
    }

    // Self-service or admin view: authorization service decides visibility before repository load.
    [Authorize]
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetUserById(int id)
    {
        var currentUserIdClaim = User.FindFirst("userId")?.Value;
        if (string.IsNullOrWhiteSpace(currentUserIdClaim) || !int.TryParse(currentUserIdClaim, out var currentUserId))
            return Unauthorized(new { message = "Invalid user token." });

        var currentRoles = User.FindAll(ClaimTypes.Role)
            .Select(c => c.Value)
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .ToList();

        var canView = await _userAuthorizationService.CanViewUserAsync(currentUserId, currentRoles, id);
        if (!canView)
            return Forbid();

        var user = await _userRepository.GetUserByIdAsync(id);
        if (user == null)
            return NotFound(new { message = $"User with id {id} was not found." });

        return Ok(await ToSafeUserAsync(user));
    }

    // Create user + hash password + persist role/department links in a single transactional flow (repository).
    [Authorize(Policy = Policies.CanManageUsers)]
    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
    {
        var normalizedRoles = NormalizeNamesList(dto.Roles);
        var normalizedDepartments = NormalizeNamesList(dto.Departments);

        _passwordService.CreatePasswordHash(dto.Password, out var hash, out var salt);

        var user = new User
        {
            EmployeeId = dto.EmployeeId,
            Username = dto.Username.Trim(),
            Email = dto.Email.Trim(),
            PasswordHash = hash,
            PasswordSalt = salt,
            IsActive = dto.IsActive,
            Phone = string.IsNullOrWhiteSpace(dto.Phone) ? null : dto.Phone.Trim(),
            Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim()
        };

        var id = await _userRepository.CreateUserAsync(user);

        await _userRepository.SetUserRolesAsync(id, normalizedRoles);
        await _userRepository.SetUserDepartmentsAsync(id, normalizedDepartments);

        var created = await _userRepository.GetUserByIdAsync(id);

        await _auditLogService.LogAsync(this.BuildAuditEvent(
            AuditActions.UserCreated,
            AuditEntityTypes.User,
            $"User '{user.Username}' (#{id}) created.",
            entityId: id,
            metadata: new Dictionary<string, object?>
            {
                ["username"] = user.Username,
                ["roles"] = normalizedRoles,
                ["departments"] = normalizedDepartments,
                ["isActive"] = user.IsActive
            }));

        return CreatedAtAction(nameof(GetUserById), new { id }, await ToSafeUserAsync(created!));
    }

    // Update profile fields; optional password rotation re-hashes via IPasswordService then updates role/department sets.
    [Authorize(Policy = Policies.CanManageUsers)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserDto dto)
    {
        var existing = await _userRepository.GetUserByIdAsync(id);
        if (existing == null)
            return NotFound(new { message = $"User with id {id} was not found." });

        var normalizedRoles = NormalizeNamesList(dto.Roles);
        var normalizedDepartments = NormalizeNamesList(dto.Departments);
        // Captured before the write so the audit row can flag role changes and (de)activation.
        var previousRoles = await _userRepository.GetUserRolesAsync(id);
        var wasActive = existing.IsActive;

        string hash = existing.PasswordHash;
        string salt = existing.PasswordSalt;

        if (!string.IsNullOrWhiteSpace(dto.Password))
        {
            _passwordService.CreatePasswordHash(dto.Password, out hash, out salt);
        }

        var user = new User
        {
            UserId = id,
            EmployeeId = dto.EmployeeId,
            Username = dto.Username.Trim(),
            Email = dto.Email.Trim(),
            PasswordHash = hash,
            PasswordSalt = salt,
            IsActive = dto.IsActive,
            Phone = string.IsNullOrWhiteSpace(dto.Phone) ? null : dto.Phone.Trim(),
            Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim()
        };

        await _userRepository.UpdateUserAsync(user);

        await _userRepository.SetUserRolesAsync(id, normalizedRoles);
        await _userRepository.SetUserDepartmentsAsync(id, normalizedDepartments);

        var rolesChanged = !previousRoles
            .OrderBy(role => role, StringComparer.OrdinalIgnoreCase)
            .SequenceEqual(
                normalizedRoles.OrderBy(role => role, StringComparer.OrdinalIgnoreCase),
                StringComparer.OrdinalIgnoreCase);
        var deactivated = wasActive && !user.IsActive;
        var passwordChanged = !string.IsNullOrWhiteSpace(dto.Password);

        await _auditLogService.LogAsync(this.BuildAuditEvent(
            AuditActions.UserUpdated,
            AuditEntityTypes.User,
            $"User '{user.Username}' (#{id}) updated.",
            entityId: id,
            severity: (rolesChanged || deactivated) ? AuditSeverity.Warning : AuditSeverity.Info,
            metadata: new Dictionary<string, object?>
            {
                ["username"] = user.Username,
                ["isActive"] = user.IsActive,
                ["deactivated"] = deactivated,
                ["rolesChanged"] = rolesChanged,
                ["previousRoles"] = previousRoles,
                ["newRoles"] = normalizedRoles,
                ["passwordChanged"] = passwordChanged
            }));

        var updated = await _userRepository.GetUserByIdAsync(id);
        return Ok(await ToSafeUserAsync(updated!));
    }

    // Hard delete user row through repository (guarded by domain validation exceptions).
    [Authorize(Policy = Policies.CanManageUsers)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var existing = await _userRepository.GetUserByIdAsync(id);
        if (existing == null)
            return NotFound(new { message = $"User with id {id} was not found." });

        await _userRepository.DeleteUserAsync(id);

        await _auditLogService.LogAsync(this.BuildAuditEvent(
            AuditActions.UserDeleted,
            AuditEntityTypes.User,
            $"User '{existing.Username}' (#{id}) deleted.",
            entityId: id,
            severity: AuditSeverity.Warning,
            metadata: new Dictionary<string, object?>
            {
                ["username"] = existing.Username
            }));

        return NoContent();
    }

    // Restore a soft-deleted user with an explicit, admin-selected role/department set. This is NOT a
    // blanket reactivation of every historical assignment: the repository/SP sync to exactly the
    // chosen sets in one transaction. At least one role is required (a user with no role has no access).
    [Authorize(Policy = Policies.CanManageUsers)]
    [HttpPost("{id:int}/restore")]
    public async Task<IActionResult> RestoreUser(int id, [FromBody] RestoreUserDto dto)
    {
        var existing = await _userRepository.GetUserByIdAsync(id);
        if (existing == null)
            return NotFound(new { message = $"User with id {id} was not found." });

        var normalizedRoles = NormalizeNamesList(dto.Roles);
        var normalizedDepartments = NormalizeNamesList(dto.Departments);

        if (normalizedRoles.Count == 0)
            return BadRequest(new { message = "At least one role is required to restore a user." });

        await _userRepository.RestoreUserAsync(id, normalizedRoles, normalizedDepartments);

        await _auditLogService.LogAsync(this.BuildAuditEvent(
            AuditActions.UserRestored,
            AuditEntityTypes.User,
            $"User '{existing.Username}' (#{id}) restored.",
            entityId: id,
            severity: AuditSeverity.Warning,
            metadata: new Dictionary<string, object?>
            {
                ["username"] = existing.Username,
                ["restoredRoles"] = normalizedRoles,
                ["restoredDepartments"] = normalizedDepartments
            }));

        var restored = await _userRepository.GetUserByIdAsync(id);
        return Ok(await ToSafeUserAsync(restored!));
    }

    // Public login: verify credentials, block inactive users, refresh last login, return JWT + role/department claims payload.
    // Rate limited per client IP (see the "login" policy in Program.cs) and backed by account lockout for defense-in-depth.
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto dto)
    {
        var email = dto.Email.Trim().ToLower();

        var user = await _userRepository.GetUserByEmailAsync(email);
        if (user == null)
        {
            // Unknown e-mail: record the attempt with no UserId. The e-mail is not a secret, but never
            // log the supplied password.
            await _auditLogService.LogAsync(this.BuildAuditEvent(
                AuditActions.LoginFailed,
                AuditEntityTypes.User,
                $"Login failed: no account for '{email}'.",
                severity: AuditSeverity.Warning,
                metadata: new Dictionary<string, object?> { ["attemptedEmail"] = email, ["reason"] = "UnknownEmail" },
                userIdOverride: null));

            return Unauthorized(new { message = "Invalid email or password." });
        }

        // Reject locked accounts before checking the password so brute-force attempts cannot succeed
        // even with the correct credentials during the lockout window.
        var lockoutEndUtc = await _userRepository.GetLockoutEndUtcAsync(user.UserId);
        if (lockoutEndUtc.HasValue && lockoutEndUtc.Value > DateTime.UtcNow)
        {
            await _auditLogService.LogAsync(this.BuildAuditEvent(
                AuditActions.AccountLockoutBlocked,
                AuditEntityTypes.User,
                $"Login blocked: account '{user.Username}' (#{user.UserId}) is locked out.",
                entityId: user.UserId,
                severity: AuditSeverity.Warning,
                metadata: new Dictionary<string, object?> { ["lockoutEndUtc"] = lockoutEndUtc.Value },
                userIdOverride: user.UserId));

            return StatusCode(
                StatusCodes.Status423Locked,
                new { message = "Account temporarily locked due to multiple failed login attempts. Please try again later." });
        }

        var isValid = _passwordService.VerifyPassword(dto.Password, user.PasswordHash, user.PasswordSalt);
        if (!isValid)
        {
            await _userRepository.RegisterFailedLoginAsync(user.UserId);

            await _auditLogService.LogAsync(this.BuildAuditEvent(
                AuditActions.LoginFailed,
                AuditEntityTypes.User,
                $"Login failed: wrong password for '{user.Username}' (#{user.UserId}).",
                entityId: user.UserId,
                severity: AuditSeverity.Warning,
                metadata: new Dictionary<string, object?> { ["reason"] = "InvalidPassword" },
                userIdOverride: user.UserId));

            return Unauthorized(new { message = "Invalid email or password." });
        }

        if (!user.IsActive)
        {
            await _auditLogService.LogAsync(this.BuildAuditEvent(
                AuditActions.LoginFailed,
                AuditEntityTypes.User,
                $"Login failed: account '{user.Username}' (#{user.UserId}) is inactive.",
                entityId: user.UserId,
                severity: AuditSeverity.Warning,
                metadata: new Dictionary<string, object?> { ["reason"] = "InactiveUser" },
                userIdOverride: user.UserId));

            return StatusCode(StatusCodes.Status403Forbidden, new { message = "User is inactive and cannot log in." });
        }

        await _userRepository.ClearFailedLoginAsync(user.UserId);
        await _userRepository.UpdateLastLoginAtAsync(user.UserId);

        var refreshedUser = await _userRepository.GetUserByIdAsync(user.UserId);
        if (refreshedUser == null)
            return Unauthorized(new { message = "Failed to reload user after login." });

        var roles = await _userRepository.GetUserRolesAsync(refreshedUser.UserId);
        var departments = await _userRepository.GetUserDepartmentsAsync(refreshedUser.UserId);
        var token = _jwtTokenService.GenerateToken(refreshedUser, roles);

        await _auditLogService.LogAsync(this.BuildAuditEvent(
            AuditActions.LoginSucceeded,
            AuditEntityTypes.User,
            $"User '{refreshedUser.Username}' (#{refreshedUser.UserId}) logged in.",
            entityId: refreshedUser.UserId,
            metadata: new Dictionary<string, object?> { ["roles"] = roles },
            userIdOverride: refreshedUser.UserId));

        return Ok(new LoginResponseDto
        {
            UserId = refreshedUser.UserId,
            EmployeeId = refreshedUser.EmployeeId,
            Username = refreshedUser.Username,
            Email = refreshedUser.Email,
            IsActive = refreshedUser.IsActive,
            Token = token,
            Roles = roles,
            Departments = departments
        });
    }
}

using System.Security.Claims;
using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
using ManageR2.Infrastructure.Repositories;
using ManageR2.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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
    private readonly ILogger<UsersController> _logger;

    public UsersController(
        IUserRepository userRepository,
        IJwtTokenService jwtTokenService,
        IPasswordService passwordService,
        IUserAuthorizationService userAuthorizationService,
        ILogger<UsersController> logger)
    {
        _userRepository = userRepository;
        _jwtTokenService = jwtTokenService;
        _passwordService = passwordService;
        _userAuthorizationService = userAuthorizationService;
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

    // Centralized create validation to keep action methods focused on orchestration and HTTP status mapping.
    private static string? ValidateCreateUserDto(CreateUserDto? dto)
    {
        if (dto == null)
        {
            return "User data is required.";
        }

        if (dto.EmployeeId <= 0)
        {
            return "EmployeeId must be greater than 0.";
        }

        if (string.IsNullOrWhiteSpace(dto.Username))
        {
            return "Username is required.";
        }

        if (string.IsNullOrWhiteSpace(dto.Email))
        {
            return "Email is required.";
        }

        if (string.IsNullOrWhiteSpace(dto.Password))
        {
            return "Password is required.";
        }

        var roles = NormalizeNamesList(dto.Roles);
        if (roles.Count == 0)
        {
            return "At least one role is required.";
        }

        var departments = NormalizeNamesList(dto.Departments);
        if (departments.Count == 0)
        {
            return "At least one department is required.";
        }

        return null;
    }

    // Update validation mirrors create rules except password is optional on edit.
    private static string? ValidateUpdateUserDto(UpdateUserDto? dto)
    {
        if (dto == null)
        {
            return "User data is required.";
        }

        if (dto.EmployeeId <= 0)
        {
            return "EmployeeId must be greater than 0.";
        }

        if (string.IsNullOrWhiteSpace(dto.Username))
        {
            return "Username is required.";
        }

        if (string.IsNullOrWhiteSpace(dto.Email))
        {
            return "Email is required.";
        }

        var roles = NormalizeNamesList(dto.Roles);
        if (roles.Count == 0)
        {
            return "At least one role is required.";
        }

        var departments = NormalizeNamesList(dto.Departments);
        if (departments.Count == 0)
        {
            return "At least one department is required.";
        }

        return null;
    }

    // Admin directory: enumerate all users with roles/departments for back-office management.
    [Authorize(Roles = "Admin")]
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
    [Authorize(Roles = "Admin")]
    [HttpGet("roles")]
    public async Task<IActionResult> GetAllRoles()
    {
        var roles = await _userRepository.GetAllRoleNamesAsync();
        return Ok(roles);
    }

    // Lookup list for department assignment UI (admin only).
    [Authorize(Roles = "Admin")]
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
    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
    {
        var validationError = ValidateCreateUserDto(dto);
        if (validationError != null)
        {
            return BadRequest(new { message = validationError });
        }

        var normalizedRoles = NormalizeNamesList(dto.Roles);
        var normalizedDepartments = NormalizeNamesList(dto.Departments);

        try
        {
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

            return CreatedAtAction(nameof(GetUserById), new { id }, await ToSafeUserAsync(created!));
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // Update profile fields; optional password rotation re-hashes via IPasswordService then updates role/department sets.
    [Authorize(Roles = "Admin")]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserDto dto)
    {
        var validationError = ValidateUpdateUserDto(dto);
        if (validationError != null)
        {
            return BadRequest(new { message = validationError });
        }

        var existing = await _userRepository.GetUserByIdAsync(id);
        if (existing == null)
            return NotFound(new { message = $"User with id {id} was not found." });

        var normalizedRoles = NormalizeNamesList(dto.Roles);
        var normalizedDepartments = NormalizeNamesList(dto.Departments);

        try
        {
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

            var updated = await _userRepository.GetUserByIdAsync(id);
            return Ok(await ToSafeUserAsync(updated!));
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // Hard delete user row through repository (guarded by domain validation exceptions).
    [Authorize(Roles = "Admin")]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var existing = await _userRepository.GetUserByIdAsync(id);
        if (existing == null)
            return NotFound(new { message = $"User with id {id} was not found." });

        try
        {
            await _userRepository.DeleteUserAsync(id);
            return NoContent();
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // Public login: verify credentials, block inactive users, refresh last login, return JWT + role/department claims payload.
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Email))
            return BadRequest(new { message = "Email is required." });

        if (string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest(new { message = "Password is required." });

        var email = dto.Email.Trim().ToLower();

        var user = await _userRepository.GetUserByEmailAsync(email);
        if (user == null)
            return Unauthorized(new { message = "Invalid email or password." });

        var isValid = _passwordService.VerifyPassword(dto.Password, user.PasswordHash, user.PasswordSalt);
        if (!isValid)
            return Unauthorized(new { message = "Invalid email or password." });

        if (!user.IsActive)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "User is inactive and cannot log in." });

        await _userRepository.UpdateLastLoginAtAsync(user.UserId);

        var refreshedUser = await _userRepository.GetUserByIdAsync(user.UserId);
        if (refreshedUser == null)
            return Unauthorized(new { message = "Failed to reload user after login." });

        var roles = await _userRepository.GetUserRolesAsync(refreshedUser.UserId);
        var departments = await _userRepository.GetUserDepartmentsAsync(refreshedUser.UserId);
        var token = _jwtTokenService.GenerateToken(refreshedUser, roles);

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
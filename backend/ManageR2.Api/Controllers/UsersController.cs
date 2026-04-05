using System.Security.Claims;
using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Repositories;
using ManageR2.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly IUserRepository _userRepository;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly IPasswordService _passwordService;
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

    [Authorize(Roles = "Admin")]
    [HttpGet("roles")]
    public async Task<IActionResult> GetAllRoles()
    {
        var roles = await _userRepository.GetAllRoleNamesAsync();
        return Ok(roles);
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("departments")]
    public async Task<IActionResult> GetAllDepartments()
    {
        var departments = await _userRepository.GetAllDepartmentNamesAsync();
        return Ok(departments);
    }

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

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest(new { message = "Password is required." });

        _passwordService.CreatePasswordHash(dto.Password, out var hash, out var salt);

        var user = new User
        {
            EmployeeId = dto.EmployeeId,
            Username = dto.Username,
            Email = dto.Email,
            PasswordHash = hash,
            PasswordSalt = salt,
            IsActive = dto.IsActive,
            Phone = dto.Phone,
            Notes = dto.Notes
        };

        var id = await _userRepository.CreateUserAsync(user);

        await _userRepository.SetUserRolesAsync(id, dto.Roles);
        await _userRepository.SetUserDepartmentsAsync(id, dto.Departments);

        var created = await _userRepository.GetUserByIdAsync(id);

        return CreatedAtAction(nameof(GetUserById), new { id }, await ToSafeUserAsync(created!));
    }

    [Authorize]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserDto dto)
    {
        var existing = await _userRepository.GetUserByIdAsync(id);
        if (existing == null)
            return NotFound(new { message = $"User with id {id} was not found." });

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
            Username = dto.Username,
            Email = dto.Email,
            PasswordHash = hash,
            PasswordSalt = salt,
            IsActive = dto.IsActive,
            Phone = dto.Phone,
            Notes = dto.Notes
        };

        await _userRepository.UpdateUserAsync(user);

        await _userRepository.SetUserRolesAsync(id, dto.Roles);
        await _userRepository.SetUserDepartmentsAsync(id, dto.Departments);

        var updated = await _userRepository.GetUserByIdAsync(id);
        return Ok(await ToSafeUserAsync(updated!));
    }

    [Authorize]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var existing = await _userRepository.GetUserByIdAsync(id);
        if (existing == null)
            return NotFound(new { message = $"User with id {id} was not found." });

        await _userRepository.DeleteUserAsync(id);
        return NoContent();
    }

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
            Username = refreshedUser.Username,
            Email = refreshedUser.Email,
            IsActive = refreshedUser.IsActive,
            Token = token,
            Roles = roles,
            Departments = departments
        });
    }
}
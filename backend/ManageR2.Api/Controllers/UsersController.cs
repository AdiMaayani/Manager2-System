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

    private static UserResponseDto ToSafeUser(User u)
    {
        return new UserResponseDto
        {
            UserId = u.UserId,
            EmployeeId = u.EmployeeId,
            Username = u.Username,
            Email = u.Email,
            IsActive = u.IsActive,
            LastLoginAt = u.LastLoginAt,
            CreatedAt = u.CreatedAt
        };
    }

    [Authorize(Roles = "Admin")]
    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _userRepository.GetUsersAsync();
        return Ok(users.Select(ToSafeUser));
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

        return Ok(ToSafeUser(user));
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
            IsActive = dto.IsActive
        };

        var id = await _userRepository.CreateUserAsync(user);
        var created = await _userRepository.GetUserByIdAsync(id);

        return CreatedAtAction(nameof(GetUserById), new { id }, ToSafeUser(created!));
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
            IsActive = dto.IsActive
        };

        await _userRepository.UpdateUserAsync(user);

        var updated = await _userRepository.GetUserByIdAsync(id);
        return Ok(ToSafeUser(updated!));
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

        var roles = await _userRepository.GetUserRolesAsync(user.UserId);
        var departments = await _userRepository.GetUserDepartmentsAsync(user.UserId);
        var token = _jwtTokenService.GenerateToken(user, roles);

        return Ok(new LoginResponseDto
        {
            UserId = user.UserId,
            Username = user.Username,
            Email = user.Email,
            IsActive = user.IsActive,
            Token = token,
            Roles = roles,
            Departments = departments
        });
    }
}
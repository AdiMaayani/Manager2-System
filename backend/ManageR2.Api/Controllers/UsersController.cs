using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly IUserRepository _userRepository;

    public UsersController(IUserRepository userRepository)
    {
        _userRepository = userRepository;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _userRepository.GetUsersAsync();
        return Ok(users);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetUserById(int id)
    {
        var user = await _userRepository.GetUserByIdAsync(id);

        if (user is null)
        {
            return NotFound();
        }

        return Ok(user);
    }

    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
    {
        var user = new User
        {
            EmployeeId = dto.EmployeeId,
            Username = dto.Username,
            Email = dto.Email,
            PasswordHash = dto.PasswordHash,
            IsActive = dto.IsActive
        };

        var newUserId = await _userRepository.CreateUserAsync(user);

        var createdUser = await _userRepository.GetUserByIdAsync(newUserId);

        if (createdUser is null)
        {
            return StatusCode(500, "User was created but could not be retrieved.");
        }

        return CreatedAtAction(nameof(GetUserById), new { id = newUserId }, createdUser);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserDto dto)
    {
        var existingUser = await _userRepository.GetUserByIdAsync(id);

        if (existingUser is null)
        {
            return NotFound();
        }

        var userToUpdate = new User
        {
            UserId = id,
            EmployeeId = dto.EmployeeId,
            Username = dto.Username,
            Email = dto.Email,
            PasswordHash = dto.PasswordHash,
            IsActive = dto.IsActive
        };

        var updated = await _userRepository.UpdateUserAsync(userToUpdate);

        if (!updated)
        {
            return StatusCode(500, "User update failed.");
        }

        var updatedUser = await _userRepository.GetUserByIdAsync(id);

        if (updatedUser is null)
        {
            return StatusCode(500, "User was updated but could not be retrieved.");
        }

        return Ok(updatedUser);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var existingUser = await _userRepository.GetUserByIdAsync(id);

        if (existingUser is null)
        {
            return NotFound();
        }

        var deleted = await _userRepository.DeleteUserAsync(id);

        if (!deleted)
        {
            return StatusCode(500, "User delete failed.");
        }

        return NoContent();
    }
}
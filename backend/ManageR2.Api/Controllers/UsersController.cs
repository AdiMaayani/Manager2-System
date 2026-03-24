using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Exceptions;
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
        try
        {
            var users = await _userRepository.GetUsersAsync();
            return Ok(users);
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception)
        {
            return BadRequest(new { message = "Failed to retrieve users." });
        }
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetUserById(int id)
    {
        try
        {
            var user = await _userRepository.GetUserByIdAsync(id);

            if (user is null)
            {
                return NotFound(new { message = $"User with id {id} was not found." });
            }

            return Ok(user);
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception)
        {
            return BadRequest(new { message = "Failed to retrieve the requested user." });
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
    {
        try
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
                return BadRequest(new { message = "User was created but could not be retrieved." });
            }

            return CreatedAtAction(nameof(GetUserById), new { id = newUserId }, createdUser);
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception)
        {
            return BadRequest(new { message = "Failed to create the user." });
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserDto dto)
    {
        try
        {
            var existingUser = await _userRepository.GetUserByIdAsync(id);

            if (existingUser is null)
            {
                return NotFound(new { message = $"User with id {id} was not found." });
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
                return BadRequest(new { message = "User update failed." });
            }

            var updatedUser = await _userRepository.GetUserByIdAsync(id);

            if (updatedUser is null)
            {
                return BadRequest(new { message = "User was updated but could not be retrieved." });
            }

            return Ok(updatedUser);
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception)
        {
            return BadRequest(new { message = "Failed to update the user." });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        try
        {
            var existingUser = await _userRepository.GetUserByIdAsync(id);

            if (existingUser is null)
            {
                return NotFound(new { message = $"User with id {id} was not found." });
            }

            var deleted = await _userRepository.DeleteUserAsync(id);

            if (!deleted)
            {
                return BadRequest(new { message = "User delete failed." });
            }

            return NoContent();
        }
        catch (UserValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception)
        {
            return BadRequest(new { message = "Failed to delete the user." });
        }
    }
}
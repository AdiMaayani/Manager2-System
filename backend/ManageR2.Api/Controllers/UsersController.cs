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
    private readonly ILogger<UsersController> _logger;

    public UsersController(IUserRepository userRepository, ILogger<UsersController> logger)
    {
        _userRepository = userRepository;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        _logger.LogInformation("GetUsers started.");

        try
        {
            var users = await _userRepository.GetUsersAsync();

            _logger.LogInformation("GetUsers succeeded. Returned {UsersCount} users.", users.Count());

            return Ok(users);
        }
        catch (UserValidationException ex)
        {
            _logger.LogWarning(ex, "GetUsers failed with validation error.");

            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetUsers failed with unexpected error.");

            return BadRequest(new { message = "Failed to retrieve users." });
        }
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetUserById(int id)
    {
        _logger.LogInformation("GetUserById started for UserId={UserId}.", id);

        try
        {
            var user = await _userRepository.GetUserByIdAsync(id);

            if (user is null)
            {
                _logger.LogWarning("GetUserById returned NotFound for UserId={UserId}.", id);

                return NotFound(new { message = $"User with id {id} was not found." });
            }

            _logger.LogInformation("GetUserById succeeded for UserId={UserId}.", id);

            return Ok(user);
        }
        catch (UserValidationException ex)
        {
            _logger.LogWarning(ex, "GetUserById failed with validation error for UserId={UserId}.", id);

            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetUserById failed with unexpected error for UserId={UserId}.", id);

            return BadRequest(new { message = "Failed to retrieve the requested user." });
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
    {
        _logger.LogInformation(
            "CreateUser started for Username={Username}, Email={Email}, EmployeeId={EmployeeId}.",
            dto.Username,
            dto.Email,
            dto.EmployeeId);

        try
        {
            var userToCreate = new User
            {
                EmployeeId = dto.EmployeeId,
                Username = dto.Username,
                Email = dto.Email,
                PasswordHash = dto.PasswordHash,
                IsActive = dto.IsActive
            };

            var newUserId = await _userRepository.CreateUserAsync(userToCreate);
            var createdUser = await _userRepository.GetUserByIdAsync(newUserId);

            if (createdUser is null)
            {
                _logger.LogWarning(
                    "CreateUser created UserId={UserId}, but failed to retrieve the created user.",
                    newUserId);

                return BadRequest(new { message = "User was created but could not be retrieved." });
            }

            _logger.LogInformation("CreateUser succeeded for UserId={UserId}.", newUserId);

            return CreatedAtAction(nameof(GetUserById), new { id = newUserId }, createdUser);
        }
        catch (UserValidationException ex)
        {
            _logger.LogWarning(
                ex,
                "CreateUser failed with validation error for Email={Email}, EmployeeId={EmployeeId}.",
                dto.Email,
                dto.EmployeeId);

            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "CreateUser failed with unexpected error for Email={Email}, EmployeeId={EmployeeId}.",
                dto.Email,
                dto.EmployeeId);

            return BadRequest(new { message = "Failed to create the user." });
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserDto dto)
    {
        _logger.LogInformation(
            "UpdateUser started for UserId={UserId}, Email={Email}, EmployeeId={EmployeeId}.",
            id,
            dto.Email,
            dto.EmployeeId);

        try
        {
            var existingUser = await _userRepository.GetUserByIdAsync(id);

            if (existingUser is null)
            {
                _logger.LogWarning("UpdateUser returned NotFound for UserId={UserId}.", id);

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

            var wasUpdated = await _userRepository.UpdateUserAsync(userToUpdate);

            if (!wasUpdated)
            {
                _logger.LogWarning("UpdateUser failed because repository returned false for UserId={UserId}.", id);

                return BadRequest(new { message = "User update failed." });
            }

            var updatedUser = await _userRepository.GetUserByIdAsync(id);

            if (updatedUser is null)
            {
                _logger.LogWarning(
                    "UpdateUser succeeded in repository but failed to retrieve updated user for UserId={UserId}.",
                    id);

                return BadRequest(new { message = "User was updated but could not be retrieved." });
            }

            _logger.LogInformation("UpdateUser succeeded for UserId={UserId}.", id);

            return Ok(updatedUser);
        }
        catch (UserValidationException ex)
        {
            _logger.LogWarning(ex, "UpdateUser failed with validation error for UserId={UserId}.", id);

            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "UpdateUser failed with unexpected error for UserId={UserId}.", id);

            return BadRequest(new { message = "Failed to update the user." });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        _logger.LogInformation("DeleteUser started for UserId={UserId}.", id);

        try
        {
            var existingUser = await _userRepository.GetUserByIdAsync(id);

            if (existingUser is null)
            {
                _logger.LogWarning("DeleteUser returned NotFound for UserId={UserId}.", id);

                return NotFound(new { message = $"User with id {id} was not found." });
            }

            var wasDeleted = await _userRepository.DeleteUserAsync(id);

            if (!wasDeleted)
            {
                _logger.LogWarning("DeleteUser failed because repository returned false for UserId={UserId}.", id);

                return BadRequest(new { message = "User delete failed." });
            }

            _logger.LogInformation("DeleteUser succeeded for UserId={UserId}.", id);

            return NoContent();
        }
        catch (UserValidationException ex)
        {
            _logger.LogWarning(ex, "DeleteUser failed with validation error for UserId={UserId}.", id);

            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DeleteUser failed with unexpected error for UserId={UserId}.", id);

            return BadRequest(new { message = "Failed to delete the user." });
        }
    }
}
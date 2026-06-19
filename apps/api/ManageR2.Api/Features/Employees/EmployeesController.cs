using ManageR2.Api.Authorization;
using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
// Employee endpoints used for roster management and assignment lookups.
public class EmployeesController : ControllerBase
{
    private readonly IEmployeeRepository _employeeRepository;

    public EmployeesController(IEmployeeRepository employeeRepository)
    {
        _employeeRepository = employeeRepository;
    }

    [Authorize(Policy = Policies.CanViewEmployees)]
    [HttpGet]
    // Full employee roster (includes contact details); restricted to the employee-management audience.
    public async Task<IActionResult> GetAll()
    {
        var employees = await _employeeRepository.GetAllAsync();
        return Ok(employees.Select(ToDto));
    }

    [Authorize(Policy = Policies.CanLookupEmployees)]
    [HttpGet("lookup")]
    // Minimal employee list for selection pickers (work plan, reports, service-call/project assignment).
    // Returns only id/display/scheduling fields — no contact PII — so it can be exposed to more roles.
    public async Task<IActionResult> GetLookup()
    {
        var employees = await _employeeRepository.GetAllAsync();
        return Ok(employees.Select(ToLookupDto));
    }

    [Authorize(Policy = Policies.CanLookupEmployees)]
    [HttpGet("primary-roles")]
    public async Task<IActionResult> GetDistinctPrimaryRoles()
    {
        var roles = await _employeeRepository.GetDistinctPrimaryRolesAsync();
        return Ok(roles);
    }

    [Authorize(Policy = Policies.CanViewEmployees)]
    [HttpGet("{id:int}")]
    // Returns one employee used in assignment validation flows.
    public async Task<IActionResult> GetById(int id)
    {
        var employee = await _employeeRepository.GetByIdAsync(id);

        if (employee == null)
        {
            return NotFound(new { message = $"Employee with id {id} was not found." });
        }

        return Ok(ToDto(employee));
    }

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertEmployeeRequestDto dto)
    {
        var employee = ToEntity(dto);
        var newEmployeeId = await _employeeRepository.CreateAsync(employee);
        var createdEmployee = await _employeeRepository.GetByIdAsync(newEmployeeId);

        if (createdEmployee == null)
        {
            return BadRequest(new { message = "Employee was created but could not be reloaded." });
        }

        return CreatedAtAction(nameof(GetById), new { id = newEmployeeId }, ToDto(createdEmployee));
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpsertEmployeeRequestDto dto)
    {
        var existingEmployee = await _employeeRepository.GetByIdAsync(id);
        if (existingEmployee == null)
        {
            return NotFound(new { message = $"Employee with id {id} was not found." });
        }

        var employee = ToEntity(dto);
        employee.EmployeeId = id;

        var wasUpdated = await _employeeRepository.UpdateAsync(employee);
        if (!wasUpdated)
        {
            return BadRequest(new { message = "Failed to update employee." });
        }

        var updatedEmployee = await _employeeRepository.GetByIdAsync(id);
        return Ok(ToDto(updatedEmployee!));
    }

    [Authorize(Roles = "Admin")]
    [HttpPatch("{id:int}/active-status")]
    public async Task<IActionResult> SetActiveStatus(int id, [FromBody] SetEmployeeActiveStatusRequestDto dto)
    {
        var existingEmployee = await _employeeRepository.GetByIdAsync(id);
        if (existingEmployee == null)
        {
            return NotFound(new { message = $"Employee with id {id} was not found." });
        }

        var wasUpdated = await _employeeRepository.SetActiveStatusAsync(id, dto.IsActive);
        if (!wasUpdated)
        {
            return BadRequest(new { message = "Failed to update employee active status." });
        }

        var updatedEmployee = await _employeeRepository.GetByIdAsync(id);
        return Ok(ToDto(updatedEmployee!));
    }

    private static EmployeeDto ToDto(Employee employee)
    {
        return new EmployeeDto
        {
            EmployeeId = employee.EmployeeId,
            FullName = employee.FullName,
            PrimaryRole = employee.PrimaryRole,
            Phone = employee.Phone,
            Email = employee.Email,
            DailyCapacityHours = employee.DailyCapacityHours,
            IsAssignable = employee.IsAssignable,
            IsActive = employee.IsActive,
            CreatedAt = employee.CreatedAt
        };
    }

    private static EmployeeLookupDto ToLookupDto(Employee employee)
    {
        return new EmployeeLookupDto
        {
            EmployeeId = employee.EmployeeId,
            FullName = employee.FullName,
            PrimaryRole = employee.PrimaryRole,
            DailyCapacityHours = employee.DailyCapacityHours,
            IsAssignable = employee.IsAssignable,
            IsActive = employee.IsActive
        };
    }

    private static Employee ToEntity(UpsertEmployeeRequestDto dto)
    {
        return new Employee
        {
            FullName = dto.FullName.Trim(),
            PrimaryRole = dto.PrimaryRole.Trim(),
            Phone = CleanOptionalValue(dto.Phone),
            Email = CleanOptionalValue(dto.Email),
            DailyCapacityHours = dto.DailyCapacityHours,
            IsAssignable = dto.IsAssignable,
            IsActive = dto.IsActive
        };
    }

    private static string? CleanOptionalValue(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}

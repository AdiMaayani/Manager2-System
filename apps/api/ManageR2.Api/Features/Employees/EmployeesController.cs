using ManageR2.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
// Employee lookup endpoints used when validating and displaying work item assignments.
public class EmployeesController : ControllerBase
{
    // Read-only employee queries; registered in Program.cs and implemented in Infrastructure repositories.
    private readonly IEmployeeRepository _employeeRepository;

    public EmployeesController(IEmployeeRepository employeeRepository)
    {
        _employeeRepository = employeeRepository;
    }

    [HttpGet]
    // Returns all employees that can be assigned to work items.
    public async Task<IActionResult> GetAll()
    {
        var employees = await _employeeRepository.GetAllAsync();
        return Ok(employees);
    }

    [HttpGet("{id:int}")]
    // Returns one employee used in assignment validation flows.
    public async Task<IActionResult> GetById(int id)
    {
        var employee = await _employeeRepository.GetByIdAsync(id);

        if (employee == null)
        {
            return NotFound(new { message = $"Employee with id {id} was not found." });
        }

        return Ok(employee);
    }
}
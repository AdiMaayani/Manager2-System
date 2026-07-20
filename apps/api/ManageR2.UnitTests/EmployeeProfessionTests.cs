using ManageR2.Api.Controllers;
using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Domain.Features.SmartAssignment;
using ManageR2.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace ManageR2.UnitTests;

public sealed class EmployeeProfessionTests
{
    [Fact]
    public void LegacyScalarUpdate_ReplacesCompatibilityRoleWithoutDroppingSecondaryRoles()
    {
        var roles = ProfessionCollection.ResolveForUpdate(
            collection: null,
            legacyValue: "New primary",
            existingCollection: ["Old primary", "Secondary"],
            existingLegacyValue: "Old primary");

        Assert.Equal(["New primary", "Secondary"], roles);
    }

    [Fact]
    public void ExplicitEmptyCollection_IsAuthoritativeOnUpdate()
    {
        var roles = ProfessionCollection.ResolveForUpdate(
            collection: [],
            legacyValue: "Legacy value",
            existingCollection: ["Existing", "Secondary"],
            existingLegacyValue: "Existing");

        Assert.Empty(roles);
    }

    [Fact]
    public void ExplicitLegacyNull_ClearsRolesWhileOmittedLegacyFieldPreservesThem()
    {
        var existing = new[] { "Existing", "Secondary" };

        var explicitClear = ProfessionCollection.ResolveForUpdate(
            collection: null,
            legacyValue: null,
            existingCollection: existing,
            existingLegacyValue: "Existing",
            legacyValueWasProvided: true);
        var omitted = ProfessionCollection.ResolveForUpdate(
            collection: null,
            legacyValue: null,
            existingCollection: existing,
            existingLegacyValue: "Existing");

        Assert.Empty(explicitClear);
        Assert.Equal(existing, omitted);
    }

    [Fact]
    public async Task LegacyUpdate_PreservesSecondaryProfessionsAndReplacesOldPrimary()
    {
        var existing = new Employee
        {
            EmployeeId = 7,
            FullName = "Employee",
            PrimaryRole = "Old primary",
            Professions = ["Old primary", "Secondary"],
            IsActive = true,
            IsAssignable = true
        };
        Employee? captured = null;
        var repository = new Mock<IEmployeeRepository>();
        repository
            .SetupSequence(value => value.GetByIdAsync(7))
            .ReturnsAsync(existing)
            .ReturnsAsync(() => captured);
        repository
            .Setup(value => value.UpdateAsync(It.IsAny<Employee>()))
            .Callback<Employee>(employee => captured = employee)
            .ReturnsAsync(true);
        var controller = new EmployeesController(repository.Object);
        var request = new UpsertEmployeeRequestDto
        {
            FullName = "Employee",
            PrimaryRole = "New primary",
            Professions = null,
            IsActive = true,
            IsAssignable = true
        };

        var result = await controller.Update(7, request);

        Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(captured);
        Assert.Equal("New primary", captured.PrimaryRole);
        Assert.Equal(["New primary", "Secondary"], captured.Professions);
        Assert.DoesNotContain("Old primary", captured.Professions);
    }

    [Fact]
    public async Task ExplicitProfessions_AreCanonicalizedAndAlwaysIncludePrimary()
    {
        Employee? captured = null;
        var repository = new Mock<IEmployeeRepository>();
        repository
            .Setup(value => value.CreateAsync(It.IsAny<Employee>()))
            .Callback<Employee>(employee => captured = employee)
            .ReturnsAsync(7);
        repository
            .Setup(value => value.GetByIdAsync(7))
            .ReturnsAsync(() => captured);
        var controller = new EmployeesController(repository.Object);
        var request = new UpsertEmployeeRequestDto
        {
            FullName = "Employee",
            PrimaryRole = "Harness Technician",
            Professions = [" Communications Technician ", "harness technician"],
            IsActive = true,
            IsAssignable = true
        };

        var result = await controller.Create(request);

        Assert.IsType<CreatedAtActionResult>(result);
        Assert.NotNull(captured);
        Assert.Equal(
            ["Communications Technician", "Harness Technician"],
            captured.Professions);
    }
}

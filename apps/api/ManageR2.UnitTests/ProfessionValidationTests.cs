using FluentValidation.TestHelper;
using ManageR2.Api.DTOs;
using ManageR2.Api.Features.Employees.Validators;
using ManageR2.Api.Features.ServiceCalls.DTOs;
using ManageR2.Api.Features.ServiceCalls.Validators;
using ManageR2.Api.Features.SmartAssignment.Validators;
using ManageR2.Api.Features.WorkItems.Validators;

namespace ManageR2.UnitTests;

public sealed class ProfessionValidationTests
{
    private static readonly string TooLongRole = new('x', 101);

    [Fact]
    public void EmployeePrimaryRole_RejectsMoreThanDatabaseLimit()
    {
        var result = new UpsertEmployeeRequestDtoValidator().TestValidate(
            new UpsertEmployeeRequestDto
            {
                FullName = "Employee",
                PrimaryRole = TooLongRole
            });

        result.ShouldHaveValidationErrorFor(request => request.PrimaryRole);
    }

    [Fact]
    public void WorkItemLegacyRequiredRole_RejectsMoreThanDatabaseLimit()
    {
        var result = new CreateTaskRequestValidator().TestValidate(
            new CreateTaskRequest { RequiredRole = TooLongRole });

        result.ShouldHaveValidationErrorFor(request => request.RequiredRole);
    }

    [Fact]
    public void ServiceCallLegacyRequiredRole_RejectsMoreThanDatabaseLimit()
    {
        var result = new CreateServiceCallRequestDtoValidator().TestValidate(
            new CreateServiceCallRequestDto { RequiredRole = TooLongRole });

        result.ShouldHaveValidationErrorFor(request => request.RequiredRole);
    }

    [Fact]
    public void DraftLegacyRequiredRole_RejectsMoreThanDatabaseLimit()
    {
        var result = new DraftTaskRecommendationRequestDtoValidator().TestValidate(
            new DraftTaskRecommendationRequestDto { RequiredRole = TooLongRole });

        result.ShouldHaveValidationErrorFor(request => request.RequiredRole);
    }

    [Fact]
    public void UpdateContracts_DistinguishOmittedLegacyRoleFromExplicitNull()
    {
        var jsonOptions = new System.Text.Json.JsonSerializerOptions(
            System.Text.Json.JsonSerializerDefaults.Web);
        var omittedTask = System.Text.Json.JsonSerializer.Deserialize<UpdateTaskRequest>("{}", jsonOptions);
        var clearedTask = System.Text.Json.JsonSerializer.Deserialize<UpdateTaskRequest>(
            "{\"requiredRole\":null}", jsonOptions);
        var omittedServiceCall = System.Text.Json.JsonSerializer.Deserialize<UpdateServiceCallRequestDto>(
            "{}", jsonOptions);
        var clearedServiceCall = System.Text.Json.JsonSerializer.Deserialize<UpdateServiceCallRequestDto>(
            "{\"requiredRole\":null}", jsonOptions);

        Assert.NotNull(omittedTask);
        Assert.NotNull(clearedTask);
        Assert.NotNull(omittedServiceCall);
        Assert.NotNull(clearedServiceCall);
        Assert.False(omittedTask.RequiredRoleWasProvided);
        Assert.True(clearedTask.RequiredRoleWasProvided);
        Assert.False(omittedServiceCall.RequiredRoleWasProvided);
        Assert.True(clearedServiceCall.RequiredRoleWasProvided);
    }
}

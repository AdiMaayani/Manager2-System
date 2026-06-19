using ManageR2.Infrastructure.Features.WorkItems.Models;
using ManageR2.Infrastructure.Features.WorkItems.Services;

namespace ManageR2.UnitTests;

public class WorkPlanScheduleQueryValidatorTests
{
    [Fact]
    public void Validate_ProjectScopeRequiresProjectId()
    {
        var error = WorkPlanScheduleQueryValidator.Validate(new WorkPlanScheduleQuery
        {
            Scope = "project"
        });

        Assert.Equal("Project scope requires ProjectId.", error);
    }

    [Fact]
    public void Validate_EmployeeScopeRequiresEmployeeId()
    {
        var error = WorkPlanScheduleQueryValidator.Validate(new WorkPlanScheduleQuery
        {
            Scope = "employee"
        });

        Assert.Equal("Employee scope requires EmployeeId.", error);
    }

    [Fact]
    public void Validate_PersonalScopeRequiresCurrentUserEmployeeId()
    {
        var error = WorkPlanScheduleQueryValidator.Validate(new WorkPlanScheduleQuery
        {
            Scope = "personal"
        });

        Assert.Equal("Personal scope requires CurrentUserEmployeeId.", error);
    }

    [Fact]
    public void Validate_RejectsPartialUtcRange()
    {
        var error = WorkPlanScheduleQueryValidator.Validate(new WorkPlanScheduleQuery
        {
            Scope = "company",
            FromUtc = DateTime.UtcNow
        });

        Assert.Equal("fromUtc and toUtc must both be supplied or both be null.", error);
    }

    [Fact]
    public void Validate_AcceptsValidCompanyScope()
    {
        var error = WorkPlanScheduleQueryValidator.Validate(new WorkPlanScheduleQuery
        {
            Scope = "company",
            FromUtc = DateTime.UtcNow,
            ToUtc = DateTime.UtcNow.AddDays(1)
        });

        Assert.Null(error);
    }
}

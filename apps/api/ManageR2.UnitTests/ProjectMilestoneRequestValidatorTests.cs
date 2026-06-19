using ManageR2.Api.Features.Projects.DTOs;
using ManageR2.Api.Features.Projects.Validators;

namespace ManageR2.UnitTests;

public class ProjectMilestoneRequestValidatorTests
{
    private readonly CreateProjectMilestoneRequestDtoValidator _createValidator = new();
    private readonly UpdateProjectMilestoneRequestDtoValidator _updateValidator = new();

    [Fact]
    public void Create_RequiresManagerEmployeeId()
    {
        var request = new CreateProjectMilestoneRequestDto
        {
            Title = "Phase 1",
            Status = "Planned",
            ManagerEmployeeId = 0,
        };

        var result = _createValidator.Validate(request);

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Create_RejectsPlannedEndBeforePlannedStart()
    {
        var request = new CreateProjectMilestoneRequestDto
        {
            Title = "Phase 1",
            Status = "Planned",
            ManagerEmployeeId = 3,
            PlannedStart = new DateTime(2026, 6, 20),
            PlannedEnd = new DateTime(2026, 6, 19),
        };

        var result = _createValidator.Validate(request);

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Update_RejectsActualEndBeforeActualStart()
    {
        var request = new UpdateProjectMilestoneRequestDto
        {
            Title = "Phase 1",
            Status = "Planned",
            SortOrder = 0,
            ProgressPercent = 10,
            ActualStart = new DateTime(2026, 6, 20),
            ActualEnd = new DateTime(2026, 6, 19),
        };

        var result = _updateValidator.Validate(request);

        Assert.False(result.IsValid);
    }
}

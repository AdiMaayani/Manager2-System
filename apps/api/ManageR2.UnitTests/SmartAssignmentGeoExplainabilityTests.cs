using ManageR2.Domain.Features.SmartAssignment;
using ManageR2.Infrastructure.Features.SmartAssignment.Scoring;
using ManageR2.Infrastructure.Models.SmartAssignment;

namespace ManageR2.UnitTests;

public class SmartAssignmentGeoExplainabilityTests
{
    [Fact]
    public void Evaluate_AttributesGeographyScoreToGeoapifyRouting()
    {
        var start = new DateTime(2026, 7, 21, 10, 0, 0, DateTimeKind.Utc);
        var input = new TaskRecommendationInputModel
        {
            Task = new TaskCoreDataModel
            {
                WorkItemId = 100,
                PlannedStart = start,
                PlannedEnd = start.AddHours(2),
                SiteId = 50
            },
            SiteAddress = new SiteAddressModel
            {
                SiteId = 50,
                FormattedAddress = "Task site",
                Latitude = 31.77m,
                Longitude = 35.21m
            },
            Employees =
            {
                new EmployeeCandidateModel
                {
                    EmployeeId = 1,
                    IsActive = true,
                    IsAssignable = true,
                    DailyCapacityHours = 8m
                }
            },
            EmployeeBaseAddresses =
            {
                new EmployeeBaseAddressModel
                {
                    EmployeeId = 1,
                    FormattedAddress = "Worker home",
                    Latitude = 32.08m,
                    Longitude = 34.78m
                }
            },
            EmployeeAvailability =
            {
                new EmployeeAvailabilityModel
                {
                    EmployeeId = 1,
                    AvailableFrom = start.AddHours(-1),
                    AvailableTo = start.AddHours(3),
                    AvailabilityType = "Available"
                }
            },
            RouteEstimates =
            {
                new RouteEstimateModel
                {
                    EmployeeId = 1,
                    TargetSiteId = 50,
                    OriginType = SmartAssignmentRouteOriginTypes.HomeBase,
                    EstimatedTravelMinutes = 16,
                    EstimatedDistanceKm = 8.12m,
                    RoutingProvider = "Geoapify"
                }
            }
        };
        input.ResolvedRouteOriginTypes[1] = SmartAssignmentRouteOriginTypes.HomeBase;

        var result = new SmartAssignmentScoringEngine().Evaluate(
            input,
            SmartAssignmentPolicyDefaults.Create(),
            SmartAssignmentEvaluationContext.Empty(start.Date));

        var geography = result.Candidates.Single().Factors.Single(factor =>
            factor.Key == SmartAssignmentFactorCodes.Geography);
        Assert.Equal(90m, geography.Score);
        Assert.Equal("Geoapify travel-time routing", geography.DataSource);
        Assert.Equal("Geoapify", geography.SourceValues["routingProvider"]);
        Assert.Equal(16, geography.SourceValues["travelMinutes"]);
        Assert.Equal("Worker home", geography.SourceValues["originFormattedAddress"]);
        Assert.Equal("Task site", geography.SourceValues["destinationFormattedAddress"]);
    }
}

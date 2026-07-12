using System.Linq;
using ManageR2.Infrastructure.Models.SmartAssignment;

namespace ManageR2.Infrastructure.Repositories.SmartAssignment
{
    // Produces an order-independent projection of the recommendation input for shadow-read parity
    // comparison. The recommendation-input result sets have no inherent SQL ordering and the C# scoring
    // is order-insensitive, so provider-specific row ordering must not register as drift. Element values
    // are left unchanged; only list order is canonicalized.
    public static class SmartAssignmentInputParityNormalizer
    {
        public static TaskRecommendationInputModel Normalize(TaskRecommendationInputModel input)
        {
            return new TaskRecommendationInputModel
            {
                Task = input.Task,
                SiteAddress = input.SiteAddress,
                RequiredSkills = input.RequiredSkills.OrderBy(s => s.SkillId).ToList(),
                Employees = input.Employees.OrderBy(e => e.EmployeeId).ToList(),
                EmployeeSkills = input.EmployeeSkills
                    .OrderBy(s => s.EmployeeId).ThenBy(s => s.SkillId).ToList(),
                EmployeeAvailability = input.EmployeeAvailability
                    .OrderBy(a => a.EmployeeId).ThenBy(a => a.AvailableFrom).ThenBy(a => a.AvailableTo)
                    .ThenBy(a => a.AvailabilityType).ToList(),
                EmployeeCapacities = input.EmployeeCapacities
                    .OrderBy(c => c.EmployeeId).ThenBy(c => c.EffectiveFrom).ToList(),
                EmployeeBaseAddresses = input.EmployeeBaseAddresses
                    .OrderBy(b => b.EmployeeId).ToList(),
                EmployeeWorkZones = input.EmployeeWorkZones
                    .OrderBy(z => z.EmployeeId).ThenBy(z => z.ZoneId).ToList(),
                PlannedStops = input.PlannedStops
                    .OrderBy(p => p.EmployeeId).ThenBy(p => p.PlannedEndAt).ThenBy(p => p.PlannedStartAt)
                    .ThenBy(p => p.SiteId).ToList(),
                LocationEvents = input.LocationEvents
                    .OrderBy(l => l.EmployeeId).ThenBy(l => l.EventTime).ToList(),
                RouteEstimates = input.RouteEstimates
                    .OrderBy(r => r.EmployeeId).ThenBy(r => r.OriginType).ThenBy(r => r.TargetSiteId).ToList(),
                EmployeeCurrentLoads = input.EmployeeCurrentLoads
                    .OrderBy(l => l.EmployeeId).ToList(),
                EmployeeContinuities = input.EmployeeContinuities
                    .OrderBy(c => c.EmployeeId).ToList()
            };
        }
    }
}

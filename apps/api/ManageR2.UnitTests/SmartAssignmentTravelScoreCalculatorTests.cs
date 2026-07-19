using ManageR2.Infrastructure.Features.SmartAssignment.Scoring;

namespace ManageR2.UnitTests;

public class SmartAssignmentTravelScoreCalculatorTests
{
    [Theory]
    [InlineData(0, 100)]
    [InlineData(15, 100)]
    [InlineData(16, 90)]
    [InlineData(30, 90)]
    [InlineData(31, 75)]
    [InlineData(45, 75)]
    [InlineData(46, 60)]
    [InlineData(60, 60)]
    [InlineData(61, 35)]
    [InlineData(90, 35)]
    [InlineData(91, 15)]
    public void Calculate_PreservesCanonicalTravelBands(int minutes, int expectedScore)
    {
        Assert.Equal(expectedScore, SmartAssignmentTravelScoreCalculator.Calculate(minutes));
    }

    [Fact]
    public void Calculate_RejectsNegativeDuration()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            SmartAssignmentTravelScoreCalculator.Calculate(-1));
    }
}

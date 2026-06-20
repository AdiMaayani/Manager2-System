using ManageR2.Domain.Features.Geo.Entities;
using ManageR2.Infrastructure.Features.AddressProfiles;

namespace ManageR2.UnitTests;

public class GeoRepositoryContractTests
{
    [Fact]
    public void SiteCompositeProcedure_DefinesExplicitHasAddressProfileFlag()
    {
        var sql = File.ReadAllText(GetRepoRelativePath("database/SP/sp_Site_SaveWithAddressProfile.sql"));

        Assert.Contains("@HasAddressProfile BIT", sql);
        Assert.Contains("IF @HasAddressProfile = 1", sql);
        Assert.Contains("EXEC dbo.sp_RouteEstimates_InvalidateByTargetSiteId", sql);
    }

    [Fact]
    public void EmployeeUpsertProcedure_PerformsAtomicRouteInvalidation()
    {
        var sql = File.ReadAllText(GetRepoRelativePath("database/SP/sp_EmployeeBaseAddress_Upsert.sql"));

        Assert.Contains("WITH (UPDLOCK, HOLDLOCK)", sql);
        Assert.Contains("EXEC dbo.sp_RouteEstimates_InvalidateByEmployeeId", sql);
        Assert.Contains("BEGIN TRY", sql);
        Assert.Contains("IF XACT_STATE() <> 0", sql);
    }

    [Fact]
    public void SiteRepository_PassesHasAddressProfileParameter()
    {
        var source = File.ReadAllText(GetRepoRelativePath(
            "apps/api/ManageR2.Infrastructure/Features/AddressProfiles/Repositories/SiteAddressProfileRepository.cs"));

        Assert.Contains("@HasAddressProfile", source);
        Assert.Contains("request.HasAddressProfile", source);
    }

    [Fact]
    public void CoordinateColumns_UseDecimalMappingInProcedures()
    {
        var employeeUpsert = File.ReadAllText(GetRepoRelativePath("database/SP/sp_EmployeeBaseAddress_Upsert.sql"));
        var siteSave = File.ReadAllText(GetRepoRelativePath("database/SP/sp_Site_SaveWithAddressProfile.sql"));

        Assert.Contains("@Latitude DECIMAL(9, 6)", employeeUpsert);
        Assert.Contains("@Longitude DECIMAL(9, 6)", employeeUpsert);
        Assert.Contains("@Latitude DECIMAL(9, 6)", siteSave);
        Assert.Contains("@Longitude DECIMAL(9, 6)", siteSave);
    }

    [Fact]
    public void OrphanSiteProfileUpsert_IsDocumentedAsAdministrativeOnly()
    {
        var sql = File.ReadAllText(GetRepoRelativePath("database/SP/sp_SiteAddressProfile_Upsert.sql"));

        Assert.Contains("Administrative / reusable path only", sql);
        Assert.Contains("NOT used by the Phase A composite Site save", sql);
    }

    private static string GetRepoRelativePath(string relativePath)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, relativePath);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }

        throw new FileNotFoundException($"Could not locate repository file: {relativePath}");
    }
}

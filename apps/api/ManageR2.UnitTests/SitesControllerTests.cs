using ManageR2.Api.Controllers;
using ManageR2.Api.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace ManageR2.UnitTests;

public class SitesControllerTests
{
    [Fact]
    public async Task GetAll_WithCustomerId_UsesCustomerScopedRepositoryQuery()
    {
        var repository = new Mock<ISiteRepository>();
        repository
            .Setup(siteRepository => siteRepository.GetByCustomerIdAsync(3))
            .ReturnsAsync(
            [
                new Site { SiteId = 12, CustomerId = 3, SiteName = "Customer site" }
            ]);
        var controller = new SitesController(repository.Object);

        var result = await controller.GetAll(3);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var sites = Assert.IsAssignableFrom<IEnumerable<SiteDto>>(okResult.Value);
        Assert.Equal(3, Assert.Single(sites).CustomerId);
        repository.Verify(siteRepository => siteRepository.GetAllAsync(), Times.Never);
    }

    [Fact]
    public async Task Create_CreatesSiteUnderRequestedCustomer()
    {
        var repository = new Mock<ISiteRepository>();
        repository
            .Setup(siteRepository => siteRepository.CreateAsync(It.Is<Site>(
                site => site.CustomerId == 3 && site.SiteName == "New site")))
            .ReturnsAsync(12);
        repository
            .Setup(siteRepository => siteRepository.GetByIdAsync(12))
            .ReturnsAsync(new Site { SiteId = 12, CustomerId = 3, SiteName = "New site" });
        var controller = new SitesController(repository.Object);

        var result = await controller.Create(new SiteDto
        {
            CustomerId = 3,
            SiteName = "New site"
        });

        var createdResult = Assert.IsType<CreatedAtActionResult>(result);
        var site = Assert.IsType<SiteDto>(createdResult.Value);
        Assert.Equal(3, site.CustomerId);
    }

    [Fact]
    public async Task Update_PreservesExistingCustomerOwnership()
    {
        var repository = new Mock<ISiteRepository>();
        repository
            .Setup(siteRepository => siteRepository.GetByIdAsync(12))
            .ReturnsAsync(new Site
            {
                SiteId = 12,
                CustomerId = 3,
                SiteName = "Existing site"
            });
        repository
            .Setup(siteRepository => siteRepository.UpdateAsync(It.Is<Site>(
                site => site.SiteId == 12 && site.CustomerId == 3 && site.SiteName == "Updated site")))
            .ReturnsAsync(true);
        var controller = new SitesController(repository.Object);

        var result = await controller.Update(12, new SiteDto
        {
            SiteId = 12,
            CustomerId = 3,
            SiteName = "Updated site"
        });

        Assert.IsType<OkObjectResult>(result);
        repository.Verify(
            siteRepository => siteRepository.UpdateAsync(It.Is<Site>(
                site => site.CustomerId == 3)),
            Times.Once);
    }

    [Fact]
    public async Task Update_RejectsMovingSiteToAnotherCustomer()
    {
        var repository = new Mock<ISiteRepository>();
        repository
            .Setup(siteRepository => siteRepository.GetByIdAsync(12))
            .ReturnsAsync(new Site
            {
                SiteId = 12,
                CustomerId = 3,
                SiteName = "Existing site"
            });
        var controller = new SitesController(repository.Object);

        var result = await controller.Update(12, new SiteDto
        {
            SiteId = 12,
            CustomerId = 4,
            SiteName = "Existing site"
        });

        Assert.IsType<BadRequestObjectResult>(result);
        repository.Verify(
            siteRepository => siteRepository.UpdateAsync(It.IsAny<Site>()),
            Times.Never);
    }
}

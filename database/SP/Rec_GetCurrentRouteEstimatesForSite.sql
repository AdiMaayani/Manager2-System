SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[Rec_GetCurrentRouteEstimatesForSite]
    @TargetSiteId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        r.RouteEstimateId,
        r.EmployeeId,
        e.FullName,
        r.TargetSiteId,
        r.OriginType,
        r.OriginReferenceId,
        r.OriginAddress,
        r.TargetAddress,
        r.RoutingProvider,
        r.RoutingStatus,
        r.RoutingMode,
        r.EstimatedDistanceKm,
        r.EstimatedTravelMinutes,
        r.CalculatedAt,
        r.IsCurrent
    FROM dbo.Rec_RouteEstimates r
    INNER JOIN dbo.Employees e
        ON e.EmployeeId = r.EmployeeId
    WHERE r.TargetSiteId = @TargetSiteId
      AND r.IsCurrent = 1
    ORDER BY e.FullName, r.OriginType;
END
GO

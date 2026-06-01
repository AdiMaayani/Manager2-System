SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[Rec_GetAllCandidateBaseAddresses]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        b.EmployeeId,
        e.FullName,
        b.InputAddress,
        b.FormattedAddress,
        b.ValidationProvider,
        b.ValidationStatus,
        b.ValidationVerdict,
        b.ValidationScore,
        b.ExternalPlaceRef,
        b.City,
        b.Country,
        b.ZoneId,
        wz.ZoneName
    FROM dbo.Rec_EmployeeBaseAddress b
    INNER JOIN dbo.Employees e
        ON e.EmployeeId = b.EmployeeId
    LEFT JOIN dbo.Rec_WorkZones wz
        ON wz.ZoneId = b.ZoneId
    WHERE e.IsActive = 1
      AND e.IsAssignable = 1
    ORDER BY e.FullName;
END
GO

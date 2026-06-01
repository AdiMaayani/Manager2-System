SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[Rec_GetAllCandidateCapacities]
    @WorkDate DATE
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        c.EmployeeId,
        e.FullName,
        c.WeeklyCapacityHours,
        c.EffectiveFrom,
        c.EffectiveTo,
        c.Notes
    FROM dbo.Rec_EmployeeCapacity c
    INNER JOIN dbo.Employees e
        ON e.EmployeeId = c.EmployeeId
    WHERE e.IsActive = 1
      AND e.IsAssignable = 1
      AND c.EffectiveFrom <= @WorkDate
      AND (c.EffectiveTo IS NULL OR c.EffectiveTo >= @WorkDate)
    ORDER BY e.FullName;
END
GO

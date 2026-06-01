SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[Rec_GetAllCandidateEmployeeSkills]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        es.EmployeeId,
        e.FullName,
        es.SkillId,
        s.SkillName,
        s.SkillCategory,
        es.SkillLevel,
        es.YearsExperience,
        es.IsCertified,
        es.LastUsedAt,
        es.Notes
    FROM dbo.Rec_EmployeeSkills es
    INNER JOIN dbo.Employees e
        ON e.EmployeeId = es.EmployeeId
    INNER JOIN dbo.Rec_Skills s
        ON s.SkillId = es.SkillId
    WHERE e.IsActive = 1
      AND e.IsAssignable = 1
    ORDER BY e.FullName, s.SkillName;
END
GO

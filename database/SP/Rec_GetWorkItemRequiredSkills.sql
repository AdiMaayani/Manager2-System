SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[Rec_GetWorkItemRequiredSkills]
    @WorkItemId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        r.WorkItemRequiredSkillId,
        r.WorkItemId,
        r.SkillId,
        s.SkillName,
        s.SkillCategory,
        r.RequiredLevel,
        r.ImportanceLevel,
        r.Notes
    FROM dbo.Rec_WorkItemRequiredSkills r
    INNER JOIN dbo.Rec_Skills s
        ON s.SkillId = r.SkillId
    WHERE r.WorkItemId = @WorkItemId
    ORDER BY
        CASE r.ImportanceLevel
            WHEN N'Critical' THEN 1
            WHEN N'Important' THEN 2
            WHEN N'Preferred' THEN 3
            ELSE 4
        END;
END
GO

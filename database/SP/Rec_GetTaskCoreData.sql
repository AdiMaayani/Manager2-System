SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[Rec_GetTaskCoreData]
    @WorkItemId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        wi.WorkItemId,
        wi.Title,
        wi.WorkType,
        wi.Status,
        wi.PlannedStart,
        wi.PlannedEnd,
        wi.EstimatedHours,
        wi.Priority,
        wi.RequiredRole,
        CASE WHEN EXISTS
        (
            SELECT 1 FROM dbo.WorkItemRequiredRoles AS requiredRole
            WHERE requiredRole.WorkItemId = wi.WorkItemId
        ) THEN (
            SELECT requiredRole.RoleName AS [Role]
            FROM dbo.WorkItemRequiredRoles AS requiredRole
            WHERE requiredRole.WorkItemId = wi.WorkItemId
            ORDER BY requiredRole.RoleName
            FOR XML PATH(''), ROOT('Roles'), TYPE
        ) ELSE CAST(NULL AS XML) END AS RequiredRolesXml,
        wi.IsLocked,
        wi.SiteId,
        wi.CustomerId,
        wi.ParentWorkItemId,
        ap.ProjectType,
        ap.RequiredWorkersCount,
        ap.AlgorithmPriorityOverride,
        ap.UrgencyOverride,
        ap.PlanningNotes
    FROM dbo.WorkItems wi
    LEFT JOIN dbo.Rec_WorkItemAlgorithmProfile ap
        ON ap.WorkItemId = wi.WorkItemId
    WHERE wi.WorkItemId = @WorkItemId;
END
GO

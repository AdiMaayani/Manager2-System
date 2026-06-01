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

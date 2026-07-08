SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_Dashboard_GetServiceCallExceptions
    @EmployeeId     INT = NULL,
    @IncludeOrgWide BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (50)
        wi.WorkItemId,
        wi.Title,
        wi.Status,
        wi.Priority,
        wi.PlannedStart,
        wi.PlannedEnd,
        wi.CreatedAt,
        wi.CustomerId,
        c.CustomerName,
        wi.SiteId,
        s.SiteName,
        CAST(CASE WHEN NOT EXISTS (
                SELECT 1 FROM dbo.WorkEmployeeAssignments a
                WHERE a.WorkItemId = wi.WorkItemId
            ) THEN 1 ELSE 0 END AS BIT) AS IsUnassigned,
        CAST(CASE WHEN @EmployeeId IS NOT NULL AND EXISTS (
                SELECT 1 FROM dbo.WorkEmployeeAssignments a
                WHERE a.WorkItemId = wi.WorkItemId AND a.EmployeeId = @EmployeeId
            ) THEN 1 ELSE 0 END AS BIT) AS IsAssignedToMe,
        CAST(CASE WHEN wi.Priority = N'Urgent' THEN 1 ELSE 0 END AS BIT) AS IsUrgent
    FROM dbo.WorkItems AS wi
    LEFT JOIN dbo.Customers AS c ON c.CustomerId = wi.CustomerId
    LEFT JOIN dbo.Sites     AS s ON s.SiteId     = wi.SiteId
    WHERE wi.WorkType = N'ServiceCall'
      AND wi.Status IN (N'Open', N'InProgress')
      AND (
            @IncludeOrgWide = 1
            OR (
                @EmployeeId IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM dbo.WorkEmployeeAssignments a
                    WHERE a.WorkItemId = wi.WorkItemId AND a.EmployeeId = @EmployeeId
                )
            )
      )
    ORDER BY
        CASE WHEN wi.Priority = N'Urgent' THEN 0 ELSE 1 END,
        CASE WHEN NOT EXISTS (
                SELECT 1 FROM dbo.WorkEmployeeAssignments a WHERE a.WorkItemId = wi.WorkItemId
            ) THEN 0 ELSE 1 END,
        wi.CreatedAt ASC;
END
GO

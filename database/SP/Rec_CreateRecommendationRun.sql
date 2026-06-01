SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[Rec_CreateRecommendationRun]
    @ScopeType NVARCHAR(30),
    @ProjectId INT = NULL,
    @TaskId INT = NULL,
    @RequestedByUserId INT = NULL,
    @AlgorithmVersion NVARCHAR(50) = N'1.0',
    @InputSnapshotJson NVARCHAR(MAX) = NULL,
    @RecommendationRunId INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.Rec_RecommendationRuns
    (
        ScopeType,
        ProjectId,
        TaskId,
        RequestedByUserId,
        AlgorithmVersion,
        RunStatus,
        InputSnapshotJson,
        CreatedAt
    )
    VALUES
    (
        @ScopeType,
        @ProjectId,
        @TaskId,
        @RequestedByUserId,
        @AlgorithmVersion,
        N'Completed',
        @InputSnapshotJson,
        SYSUTCDATETIME()
    );

    SET @RecommendationRunId = SCOPE_IDENTITY();
END
GO

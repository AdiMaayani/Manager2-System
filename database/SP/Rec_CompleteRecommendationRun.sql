SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[Rec_CompleteRecommendationRun]
    @RecommendationRunId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @RecommendationRunId IS NULL OR @RecommendationRunId < 1
        THROW 53220, 'RecommendationRunId must be positive.', 1;

    DECLARE @RunStatus NVARCHAR(30);

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @RunStatus = RunStatus
        FROM dbo.Rec_RecommendationRuns WITH (UPDLOCK, HOLDLOCK)
        WHERE RecommendationRunId = @RecommendationRunId;

        IF @RunStatus IS NULL
            THROW 53221, 'The recommendation run was not found.', 1;

        IF @RunStatus = N'Failed'
            THROW 53222, 'A failed recommendation run cannot be completed.', 1;

        IF @RunStatus = N'Partial'
        BEGIN
            UPDATE dbo.Rec_RecommendationRuns
            SET RunStatus = N'Completed'
            WHERE RecommendationRunId = @RecommendationRunId
              AND RunStatus = N'Partial';
        END;

        /* Completed is an idempotent success for safe publisher retries. */
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        THROW;
    END CATCH;
END
GO

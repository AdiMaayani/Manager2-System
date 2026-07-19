SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- Reopens a Service Call atomically: Status → Open, ClosedAt → NULL.
-- Allowed when Status = Cancelled, or Status = Open with stale ClosedAt (legacy repair).
-- Rejects Done / InProgress / Planned / unsupported statuses even when ClosedAt is set.
CREATE OR ALTER PROCEDURE [dbo].[sp_ReopenServiceCall]
    @WorkItemId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @WorkType NVARCHAR(50);
        DECLARE @Status NVARCHAR(50);
        DECLARE @ClosedAt DATETIME2;
        DECLARE @IsArchived BIT;

        SELECT
            @WorkType = WorkType,
            @Status = Status,
            @ClosedAt = ClosedAt,
            @IsArchived = IsArchived
        FROM dbo.WorkItems WITH (UPDLOCK, HOLDLOCK)
        WHERE WorkItemId = @WorkItemId;

        IF @WorkType IS NULL OR @IsArchived = 1
            THROW 51201, N'Service call not found.', 1;

        IF @WorkType <> N'ServiceCall'
            THROW 51202, N'Work item is not a service call.', 1;

        -- Already open with no cancellation stamp — idempotent success.
        IF @Status = N'Open' AND @ClosedAt IS NULL
        BEGIN
            COMMIT TRANSACTION;
            SELECT 1 AS RowsAffected;
            RETURN;
        END;

        IF NOT (
            @Status = N'Cancelled'
            OR (@Status = N'Open' AND @ClosedAt IS NOT NULL)
        )
            THROW 51204, N'Service call cannot be reopened from the current state.', 1;

        UPDATE dbo.WorkItems
        SET
            Status = N'Open',
            ClosedAt = NULL
        WHERE WorkItemId = @WorkItemId
          AND WorkType = N'ServiceCall'
          AND IsArchived = 0;

        IF @@ROWCOUNT = 0
            THROW 51201, N'Service call not found.', 1;

        COMMIT TRANSACTION;
        SELECT 1 AS RowsAffected;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

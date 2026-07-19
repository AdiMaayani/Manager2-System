SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- Cancels a Service Call atomically: Status → Cancelled, ClosedAt → SYSUTCDATETIME().
-- Allowed only from Planned / Open / InProgress with ClosedAt IS NULL.
-- Does not modify CreatedAt, planned/actual work fields, or assignments.
CREATE OR ALTER PROCEDURE [dbo].[sp_CancelServiceCall]
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

        IF @ClosedAt IS NOT NULL
            OR @Status NOT IN (N'Planned', N'Open', N'InProgress')
            THROW 51203, N'Service call cannot be cancelled from the current state.', 1;

        UPDATE dbo.WorkItems
        SET
            Status = N'Cancelled',
            ClosedAt = SYSUTCDATETIME()
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

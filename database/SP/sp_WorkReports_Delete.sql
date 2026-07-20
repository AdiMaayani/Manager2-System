SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_WorkReports_Delete
    @WorkReportId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    DECLARE @LifecycleStatus NVARCHAR(20);

    SELECT @LifecycleStatus = LifecycleStatus
    FROM dbo.WorkReports WITH (UPDLOCK, HOLDLOCK)
    WHERE WorkReportId = @WorkReportId;

    IF @LifecycleStatus IS NULL
    BEGIN
        SELECT 0 AS RowsAffected;
        COMMIT TRANSACTION;
        RETURN;
    END;

    -- Only Draft lifecycle reports may be deleted; Finalized/Reversed must be retained.
    IF @LifecycleStatus <> N'Draft'
        THROW 51370, 'Only Draft work reports can be deleted.', 1;

    -- Conservative attachment rule: refuse deletion while attachment metadata exists
    -- so physical files are never orphaned by a non-atomic DB+filesystem delete.
    IF EXISTS (
        SELECT 1
        FROM dbo.WorkReportAttachments
        WHERE WorkReportId = @WorkReportId
    )
        THROW 51371, 'Remove all attachments before deleting this draft work report.', 1;

    -- Never alter inventory finalization/reversal stock movements via report deletion.
    IF EXISTS (
        SELECT 1
        FROM dbo.WorkReportInventoryItems AS inventoryLine
        INNER JOIN dbo.InventoryStockMovements AS stockMovement
            ON stockMovement.WorkReportInventoryItemId = inventoryLine.WorkReportInventoryItemId
        WHERE inventoryLine.WorkReportId = @WorkReportId
    )
        THROW 51372, 'Cannot delete a work report that has inventory stock movements.', 1;

    -- Draft-owned relational children in FK-safe order (no stock-movement writes).
    DELETE FROM dbo.WorkReportInventoryItems
    WHERE WorkReportId = @WorkReportId;

    DELETE FROM dbo.WorkReportEmployeeAssignments
    WHERE WorkReportId = @WorkReportId;

    DELETE FROM dbo.WorkReportSystems
    WHERE WorkReportId = @WorkReportId;

    DELETE FROM dbo.WorkReports
    WHERE WorkReportId = @WorkReportId;

    SELECT @@ROWCOUNT AS RowsAffected;

    COMMIT TRANSACTION;
END
GO

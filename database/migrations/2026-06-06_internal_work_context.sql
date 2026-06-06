/*
    ManageR2 Internal/Office work context migration.

    Run this script manually in SSMS against the intended target database.
    It does not add or alter any table or column.

    Purpose:
    - Enables creating non-project (internal/office) tasks from the WorkPlan
      without a schema change. Internal/office tasks are ordinary
      WorkItems rows with WorkType = 'Task' parented to a reserved, hidden
      container project, so they reuse the existing create, render, and
      Smart Assignment pipeline unchanged.

    Changes:
    - Adds sp_WorkItems_GetInternalContext: idempotent get-or-create of the
      reserved Internal/Office Customer (CustomerType = 'Internal'), its
      default Site, and the hidden container Project (WorkType = 'Project',
      FinanceProjectNumber = 'INTERNAL'). Returns CustomerId, SiteId,
      ContainerProjectId.

    Notes:
    - Idempotent: safe to run multiple times. Existing rows are reused.
    - Requires at least one user (Customers.CreatedByUserId is NOT NULL and
      FK-constrained); the procedure raises a clear error otherwise.
    - The canonical procedure definition lives under database/SP/.
*/

CREATE OR ALTER PROCEDURE [dbo].[sp_WorkItems_GetInternalContext]
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @InternalCustomerType NVARCHAR(50) = N'Internal';
    DECLARE @InternalProjectMarker NVARCHAR(100) = N'INTERNAL';
    DECLARE @InternalLabel NVARCHAR(150) = N'משימות פנימיות / משרדיות';

    DECLARE @CustomerId INT;
    DECLARE @SiteId INT;
    DECLARE @ContainerProjectId INT;

    BEGIN TRANSACTION;

    -- Internal/Office customer (reserved by CustomerType = 'Internal').
    SELECT TOP (1) @CustomerId = CustomerId
    FROM dbo.Customers
    WHERE CustomerType = @InternalCustomerType
    ORDER BY CustomerId;

    IF @CustomerId IS NULL
    BEGIN
        -- CreatedByUserId is NOT NULL and FK-constrained; reuse an existing user.
        DECLARE @CreatedByUserId INT;
        SELECT TOP (1) @CreatedByUserId = UserId
        FROM dbo.Users
        ORDER BY UserId;

        IF @CreatedByUserId IS NULL
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 50001, 'Cannot seed internal work context: no users exist to own the internal customer.', 1;
        END;

        INSERT INTO dbo.Customers
        (
            CustomerName,
            CustomerType,
            IsActive,
            CreatedAt,
            CreatedByUserId
        )
        VALUES
        (
            @InternalLabel,
            @InternalCustomerType,
            1,
            SYSUTCDATETIME(),
            @CreatedByUserId
        );

        SET @CustomerId = CAST(SCOPE_IDENTITY() AS INT);
    END;

    -- Default site for the internal customer.
    SELECT TOP (1) @SiteId = SiteId
    FROM dbo.Sites
    WHERE CustomerId = @CustomerId
    ORDER BY IsPrimary DESC, SiteId;

    IF @SiteId IS NULL
    BEGIN
        INSERT INTO dbo.Sites
        (
            CustomerId,
            SiteName,
            IsPrimary,
            CreatedAt,
            IsActive
        )
        VALUES
        (
            @CustomerId,
            @InternalLabel,
            1,
            SYSDATETIME(),
            1
        );

        SET @SiteId = CAST(SCOPE_IDENTITY() AS INT);
    END;

    -- Hidden container project (reserved by FinanceProjectNumber = 'INTERNAL').
    SELECT TOP (1) @ContainerProjectId = WorkItemId
    FROM dbo.WorkItems
    WHERE WorkType = 'Project'
      AND FinanceProjectNumber = @InternalProjectMarker
    ORDER BY WorkItemId;

    IF @ContainerProjectId IS NULL
    BEGIN
        INSERT INTO dbo.WorkItems
        (
            Title,
            WorkType,
            Status,
            BillingType,
            Description,
            CustomerId,
            SiteId,
            CreatedAt,
            ParentWorkItemId,
            FinanceProjectNumber,
            IsLocked
        )
        VALUES
        (
            @InternalLabel,
            'Project',
            'Execution',
            'Internal',
            @InternalLabel,
            @CustomerId,
            @SiteId,
            GETDATE(),
            NULL,
            @InternalProjectMarker,
            0
        );

        SET @ContainerProjectId = CAST(SCOPE_IDENTITY() AS INT);
    END;

    COMMIT TRANSACTION;

    SELECT
        @CustomerId AS CustomerId,
        @SiteId AS SiteId,
        @ContainerProjectId AS ContainerProjectId;
END
GO

-- Seed the internal work context immediately so it exists right after migration.
EXEC dbo.sp_WorkItems_GetInternalContext;
GO

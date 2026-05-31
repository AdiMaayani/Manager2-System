USE [igroup30_prod];
GO

CREATE OR ALTER PROCEDURE dbo.sp_CreateWorkItem
    @Title NVARCHAR(255),
    @WorkType NVARCHAR(50),
    @Status NVARCHAR(50),
    @BillingType NVARCHAR(50),
    @Description NVARCHAR(MAX) = NULL,
    @CustomerId INT,
    @SiteId INT,
    @ParentWorkItemId INT = NULL,
    @DealCloseDate DATETIME2(7) = NULL,
    @FinanceProjectNumber NVARCHAR(100) = NULL,
    @InvoiceNumber NVARCHAR(100) = NULL,
    @PlannedStart DATETIME2(7) = NULL,
    @PlannedEnd DATETIME2(7) = NULL,
    @EstimatedHours DECIMAL(5,2) = NULL,
    @ActualStart DATETIME2(7) = NULL,
    @ActualEnd DATETIME2(7) = NULL,
    @ActualHours DECIMAL(5,2) = NULL,
    @Priority NVARCHAR(20) = NULL,
    @RequiredRole NVARCHAR(100) = NULL,
    @IsLocked BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.WorkItems
    (
        Title,
        Description,
        WorkType,
        BillingType,
        Status,
        CustomerId,
        SiteId,
        ParentWorkItemId,
        CreatedAt,
        DealCloseDate,
        FinanceProjectNumber,
        InvoiceNumber,
        PlannedStart,
        PlannedEnd,
        EstimatedHours,
        ActualStart,
        ActualEnd,
        ActualHours,
        Priority,
        RequiredRole,
        IsLocked
    )
    OUTPUT INSERTED.WorkItemId
    VALUES
    (
        @Title,
        @Description,
        @WorkType,
        @BillingType,
        @Status,
        @CustomerId,
        @SiteId,
        @ParentWorkItemId,
        SYSUTCDATETIME(),
        @DealCloseDate,
        @FinanceProjectNumber,
        @InvoiceNumber,
        @PlannedStart,
        @PlannedEnd,
        @EstimatedHours,
        @ActualStart,
        @ActualEnd,
        @ActualHours,
        @Priority,
        @RequiredRole,
        @IsLocked
    );
END
GO

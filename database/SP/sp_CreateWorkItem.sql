SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[sp_CreateWorkItem]
    @Title NVARCHAR(255),
    @WorkType NVARCHAR(50),
    @Status NVARCHAR(50),
    @BillingType NVARCHAR(50),
    @Description NVARCHAR(MAX) = NULL,
    @CustomerId INT,
    @SiteId INT,
    @ParentWorkItemId INT = NULL,
    @DealCloseDate DATETIME2 = NULL,
    @FinanceProjectNumber NVARCHAR(100) = NULL,
    @InvoiceNumber NVARCHAR(100) = NULL,
    @PlannedStart DATETIME2 = NULL,
    @PlannedEnd DATETIME2 = NULL,
    @EstimatedHours DECIMAL(5,2) = NULL,
    @ActualStart DATETIME2 = NULL,
    @ActualEnd DATETIME2 = NULL,
    @ActualHours DECIMAL(5,2) = NULL,
    @Priority NVARCHAR(40) = NULL,
    @RequiredRole NVARCHAR(100) = NULL,
    @IsLocked BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

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
    VALUES
    (
        @Title,
        @WorkType,
        @Status,
        @BillingType,
        @Description,
        @CustomerId,
        @SiteId,
        GETDATE(),
        @ParentWorkItemId,
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

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS NewWorkItemId;
END;
GO

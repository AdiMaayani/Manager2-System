SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[sp_UpdateWorkItem]
    @WorkItemId INT,
    @Title NVARCHAR(200),
    @Description NVARCHAR(MAX),
    @WorkType NVARCHAR(50),
    @BillingType NVARCHAR(50),
    @Status NVARCHAR(50),
    @CustomerId INT,
    @SiteId INT,
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

    UPDATE dbo.WorkItems
    SET
        Title = @Title,
        Description = @Description,
        WorkType = @WorkType,
        BillingType = @BillingType,
        Status = @Status,
        CustomerId = @CustomerId,
        SiteId = @SiteId,
        DealCloseDate = @DealCloseDate,
        FinanceProjectNumber = @FinanceProjectNumber,
        InvoiceNumber = @InvoiceNumber,
        PlannedStart = @PlannedStart,
        PlannedEnd = @PlannedEnd,
        EstimatedHours = @EstimatedHours,
        ActualStart = @ActualStart,
        ActualEnd = @ActualEnd,
        ActualHours = @ActualHours,
        Priority = @Priority,
        RequiredRole = @RequiredRole,
        IsLocked = @IsLocked
    WHERE WorkItemId = @WorkItemId;

    SELECT @@ROWCOUNT AS RowsAffected;
END;
GO

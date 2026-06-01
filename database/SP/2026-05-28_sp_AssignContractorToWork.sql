USE [igroup30_prod];
GO

CREATE OR ALTER PROCEDURE dbo.sp_AssignContractorToWork
    @WorkItemId INT,
    @ContractorId INT,
    @AssignmentRole NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.WorkItems
        WHERE WorkItemId = @WorkItemId
    )
    BEGIN
        THROW 50011, 'Work item was not found.', 1;
    END

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.Contractors
        WHERE ContractorId = @ContractorId
    )
    BEGIN
        THROW 50012, 'Contractor was not found.', 1;
    END

    IF NULLIF(LTRIM(RTRIM(@AssignmentRole)), '') IS NULL
    BEGIN
        THROW 50013, 'Assignment role is required.', 1;
    END

    IF EXISTS (
        SELECT 1
        FROM dbo.WorkContractorAssignments
        WHERE WorkItemId = @WorkItemId
          AND ContractorId = @ContractorId
    )
    BEGIN
        THROW 50014, 'Contractor is already assigned to this work item.', 1;
    END

    INSERT INTO dbo.WorkContractorAssignments
    (
        WorkItemId,
        ContractorId,
        AssignmentRole
    )
    VALUES
    (
        @WorkItemId,
        @ContractorId,
        @AssignmentRole
    );

    SELECT @@ROWCOUNT;
END
GO

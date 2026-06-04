SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProjectBoq_Create
    @ProjectId INT,
    @SystemName NVARCHAR(100) = NULL,
    @ItemDescription NVARCHAR(300),
    @Quantity DECIMAL(18,3),
    @Unit NVARCHAR(20),
    @SortOrder INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.WorkItems
        WHERE WorkItemId = @ProjectId
          AND WorkType = 'Project'
    )
    BEGIN
        THROW 51100, 'Project was not found.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@ItemDescription)), N'') IS NULL
    BEGIN
        THROW 51101, 'ItemDescription is required.', 1;
    END;

    IF @Quantity <= 0
    BEGIN
        THROW 51102, 'Quantity must be greater than zero.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@Unit)), N'') IS NULL
    BEGIN
        THROW 51103, 'Unit is required.', 1;
    END;

    IF @SortOrder IS NULL
    BEGIN
        SELECT @SortOrder = ISNULL(MAX(SortOrder), 0) + 1
        FROM dbo.ProjectBoqItems
        WHERE ProjectId = @ProjectId
          AND IsActive = 1;
    END;

    INSERT INTO dbo.ProjectBoqItems
    (
        ProjectId,
        SystemName,
        ItemDescription,
        Quantity,
        Unit,
        SortOrder,
        CreatedAt
    )
    VALUES
    (
        @ProjectId,
        NULLIF(LTRIM(RTRIM(@SystemName)), N''),
        LTRIM(RTRIM(@ItemDescription)),
        @Quantity,
        LTRIM(RTRIM(@Unit)),
        @SortOrder,
        SYSUTCDATETIME()
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS ProjectBoqItemId;
END
GO

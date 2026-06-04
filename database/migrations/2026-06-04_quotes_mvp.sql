/*
    ManageR2 Quotes MVP persistence migration.

    Run this script manually in SSMS against the intended target database.

    Changes:
    - Adds dbo.Quotes for quote headers linked to a customer and optionally to a project (WorkItems with WorkType='Project').
    - Adds dbo.QuoteLineItems for priced quote lines (description, quantity, unit, unit price, line total).
    - Adds stored procedures used by the Quotes module (list, detail, create, update header, deactivate, line maintenance, totals recalculation).

    Notes:
    - Quote numbers are generated server-side as 'Q-YYYY-####' and are read-only in the UI.
    - Totals (Subtotal, VatAmount, Total) are recomputed and stored on every save by sp_Quotes_RecalculateTotals.
    - Allowed statuses: Draft, Sent, Tracking, Approved, Rejected.
*/

IF OBJECT_ID(N'dbo.Quotes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Quotes
    (
        QuoteId INT IDENTITY(1,1) NOT NULL,
        QuoteNumber NVARCHAR(50) NOT NULL,
        CustomerId INT NOT NULL,
        ProjectId INT NULL,
        QuoteDate DATE NOT NULL,
        ValidUntil DATE NULL,
        Status NVARCHAR(50) NOT NULL CONSTRAINT DF_Quotes_Status DEFAULT (N'Draft'),
        Notes NVARCHAR(1000) NULL,
        VatRate DECIMAL(5,2) NOT NULL CONSTRAINT DF_Quotes_VatRate DEFAULT (17.00),
        Subtotal DECIMAL(18,2) NOT NULL CONSTRAINT DF_Quotes_Subtotal DEFAULT (0),
        VatAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_Quotes_VatAmount DEFAULT (0),
        Total DECIMAL(18,2) NOT NULL CONSTRAINT DF_Quotes_Total DEFAULT (0),
        IsActive BIT NOT NULL CONSTRAINT DF_Quotes_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_Quotes_CreatedAt DEFAULT SYSUTCDATETIME(),
        CreatedByUserId INT NULL,
        UpdatedAt DATETIME2(7) NULL,
        UpdatedByUserId INT NULL,
        DeletedAt DATETIME2(7) NULL,
        CONSTRAINT PK_Quotes PRIMARY KEY CLUSTERED (QuoteId ASC),
        CONSTRAINT CK_Quotes_QuoteNumber_NotBlank
            CHECK (LEN(LTRIM(RTRIM(QuoteNumber))) > 0),
        CONSTRAINT CK_Quotes_Status_Allowed
            CHECK (Status IN (N'Draft', N'Sent', N'Tracking', N'Approved', N'Rejected')),
        CONSTRAINT CK_Quotes_VatRate_NonNegative
            CHECK (VatRate >= 0),
        CONSTRAINT FK_Quotes_Customers FOREIGN KEY (CustomerId)
            REFERENCES dbo.Customers (CustomerId),
        CONSTRAINT FK_Quotes_WorkItems FOREIGN KEY (ProjectId)
            REFERENCES dbo.WorkItems (WorkItemId),
        CONSTRAINT FK_Quotes_CreatedByUser FOREIGN KEY (CreatedByUserId)
            REFERENCES dbo.Users (UserId),
        CONSTRAINT FK_Quotes_UpdatedByUser FOREIGN KEY (UpdatedByUserId)
            REFERENCES dbo.Users (UserId)
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_Quotes_QuoteNumber'
      AND object_id = OBJECT_ID(N'dbo.Quotes')
)
BEGIN
    CREATE UNIQUE INDEX UX_Quotes_QuoteNumber
        ON dbo.Quotes (QuoteNumber ASC);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_Quotes_CustomerId_IsActive'
      AND object_id = OBJECT_ID(N'dbo.Quotes')
)
BEGIN
    CREATE INDEX IX_Quotes_CustomerId_IsActive
        ON dbo.Quotes (CustomerId ASC, IsActive ASC);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_Quotes_ProjectId_IsActive'
      AND object_id = OBJECT_ID(N'dbo.Quotes')
)
BEGIN
    CREATE INDEX IX_Quotes_ProjectId_IsActive
        ON dbo.Quotes (ProjectId ASC, IsActive ASC);
END
GO

IF OBJECT_ID(N'dbo.QuoteLineItems', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.QuoteLineItems
    (
        QuoteLineItemId INT IDENTITY(1,1) NOT NULL,
        QuoteId INT NOT NULL,
        Description NVARCHAR(500) NOT NULL,
        Quantity DECIMAL(18,2) NOT NULL,
        Unit NVARCHAR(50) NOT NULL,
        UnitPrice DECIMAL(18,2) NOT NULL,
        LineTotal DECIMAL(18,2) NOT NULL CONSTRAINT DF_QuoteLineItems_LineTotal DEFAULT (0),
        SortOrder INT NOT NULL CONSTRAINT DF_QuoteLineItems_SortOrder DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_QuoteLineItems_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CONSTRAINT PK_QuoteLineItems PRIMARY KEY CLUSTERED (QuoteLineItemId ASC),
        CONSTRAINT CK_QuoteLineItems_Description_NotBlank
            CHECK (LEN(LTRIM(RTRIM(Description))) > 0),
        CONSTRAINT CK_QuoteLineItems_Unit_NotBlank
            CHECK (LEN(LTRIM(RTRIM(Unit))) > 0),
        CONSTRAINT CK_QuoteLineItems_Quantity_NonNegative
            CHECK (Quantity >= 0),
        CONSTRAINT CK_QuoteLineItems_UnitPrice_NonNegative
            CHECK (UnitPrice >= 0),
        CONSTRAINT FK_QuoteLineItems_Quotes FOREIGN KEY (QuoteId)
            REFERENCES dbo.Quotes (QuoteId)
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_QuoteLineItems_QuoteId_SortOrder'
      AND object_id = OBJECT_ID(N'dbo.QuoteLineItems')
)
BEGIN
    CREATE INDEX IX_QuoteLineItems_QuoteId_SortOrder
        ON dbo.QuoteLineItems (QuoteId ASC, SortOrder ASC, QuoteLineItemId ASC);
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Quotes_GetList
    @Search NVARCHAR(200) = NULL,
    @CustomerId INT = NULL,
    @ProjectId INT = NULL,
    @Status NVARCHAR(50) = NULL,
    @FromDate DATE = NULL,
    @ToDate DATE = NULL,
    @IncludeInactive BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NormalizedSearch NVARCHAR(200) = NULLIF(LTRIM(RTRIM(@Search)), N'');
    DECLARE @NormalizedStatus NVARCHAR(50) = NULLIF(LTRIM(RTRIM(@Status)), N'');

    SELECT
        q.QuoteId,
        q.QuoteNumber,
        q.CustomerId,
        c.CustomerName,
        q.ProjectId,
        p.Title AS ProjectTitle,
        q.QuoteDate,
        q.ValidUntil,
        q.Status,
        q.Notes,
        q.VatRate,
        q.Subtotal,
        q.VatAmount,
        q.Total,
        q.IsActive,
        q.CreatedAt,
        q.UpdatedAt
    FROM dbo.Quotes q
    INNER JOIN dbo.Customers c ON q.CustomerId = c.CustomerId
    LEFT JOIN dbo.WorkItems p ON q.ProjectId = p.WorkItemId
    WHERE (@IncludeInactive = 1 OR q.IsActive = 1)
      AND (@CustomerId IS NULL OR q.CustomerId = @CustomerId)
      AND (@ProjectId IS NULL OR q.ProjectId = @ProjectId)
      AND (@NormalizedStatus IS NULL OR q.Status = @NormalizedStatus)
      AND (@FromDate IS NULL OR q.QuoteDate >= @FromDate)
      AND (@ToDate IS NULL OR q.QuoteDate <= @ToDate)
      AND (
            @NormalizedSearch IS NULL
            OR q.QuoteNumber LIKE N'%' + @NormalizedSearch + N'%'
            OR c.CustomerName LIKE N'%' + @NormalizedSearch + N'%'
            OR ISNULL(p.Title, N'') LIKE N'%' + @NormalizedSearch + N'%'
            OR ISNULL(q.Notes, N'') LIKE N'%' + @NormalizedSearch + N'%'
          )
    ORDER BY q.QuoteDate DESC, q.QuoteId DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Quotes_GetById
    @QuoteId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        q.QuoteId,
        q.QuoteNumber,
        q.CustomerId,
        c.CustomerName,
        q.ProjectId,
        p.Title AS ProjectTitle,
        q.QuoteDate,
        q.ValidUntil,
        q.Status,
        q.Notes,
        q.VatRate,
        q.Subtotal,
        q.VatAmount,
        q.Total,
        q.IsActive,
        q.CreatedAt,
        q.UpdatedAt
    FROM dbo.Quotes q
    INNER JOIN dbo.Customers c ON q.CustomerId = c.CustomerId
    LEFT JOIN dbo.WorkItems p ON q.ProjectId = p.WorkItemId
    WHERE q.QuoteId = @QuoteId;

    SELECT
        li.QuoteLineItemId,
        li.QuoteId,
        li.Description,
        li.Quantity,
        li.Unit,
        li.UnitPrice,
        li.LineTotal,
        li.SortOrder
    FROM dbo.QuoteLineItems li
    WHERE li.QuoteId = @QuoteId
    ORDER BY li.SortOrder ASC, li.QuoteLineItemId ASC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Quotes_Create
    @CustomerId INT,
    @ProjectId INT = NULL,
    @QuoteDate DATE,
    @ValidUntil DATE = NULL,
    @Status NVARCHAR(50) = N'Draft',
    @Notes NVARCHAR(1000) = NULL,
    @VatRate DECIMAL(5,2) = 17.00,
    @CreatedByUserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NormalizedStatus NVARCHAR(50) =
        ISNULL(NULLIF(LTRIM(RTRIM(@Status)), N''), N'Draft');

    IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerId = @CustomerId)
    BEGIN
        THROW 51300, 'Customer was not found.', 1;
    END;

    IF @ProjectId IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM dbo.WorkItems WHERE WorkItemId = @ProjectId AND WorkType = 'Project'
    )
    BEGIN
        THROW 51301, 'Project was not found.', 1;
    END;

    IF @NormalizedStatus NOT IN (N'Draft', N'Sent', N'Tracking', N'Approved', N'Rejected')
    BEGIN
        THROW 51302, 'Status is invalid.', 1;
    END;

    IF @VatRate IS NULL OR @VatRate < 0
    BEGIN
        THROW 51303, 'VatRate cannot be negative.', 1;
    END;

    DECLARE @Year INT = YEAR(SYSUTCDATETIME());
    DECLARE @Prefix NVARCHAR(20) = N'Q-' + CAST(@Year AS NVARCHAR(4)) + N'-';
    DECLARE @NextSequence INT;

    SELECT @NextSequence = ISNULL(MAX(CAST(RIGHT(QuoteNumber, 4) AS INT)), 0) + 1
    FROM dbo.Quotes
    WHERE QuoteNumber LIKE @Prefix + N'[0-9][0-9][0-9][0-9]';

    DECLARE @QuoteNumber NVARCHAR(50) =
        @Prefix + RIGHT(N'0000' + CAST(@NextSequence AS NVARCHAR(10)), 4);

    INSERT INTO dbo.Quotes
    (
        QuoteNumber,
        CustomerId,
        ProjectId,
        QuoteDate,
        ValidUntil,
        Status,
        Notes,
        VatRate,
        Subtotal,
        VatAmount,
        Total,
        IsActive,
        CreatedAt,
        CreatedByUserId
    )
    VALUES
    (
        @QuoteNumber,
        @CustomerId,
        @ProjectId,
        @QuoteDate,
        @ValidUntil,
        @NormalizedStatus,
        NULLIF(LTRIM(RTRIM(@Notes)), N''),
        @VatRate,
        0,
        0,
        0,
        1,
        SYSUTCDATETIME(),
        @CreatedByUserId
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS QuoteId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Quotes_UpdateHeader
    @QuoteId INT,
    @CustomerId INT,
    @ProjectId INT = NULL,
    @QuoteDate DATE,
    @ValidUntil DATE = NULL,
    @Status NVARCHAR(50),
    @Notes NVARCHAR(1000) = NULL,
    @VatRate DECIMAL(5,2),
    @UpdatedByUserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NormalizedStatus NVARCHAR(50) =
        ISNULL(NULLIF(LTRIM(RTRIM(@Status)), N''), N'Draft');

    IF NOT EXISTS (SELECT 1 FROM dbo.Quotes WHERE QuoteId = @QuoteId AND IsActive = 1)
    BEGIN
        THROW 51304, 'Quote was not found.', 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerId = @CustomerId)
    BEGIN
        THROW 51300, 'Customer was not found.', 1;
    END;

    IF @ProjectId IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM dbo.WorkItems WHERE WorkItemId = @ProjectId AND WorkType = 'Project'
    )
    BEGIN
        THROW 51301, 'Project was not found.', 1;
    END;

    IF @NormalizedStatus NOT IN (N'Draft', N'Sent', N'Tracking', N'Approved', N'Rejected')
    BEGIN
        THROW 51302, 'Status is invalid.', 1;
    END;

    IF @VatRate IS NULL OR @VatRate < 0
    BEGIN
        THROW 51303, 'VatRate cannot be negative.', 1;
    END;

    UPDATE dbo.Quotes
    SET
        CustomerId = @CustomerId,
        ProjectId = @ProjectId,
        QuoteDate = @QuoteDate,
        ValidUntil = @ValidUntil,
        Status = @NormalizedStatus,
        Notes = NULLIF(LTRIM(RTRIM(@Notes)), N''),
        VatRate = @VatRate,
        UpdatedAt = SYSUTCDATETIME(),
        UpdatedByUserId = @UpdatedByUserId
    WHERE QuoteId = @QuoteId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Quotes_AddLine
    @QuoteId INT,
    @Description NVARCHAR(500),
    @Quantity DECIMAL(18,2),
    @Unit NVARCHAR(50),
    @UnitPrice DECIMAL(18,2),
    @SortOrder INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Quotes WHERE QuoteId = @QuoteId)
    BEGIN
        THROW 51304, 'Quote was not found.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@Description)), N'') IS NULL
    BEGIN
        THROW 51305, 'Line description is required.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@Unit)), N'') IS NULL
    BEGIN
        THROW 51306, 'Line unit is required.', 1;
    END;

    IF @Quantity < 0
    BEGIN
        THROW 51307, 'Line quantity cannot be negative.', 1;
    END;

    IF @UnitPrice < 0
    BEGIN
        THROW 51308, 'Line unit price cannot be negative.', 1;
    END;

    IF @SortOrder IS NULL
    BEGIN
        SELECT @SortOrder = ISNULL(MAX(SortOrder), 0) + 1
        FROM dbo.QuoteLineItems
        WHERE QuoteId = @QuoteId;
    END;

    INSERT INTO dbo.QuoteLineItems
    (
        QuoteId,
        Description,
        Quantity,
        Unit,
        UnitPrice,
        LineTotal,
        SortOrder,
        CreatedAt
    )
    VALUES
    (
        @QuoteId,
        LTRIM(RTRIM(@Description)),
        @Quantity,
        LTRIM(RTRIM(@Unit)),
        @UnitPrice,
        ROUND(@Quantity * @UnitPrice, 2),
        @SortOrder,
        SYSUTCDATETIME()
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS QuoteLineItemId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Quotes_DeleteLinesByQuote
    @QuoteId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM dbo.QuoteLineItems
    WHERE QuoteId = @QuoteId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Quotes_RecalculateTotals
    @QuoteId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Subtotal DECIMAL(18,2);
    DECLARE @VatRate DECIMAL(5,2);

    SELECT @VatRate = VatRate
    FROM dbo.Quotes
    WHERE QuoteId = @QuoteId;

    IF @VatRate IS NULL
    BEGIN
        THROW 51304, 'Quote was not found.', 1;
    END;

    SELECT @Subtotal = ISNULL(SUM(LineTotal), 0)
    FROM dbo.QuoteLineItems
    WHERE QuoteId = @QuoteId;

    DECLARE @VatAmount DECIMAL(18,2) = ROUND(@Subtotal * @VatRate / 100.0, 2);

    UPDATE dbo.Quotes
    SET
        Subtotal = @Subtotal,
        VatAmount = @VatAmount,
        Total = @Subtotal + @VatAmount,
        UpdatedAt = SYSUTCDATETIME()
    WHERE QuoteId = @QuoteId;

    SELECT
        @Subtotal AS Subtotal,
        @VatAmount AS VatAmount,
        @Subtotal + @VatAmount AS Total;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_Quotes_Deactivate
    @QuoteId INT,
    @UpdatedByUserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Quotes
    SET
        IsActive = 0,
        UpdatedAt = SYSUTCDATETIME(),
        UpdatedByUserId = @UpdatedByUserId,
        DeletedAt = SYSUTCDATETIME()
    WHERE QuoteId = @QuoteId
      AND IsActive = 1;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

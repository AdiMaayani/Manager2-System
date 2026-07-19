SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_CreateWorkItem
    @Title NVARCHAR(150), @WorkType NVARCHAR(50), @Status NVARCHAR(50),
    @BillingType NVARCHAR(50), @Description NVARCHAR(1000)=NULL,
    @CustomerId INT=NULL, @SiteId INT=NULL, @ParentWorkItemId INT=NULL,
    @DealCloseDate DATETIME2=NULL, @FinanceProjectNumber NVARCHAR(100)=NULL,
    @InvoiceNumber NVARCHAR(100)=NULL, @PlannedStart DATETIME2=NULL,
    @PlannedEnd DATETIME2=NULL, @EstimatedHours DECIMAL(5,2)=NULL,
    @ActualStart DATETIME2=NULL, @ActualEnd DATETIME2=NULL,
    @ActualHours DECIMAL(10,2)=NULL, @Priority NVARCHAR(20)=NULL,
    @RequiredRole NVARCHAR(100)=NULL, @IsLocked BIT=0,
    @TaskCategory NVARCHAR(20)=NULL, @MilestoneId INT=NULL,
    @RequiredRolesXml XML=NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @RawRequiredRoles TABLE
    (
        SortOrdinal INT IDENTITY(1, 1) NOT NULL,
        RoleName NVARCHAR(100) NOT NULL
    );
    DECLARE @NormalizedRequiredRoles TABLE
    (
        RoleName NVARCHAR(100) NOT NULL PRIMARY KEY,
        SortOrdinal INT NOT NULL
    );
    DECLARE @ResolvedRequiredRole NVARCHAR(100);
    DECLARE @NewWorkItemId INT;

    IF @RequiredRolesXml IS NOT NULL AND @RequiredRolesXml.exist('/Roles') = 0
        THROW 53330, 'RequiredRolesXml must have a Roles root element.', 1;

    IF @RequiredRolesXml IS NOT NULL
       AND EXISTS
       (
           SELECT 1
           FROM @RequiredRolesXml.nodes('/Roles/Role') AS requiredRole(roleNode)
           WHERE LEN(requiredRole.roleNode.value('(text())[1]', 'nvarchar(4000)')) > 100
       )
    BEGIN
        THROW 53331, 'A required role cannot exceed 100 characters.', 1;
    END;

    IF @RequiredRolesXml IS NOT NULL
    BEGIN
        INSERT INTO @RawRequiredRoles (RoleName)
        SELECT CONVERT(NVARCHAR(100), LTRIM(RTRIM(requiredRole.roleNode.value('(text())[1]', 'nvarchar(4000)'))))
        FROM @RequiredRolesXml.nodes('/Roles/Role') AS requiredRole(roleNode)
        WHERE DATALENGTH(LTRIM(RTRIM(requiredRole.roleNode.value('(text())[1]', 'nvarchar(4000)')))) > 0;
    END
    ELSE IF NULLIF(LTRIM(RTRIM(@RequiredRole)), N'') IS NOT NULL
    BEGIN
        INSERT INTO @RawRequiredRoles (RoleName)
        VALUES (LTRIM(RTRIM(@RequiredRole)));
    END;

    INSERT INTO @NormalizedRequiredRoles (RoleName, SortOrdinal)
    SELECT rawRole.RoleName, rawRole.SortOrdinal
    FROM @RawRequiredRoles AS rawRole
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM @RawRequiredRoles AS earlierRole
        WHERE earlierRole.SortOrdinal < rawRole.SortOrdinal
          AND earlierRole.RoleName = rawRole.RoleName
    );

    SELECT TOP (1) @ResolvedRequiredRole = RoleName
    FROM @NormalizedRequiredRoles
    ORDER BY SortOrdinal, RoleName;

    DECLARE @Category NVARCHAR(20)=NULLIF(LTRIM(RTRIM(@TaskCategory)),N'');
    DECLARE @DerivedWorkType NVARCHAR(50);

    IF @Category IS NULL
        SET @Category=CASE WHEN @WorkType=N'ServiceCall' THEN N'ServiceCall'
                           WHEN @WorkType=N'Task' AND @ParentWorkItemId IS NULL THEN N'Regular'
                           WHEN @WorkType=N'Task' THEN N'Project' END;
    SET @DerivedWorkType=CASE @Category WHEN N'Regular' THEN N'Task'
        WHEN N'Project' THEN N'Task' WHEN N'ServiceCall' THEN N'ServiceCall'
        ELSE CASE WHEN @WorkType=N'Project' THEN N'Project' END END;
    IF @DerivedWorkType IS NULL THROW 51100, 'Invalid TaskCategory/WorkType.', 1;
    IF @DerivedWorkType=N'Project' AND (@ParentWorkItemId IS NOT NULL OR @MilestoneId IS NOT NULL)
        THROW 51109, 'Project containers cannot have a parent or milestone.', 1;
    IF @Category=N'Regular' AND (@ParentWorkItemId IS NOT NULL OR @MilestoneId IS NOT NULL)
        THROW 51101, 'Regular tasks cannot have a project or milestone.', 1;
    IF @Category=N'Project' AND NOT EXISTS(SELECT 1 FROM dbo.WorkItems WHERE WorkItemId=@ParentWorkItemId AND WorkType=N'Project' AND IsArchived=0)
        THROW 51102, 'Project task requires an active project parent.', 1;
    IF @Category=N'ServiceCall' AND (@ParentWorkItemId IS NOT NULL OR @MilestoneId IS NOT NULL)
        THROW 51103, 'Service calls cannot have a project parent or milestone.', 1;
    IF @CustomerId IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dbo.Customers WHERE CustomerId=@CustomerId)
        THROW 51107, 'Customer not found.', 1;
    IF @SiteId IS NOT NULL AND @CustomerId IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dbo.Sites WHERE SiteId=@SiteId AND CustomerId=@CustomerId)
        THROW 51108, 'Site does not belong to the selected customer.', 1;
    IF @SiteId IS NOT NULL AND @CustomerId IS NULL AND NOT EXISTS(SELECT 1 FROM dbo.Sites WHERE SiteId=@SiteId)
        THROW 51110, 'Site not found.', 1;
    IF @MilestoneId IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dbo.ProjectMilestones WHERE ProjectMilestoneId=@MilestoneId AND ProjectId=@ParentWorkItemId AND IsActive=1)
        THROW 51104, 'Milestone does not belong to the selected project.', 1;
    IF (@PlannedStart IS NULL AND @PlannedEnd IS NOT NULL) OR (@PlannedStart IS NOT NULL AND @PlannedEnd IS NULL)
        THROW 51105, 'PlannedStart and PlannedEnd must both be supplied or both be null.', 1;
    IF @PlannedEnd IS NOT NULL AND @PlannedEnd<=@PlannedStart
        THROW 51106, 'PlannedEnd must be later than PlannedStart.', 1;

    DECLARE @DerivedHours DECIMAL(5,2)=CASE WHEN @PlannedStart IS NULL THEN NULL
        ELSE CAST(DATEDIFF(MINUTE,@PlannedStart,@PlannedEnd)/60.0 AS DECIMAL(5,2)) END;
    BEGIN TRY
        BEGIN TRANSACTION;

        INSERT dbo.WorkItems(Title,WorkType,TaskCategory,Status,BillingType,Description,CustomerId,SiteId,
            CreatedAt,ParentWorkItemId,MilestoneId,DealCloseDate,FinanceProjectNumber,InvoiceNumber,
            PlannedStart,PlannedEnd,EstimatedHours,ActualStart,ActualEnd,ActualHours,Priority,RequiredRole,IsLocked)
        VALUES(@Title,@DerivedWorkType,@Category,@Status,@BillingType,@Description,@CustomerId,@SiteId,
            SYSUTCDATETIME(),@ParentWorkItemId,@MilestoneId,@DealCloseDate,@FinanceProjectNumber,@InvoiceNumber,
            @PlannedStart,@PlannedEnd,@DerivedHours,@ActualStart,@ActualEnd,@ActualHours,@Priority,@ResolvedRequiredRole,@IsLocked);

        SET @NewWorkItemId = CONVERT(INT, SCOPE_IDENTITY());

        INSERT INTO dbo.WorkItemRequiredRoles (WorkItemId, RoleName, CreatedAtUtc)
        SELECT @NewWorkItemId, requiredRole.RoleName, SYSUTCDATETIME()
        FROM @NormalizedRequiredRoles AS requiredRole;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        THROW;
    END CATCH;

    SELECT @NewWorkItemId AS NewWorkItemId;
END
GO

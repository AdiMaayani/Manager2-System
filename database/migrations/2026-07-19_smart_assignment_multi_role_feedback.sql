/*
    ManageR2 Smart Assignment multi-role persistence and recommendation feedback.

    SQL Server 2016 SP1+-compatible at database compatibility level 100.
    This migration is additive and rerunnable. It must be applied manually after
    2026-07-18_smart_assignment_policy_profiles.sql and before the final canonical SP redeploy.
    The application must never execute this migration automatically.
*/

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.Employees', N'U') IS NULL
    THROW 53300, 'dbo.Employees is required before the multi-role migration.', 1;

IF OBJECT_ID(N'dbo.WorkItems', N'U') IS NULL
    THROW 53301, 'dbo.WorkItems is required before the multi-role migration.', 1;

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
    THROW 53302, 'dbo.Users is required before the feedback migration.', 1;

IF OBJECT_ID(N'dbo.Rec_TaskAssignmentRecommendations', N'U') IS NULL
    THROW 53303, 'dbo.Rec_TaskAssignmentRecommendations is required before the feedback migration.', 1;

IF OBJECT_ID(N'dbo.Rec_EmployeePlannedStops', N'U') IS NULL
    THROW 53308, 'dbo.Rec_EmployeePlannedStops is required before the route-origin migration.', 1;

IF OBJECT_ID(N'dbo.Rec_EmployeeLocationEvents', N'U') IS NULL
    THROW 53309, 'dbo.Rec_EmployeeLocationEvents is required before the route-origin migration.', 1;

IF COL_LENGTH(N'dbo.Rec_TaskAssignmentRecommendations', N'PolicyProfileKey') IS NULL
   OR COL_LENGTH(N'dbo.Rec_TaskAssignmentRecommendations', N'PolicyVersionNumber') IS NULL
   OR COL_LENGTH(N'dbo.Rec_TaskAssignmentRecommendations', N'PolicyDisplayName') IS NULL
BEGIN
    THROW 53304, 'Apply the Smart Assignment policy migration before the multi-role feedback migration.', 1;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'dbo.WorkItemRequiredRoles', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.WorkItemRequiredRoles
        (
            WorkItemId INT NOT NULL,
            RoleName NVARCHAR(100) NOT NULL,
            CreatedAtUtc DATETIME2(0) NOT NULL
                CONSTRAINT DF_WorkItemRequiredRoles_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
            CONSTRAINT PK_WorkItemRequiredRoles
                PRIMARY KEY CLUSTERED (WorkItemId, RoleName),
            CONSTRAINT FK_WorkItemRequiredRoles_WorkItems
                FOREIGN KEY (WorkItemId) REFERENCES dbo.WorkItems (WorkItemId),
            CONSTRAINT CK_WorkItemRequiredRoles_RoleName
                CHECK
                (
                    DATALENGTH(RoleName) > 0
                    AND DATALENGTH(RoleName) = DATALENGTH(LTRIM(RTRIM(RoleName)))
                )
        );
    END
    ELSE IF COL_LENGTH(N'dbo.WorkItemRequiredRoles', N'WorkItemId') IS NULL
         OR COL_LENGTH(N'dbo.WorkItemRequiredRoles', N'RoleName') IS NULL
         OR COL_LENGTH(N'dbo.WorkItemRequiredRoles', N'CreatedAtUtc') IS NULL
         OR NOT EXISTS
         (
             SELECT 1
             FROM sys.key_constraints
             WHERE parent_object_id = OBJECT_ID(N'dbo.WorkItemRequiredRoles')
               AND name = N'PK_WorkItemRequiredRoles'
               AND type = N'PK'
         )
    BEGIN
        THROW 53305, 'dbo.WorkItemRequiredRoles has an incompatible shape.', 1;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.WorkItemRequiredRoles')
          AND name = N'IX_WorkItemRequiredRoles_RoleName_WorkItemId'
    )
    BEGIN
        CREATE NONCLUSTERED INDEX IX_WorkItemRequiredRoles_RoleName_WorkItemId
            ON dbo.WorkItemRequiredRoles (RoleName, WorkItemId);
    END;

    IF OBJECT_ID(N'dbo.EmployeeProfessions', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.EmployeeProfessions
        (
            EmployeeId INT NOT NULL,
            RoleName NVARCHAR(100) NOT NULL,
            IsPrimary BIT NOT NULL
                CONSTRAINT DF_EmployeeProfessions_IsPrimary DEFAULT (0),
            CreatedAtUtc DATETIME2(0) NOT NULL
                CONSTRAINT DF_EmployeeProfessions_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
            UpdatedAtUtc DATETIME2(0) NOT NULL
                CONSTRAINT DF_EmployeeProfessions_UpdatedAtUtc DEFAULT SYSUTCDATETIME(),
            CONSTRAINT PK_EmployeeProfessions
                PRIMARY KEY CLUSTERED (EmployeeId, RoleName),
            CONSTRAINT FK_EmployeeProfessions_Employees
                FOREIGN KEY (EmployeeId) REFERENCES dbo.Employees (EmployeeId),
            CONSTRAINT CK_EmployeeProfessions_RoleName
                CHECK
                (
                    DATALENGTH(RoleName) > 0
                    AND DATALENGTH(RoleName) = DATALENGTH(LTRIM(RTRIM(RoleName)))
                )
        );
    END
    ELSE IF COL_LENGTH(N'dbo.EmployeeProfessions', N'EmployeeId') IS NULL
         OR COL_LENGTH(N'dbo.EmployeeProfessions', N'RoleName') IS NULL
         OR COL_LENGTH(N'dbo.EmployeeProfessions', N'IsPrimary') IS NULL
         OR COL_LENGTH(N'dbo.EmployeeProfessions', N'CreatedAtUtc') IS NULL
         OR COL_LENGTH(N'dbo.EmployeeProfessions', N'UpdatedAtUtc') IS NULL
         OR NOT EXISTS
         (
             SELECT 1
             FROM sys.key_constraints
             WHERE parent_object_id = OBJECT_ID(N'dbo.EmployeeProfessions')
               AND name = N'PK_EmployeeProfessions'
               AND type = N'PK'
         )
    BEGIN
        THROW 53306, 'dbo.EmployeeProfessions has an incompatible shape.', 1;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.EmployeeProfessions')
          AND name = N'UX_EmployeeProfessions_OnePrimaryPerEmployee'
    )
    BEGIN
        CREATE UNIQUE NONCLUSTERED INDEX UX_EmployeeProfessions_OnePrimaryPerEmployee
            ON dbo.EmployeeProfessions (EmployeeId)
            WHERE IsPrimary = 1;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.EmployeeProfessions')
          AND name = N'IX_EmployeeProfessions_RoleName_EmployeeId'
    )
    BEGIN
        CREATE NONCLUSTERED INDEX IX_EmployeeProfessions_RoleName_EmployeeId
            ON dbo.EmployeeProfessions (RoleName, EmployeeId)
            INCLUDE (IsPrimary);
    END;

    /*
        Planned-stop and last-location origins need persisted coordinates for deterministic routing.
        Older schemas only stored their formatted address, so add nullable coordinates without
        transforming existing rows.
    */
    IF OBJECT_ID(N'dbo.Rec_EmployeePlannedStops', N'U') IS NOT NULL
       AND COL_LENGTH(N'dbo.Rec_EmployeePlannedStops', N'Latitude') IS NULL
    BEGIN
        ALTER TABLE dbo.Rec_EmployeePlannedStops
        ADD Latitude DECIMAL(9, 6) NULL;
    END;

    IF OBJECT_ID(N'dbo.Rec_EmployeePlannedStops', N'U') IS NOT NULL
       AND COL_LENGTH(N'dbo.Rec_EmployeePlannedStops', N'Longitude') IS NULL
    BEGIN
        ALTER TABLE dbo.Rec_EmployeePlannedStops
        ADD Longitude DECIMAL(9, 6) NULL;
    END;

    IF OBJECT_ID(N'dbo.Rec_EmployeeLocationEvents', N'U') IS NOT NULL
       AND COL_LENGTH(N'dbo.Rec_EmployeeLocationEvents', N'Latitude') IS NULL
    BEGIN
        ALTER TABLE dbo.Rec_EmployeeLocationEvents
        ADD Latitude DECIMAL(9, 6) NULL;
    END;

    IF OBJECT_ID(N'dbo.Rec_EmployeeLocationEvents', N'U') IS NOT NULL
       AND COL_LENGTH(N'dbo.Rec_EmployeeLocationEvents', N'Longitude') IS NULL
    BEGIN
        ALTER TABLE dbo.Rec_EmployeeLocationEvents
        ADD Longitude DECIMAL(9, 6) NULL;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM sys.columns AS columnDefinition
        INNER JOIN sys.types AS typeDefinition
            ON typeDefinition.user_type_id = columnDefinition.user_type_id
        WHERE
        (
            (columnDefinition.object_id = OBJECT_ID(N'dbo.Rec_EmployeePlannedStops')
             AND columnDefinition.name IN (N'Latitude', N'Longitude'))
            OR
            (columnDefinition.object_id = OBJECT_ID(N'dbo.Rec_EmployeeLocationEvents')
             AND columnDefinition.name IN (N'Latitude', N'Longitude'))
        )
          AND
          (
              typeDefinition.name NOT IN (N'decimal', N'numeric')
              OR columnDefinition.precision <> 9
              OR columnDefinition.scale <> 6
              OR columnDefinition.is_nullable <> 1
          )
    )
    BEGIN
        THROW 53310, 'Route-origin coordinates must be DECIMAL(9,6) NULL.', 1;
    END;

    IF OBJECT_ID(N'dbo.Rec_RecommendationFeedback', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.Rec_RecommendationFeedback
        (
            RecommendationFeedbackId INT IDENTITY(1, 1) NOT NULL,
            RecommendationId INT NOT NULL,
            ActingUserId INT NOT NULL,
            Rating TINYINT NOT NULL,
            Comment NVARCHAR(1000) NULL,
            PolicyProfileKey NVARCHAR(30) NOT NULL,
            PolicyVersionNumber INT NOT NULL,
            PolicyDisplayName NVARCHAR(150) NULL,
            CreatedAtUtc DATETIME2(0) NOT NULL
                CONSTRAINT DF_Rec_RecommendationFeedback_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
            UpdatedAtUtc DATETIME2(0) NOT NULL
                CONSTRAINT DF_Rec_RecommendationFeedback_UpdatedAtUtc DEFAULT SYSUTCDATETIME(),
            CONSTRAINT PK_Rec_RecommendationFeedback
                PRIMARY KEY CLUSTERED (RecommendationFeedbackId),
            CONSTRAINT UQ_Rec_RecommendationFeedback_Recommendation_User
                UNIQUE (RecommendationId, ActingUserId),
            CONSTRAINT FK_Rec_RecommendationFeedback_Recommendation
                FOREIGN KEY (RecommendationId)
                REFERENCES dbo.Rec_TaskAssignmentRecommendations (RecommendationId),
            CONSTRAINT FK_Rec_RecommendationFeedback_ActingUser
                FOREIGN KEY (ActingUserId) REFERENCES dbo.Users (UserId),
            CONSTRAINT CK_Rec_RecommendationFeedback_Rating
                CHECK (Rating BETWEEN 1 AND 10),
            CONSTRAINT CK_Rec_RecommendationFeedback_PolicyVersion
                CHECK (PolicyVersionNumber > 0),
            CONSTRAINT CK_Rec_RecommendationFeedback_PolicyProfileKey
                CHECK (DATALENGTH(LTRIM(RTRIM(PolicyProfileKey))) > 0),
            CONSTRAINT CK_Rec_RecommendationFeedback_Comment
                CHECK (Comment IS NULL OR DATALENGTH(LTRIM(RTRIM(Comment))) > 0)
        );
    END
    ELSE IF COL_LENGTH(N'dbo.Rec_RecommendationFeedback', N'RecommendationFeedbackId') IS NULL
         OR COL_LENGTH(N'dbo.Rec_RecommendationFeedback', N'RecommendationId') IS NULL
         OR COL_LENGTH(N'dbo.Rec_RecommendationFeedback', N'ActingUserId') IS NULL
         OR COL_LENGTH(N'dbo.Rec_RecommendationFeedback', N'Rating') IS NULL
         OR COL_LENGTH(N'dbo.Rec_RecommendationFeedback', N'Comment') IS NULL
         OR COL_LENGTH(N'dbo.Rec_RecommendationFeedback', N'PolicyProfileKey') IS NULL
         OR COL_LENGTH(N'dbo.Rec_RecommendationFeedback', N'PolicyVersionNumber') IS NULL
         OR COL_LENGTH(N'dbo.Rec_RecommendationFeedback', N'PolicyDisplayName') IS NULL
         OR COL_LENGTH(N'dbo.Rec_RecommendationFeedback', N'CreatedAtUtc') IS NULL
         OR COL_LENGTH(N'dbo.Rec_RecommendationFeedback', N'UpdatedAtUtc') IS NULL
    BEGIN
        THROW 53307, 'dbo.Rec_RecommendationFeedback has an incompatible shape.', 1;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.Rec_RecommendationFeedback')
          AND name = N'UQ_Rec_RecommendationFeedback_Recommendation_User'
          AND is_unique = 1
    )
    BEGIN
        CREATE UNIQUE NONCLUSTERED INDEX UQ_Rec_RecommendationFeedback_Recommendation_User
            ON dbo.Rec_RecommendationFeedback (RecommendationId, ActingUserId);
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.Rec_RecommendationFeedback')
          AND name = N'IX_Rec_RecommendationFeedback_ActingUser_UpdatedAtUtc'
    )
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Rec_RecommendationFeedback_ActingUser_UpdatedAtUtc
            ON dbo.Rec_RecommendationFeedback (ActingUserId, UpdatedAtUtc DESC)
            INCLUDE (RecommendationId, Rating, PolicyProfileKey, PolicyVersionNumber);
    END;

    /*
        Legacy backfill is intentionally conservative: a scalar value seeds a normalized set only
        when that owner has no normalized rows. Reruns never overwrite a collection already managed
        through the additive contract.
    */
    INSERT INTO dbo.EmployeeProfessions
    (
        EmployeeId,
        RoleName,
        IsPrimary,
        CreatedAtUtc,
        UpdatedAtUtc
    )
    SELECT
        employee.EmployeeId,
        LTRIM(RTRIM(employee.PrimaryRole)),
        1,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    FROM dbo.Employees AS employee
    WHERE DATALENGTH(LTRIM(RTRIM(ISNULL(employee.PrimaryRole, N'')))) > 0
      AND NOT EXISTS
      (
          SELECT 1
          FROM dbo.EmployeeProfessions AS existing
          WHERE existing.EmployeeId = employee.EmployeeId
      );

    INSERT INTO dbo.WorkItemRequiredRoles
    (
        WorkItemId,
        RoleName,
        CreatedAtUtc
    )
    SELECT
        workItem.WorkItemId,
        LTRIM(RTRIM(workItem.RequiredRole)),
        SYSUTCDATETIME()
    FROM dbo.WorkItems AS workItem
    WHERE DATALENGTH(LTRIM(RTRIM(ISNULL(workItem.RequiredRole, N'')))) > 0
      AND NOT EXISTS
      (
          SELECT 1
          FROM dbo.WorkItemRequiredRoles AS existing
          WHERE existing.WorkItemId = workItem.WorkItemId
      );

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
GO

PRINT N'Smart Assignment multi-role and feedback migration completed.';
GO

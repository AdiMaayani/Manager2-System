/*
    ManageR2 Smart Assignment policy profiles, immutable versions, and recommendation metadata.

    SQL Server 2016 SP1+-compatible and idempotent (uses CREATE OR ALTER).
    The file is UTF-8; use sqlcmd -f 65001 when running it outside SSMS.
    This migration is intentionally not executed by the application.
*/

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.Rec_SmartAssignmentPolicyProfiles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Rec_SmartAssignmentPolicyProfiles
    (
        PolicyProfileId INT IDENTITY(1, 1) NOT NULL,
        ProfileKey NVARCHAR(30) NOT NULL,
        TaskCategory NVARCHAR(30) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_Rec_SmartAssignmentPolicyProfiles_IsActive DEFAULT (1),
        ActiveVersionNumber INT NULL,
        CreatedAtUtc DATETIME2(0) NOT NULL
            CONSTRAINT DF_Rec_SmartAssignmentPolicyProfiles_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        CreatedByUserId INT NULL,
        UpdatedAtUtc DATETIME2(0) NULL,
        UpdatedByUserId INT NULL,
        CONSTRAINT PK_Rec_SmartAssignmentPolicyProfiles PRIMARY KEY CLUSTERED (PolicyProfileId),
        CONSTRAINT UQ_Rec_SmartAssignmentPolicyProfiles_ProfileKey UNIQUE (ProfileKey),
        CONSTRAINT CK_Rec_SmartAssignmentPolicyProfiles_KeyCategory CHECK
        (
            (ProfileKey = N'Default' AND TaskCategory IS NULL)
            OR (ProfileKey = N'Regular' AND TaskCategory = N'Regular')
            OR (ProfileKey = N'Project' AND TaskCategory = N'Project')
            OR (ProfileKey = N'ServiceCall' AND TaskCategory = N'ServiceCall')
        ),
        CONSTRAINT CK_Rec_SmartAssignmentPolicyProfiles_ActiveVersion CHECK
            (ActiveVersionNumber IS NULL OR ActiveVersionNumber > 0)
    );
END
GO

IF OBJECT_ID(N'dbo.Rec_SmartAssignmentPolicyVersions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Rec_SmartAssignmentPolicyVersions
    (
        PolicyProfileId INT NOT NULL,
        VersionNumber INT NOT NULL,
        DisplayName NVARCHAR(150) NOT NULL,
        Description NVARCHAR(500) NULL,
        ProfessionalFitWeight DECIMAL(5, 2) NOT NULL,
        AvailabilityWeight DECIMAL(5, 2) NOT NULL,
        WorkloadWeight DECIMAL(5, 2) NOT NULL,
        GeographyWeight DECIMAL(5, 2) NOT NULL,
        ExperienceWeight DECIMAL(5, 2) NOT NULL,
        MissingCriticalSkillRejects BIT NOT NULL,
        ExactRequiredRoleMandatory BIT NOT NULL,
        MissingAvailabilityMode NVARCHAR(20) NOT NULL,
        MissingAvailabilityScore DECIMAL(5, 2) NOT NULL,
        MissingRouteScore DECIMAL(5, 2) NOT NULL,
        MissingWorkloadScore DECIMAL(5, 2) NOT NULL,
        MissingExperienceScore DECIMAL(5, 2) NOT NULL,
        NoRequirementsProfessionalFitScore DECIMAL(5, 2) NOT NULL,
        UseContinuityAsTieBreak BIT NOT NULL,
        EnableBatchSimulatedLoadBalancing BIT NOT NULL,
        ChangeReason NVARCHAR(500) NULL,
        CreatedAtUtc DATETIME2(0) NOT NULL
            CONSTRAINT DF_Rec_SmartAssignmentPolicyVersions_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        CreatedByUserId INT NULL,
        CONSTRAINT PK_Rec_SmartAssignmentPolicyVersions
            PRIMARY KEY CLUSTERED (PolicyProfileId, VersionNumber),
        CONSTRAINT FK_Rec_SmartAssignmentPolicyVersions_Profile
            FOREIGN KEY (PolicyProfileId)
            REFERENCES dbo.Rec_SmartAssignmentPolicyProfiles (PolicyProfileId),
        CONSTRAINT CK_Rec_SmartAssignmentPolicyVersions_Version CHECK (VersionNumber > 0),
        CONSTRAINT CK_Rec_SmartAssignmentPolicyVersions_DisplayName CHECK
            (LEN(LTRIM(RTRIM(DisplayName))) > 0),
        CONSTRAINT CK_Rec_SmartAssignmentPolicyVersions_WeightsRange CHECK
        (
            ProfessionalFitWeight BETWEEN 0 AND 100
            AND AvailabilityWeight BETWEEN 0 AND 100
            AND WorkloadWeight BETWEEN 0 AND 100
            AND GeographyWeight BETWEEN 0 AND 100
            AND ExperienceWeight BETWEEN 0 AND 100
        ),
        CONSTRAINT CK_Rec_SmartAssignmentPolicyVersions_WeightsTotal CHECK
        (
            ProfessionalFitWeight + AvailabilityWeight + WorkloadWeight
            + GeographyWeight + ExperienceWeight = 100.00
        ),
        CONSTRAINT CK_Rec_SmartAssignmentPolicyVersions_MissingAvailabilityMode CHECK
            (MissingAvailabilityMode IN (N'NeutralScore', N'Reject')),
        CONSTRAINT CK_Rec_SmartAssignmentPolicyVersions_DefaultScores CHECK
        (
            MissingAvailabilityScore BETWEEN 0 AND 100
            AND MissingRouteScore BETWEEN 0 AND 100
            AND MissingWorkloadScore BETWEEN 0 AND 100
            AND MissingExperienceScore BETWEEN 0 AND 100
            AND NoRequirementsProfessionalFitScore BETWEEN 0 AND 100
        )
    );
END
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_Rec_SmartAssignmentPolicyProfiles_ActiveVersion'
      AND parent_object_id = OBJECT_ID(N'dbo.Rec_SmartAssignmentPolicyProfiles')
)
BEGIN
    ALTER TABLE dbo.Rec_SmartAssignmentPolicyProfiles
    ADD CONSTRAINT FK_Rec_SmartAssignmentPolicyProfiles_ActiveVersion
        FOREIGN KEY (PolicyProfileId, ActiveVersionNumber)
        REFERENCES dbo.Rec_SmartAssignmentPolicyVersions (PolicyProfileId, VersionNumber);
END
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_Rec_SmartAssignmentPolicyProfiles_ActiveTaskCategory'
      AND object_id = OBJECT_ID(N'dbo.Rec_SmartAssignmentPolicyProfiles')
)
BEGIN
    CREATE UNIQUE INDEX UX_Rec_SmartAssignmentPolicyProfiles_ActiveTaskCategory
        ON dbo.Rec_SmartAssignmentPolicyProfiles (TaskCategory)
        WHERE IsActive = 1 AND TaskCategory IS NOT NULL;
END
GO

CREATE OR ALTER TRIGGER dbo.TR_Rec_SmartAssignmentPolicyVersions_Immutable
ON dbo.Rec_SmartAssignmentPolicyVersions
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    THROW 53220, 'Smart Assignment policy versions are immutable; create a new version instead.', 1;
END
GO

INSERT INTO dbo.Rec_SmartAssignmentPolicyProfiles
(
    ProfileKey,
    TaskCategory,
    IsActive,
    CreatedAtUtc
)
SELECT
    seed.ProfileKey,
    seed.TaskCategory,
    1,
    SYSUTCDATETIME()
FROM
(
    VALUES
        (N'Default', CAST(NULL AS NVARCHAR(30))),
        (N'Regular', N'Regular'),
        (N'Project', N'Project'),
        (N'ServiceCall', N'ServiceCall')
) AS seed (ProfileKey, TaskCategory)
WHERE NOT EXISTS
(
    SELECT 1
    FROM dbo.Rec_SmartAssignmentPolicyProfiles AS existing
    WHERE existing.ProfileKey = seed.ProfileKey
);
GO

INSERT INTO dbo.Rec_SmartAssignmentPolicyVersions
(
    PolicyProfileId,
    VersionNumber,
    DisplayName,
    Description,
    ProfessionalFitWeight,
    AvailabilityWeight,
    WorkloadWeight,
    GeographyWeight,
    ExperienceWeight,
    MissingCriticalSkillRejects,
    ExactRequiredRoleMandatory,
    MissingAvailabilityMode,
    MissingAvailabilityScore,
    MissingRouteScore,
    MissingWorkloadScore,
    MissingExperienceScore,
    NoRequirementsProfessionalFitScore,
    UseContinuityAsTieBreak,
    EnableBatchSimulatedLoadBalancing,
    ChangeReason,
    CreatedAtUtc,
    CreatedByUserId
)
SELECT
    profile.PolicyProfileId,
    1,
    CASE profile.ProfileKey
        WHEN N'Default' THEN N'ברירת מחדל'
        WHEN N'Regular' THEN N'משימה כללית'
        WHEN N'Project' THEN N'משימת פרויקט'
        WHEN N'ServiceCall' THEN N'קריאת שירות'
    END,
    N'מדיניות ברירת המחדל של מערכת השיבוץ החכם.',
    35.00,
    25.00,
    15.00,
    15.00,
    10.00,
    1,
    1,
    N'NeutralScore',
    50.00,
    50.00,
    50.00,
    40.00,
    50.00,
    1,
    1,
    N'Initial application defaults',
    SYSUTCDATETIME(),
    NULL
FROM dbo.Rec_SmartAssignmentPolicyProfiles AS profile
WHERE profile.ProfileKey IN (N'Default', N'Regular', N'Project', N'ServiceCall')
  AND NOT EXISTS
  (
      SELECT 1
      FROM dbo.Rec_SmartAssignmentPolicyVersions AS existing
      WHERE existing.PolicyProfileId = profile.PolicyProfileId
  );
GO

UPDATE profile
SET
    ActiveVersionNumber = latest.VersionNumber,
    UpdatedAtUtc = COALESCE(profile.UpdatedAtUtc, latest.CreatedAtUtc),
    UpdatedByUserId = COALESCE(profile.UpdatedByUserId, latest.CreatedByUserId)
FROM dbo.Rec_SmartAssignmentPolicyProfiles AS profile
CROSS APPLY
(
    SELECT TOP (1)
        version.VersionNumber,
        version.CreatedAtUtc,
        version.CreatedByUserId
    FROM dbo.Rec_SmartAssignmentPolicyVersions AS version
    WHERE version.PolicyProfileId = profile.PolicyProfileId
    ORDER BY version.VersionNumber DESC
) AS latest
WHERE profile.ActiveVersionNumber IS NULL;
GO

IF OBJECT_ID(N'dbo.Rec_TaskAssignmentRecommendations', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'dbo.Rec_TaskAssignmentRecommendations', N'PolicyProfileKey') IS NULL
        ALTER TABLE dbo.Rec_TaskAssignmentRecommendations ADD PolicyProfileKey NVARCHAR(30) NULL;

    IF COL_LENGTH(N'dbo.Rec_TaskAssignmentRecommendations', N'PolicyVersionNumber') IS NULL
        ALTER TABLE dbo.Rec_TaskAssignmentRecommendations ADD PolicyVersionNumber INT NULL;

    IF COL_LENGTH(N'dbo.Rec_TaskAssignmentRecommendations', N'PolicyDisplayName') IS NULL
        ALTER TABLE dbo.Rec_TaskAssignmentRecommendations ADD PolicyDisplayName NVARCHAR(150) NULL;

    IF COL_LENGTH(N'dbo.Rec_TaskAssignmentRecommendations', N'PolicySnapshotJson') IS NULL
        ALTER TABLE dbo.Rec_TaskAssignmentRecommendations ADD PolicySnapshotJson NVARCHAR(MAX) NULL;
END
GO

CREATE OR ALTER PROCEDURE dbo.Rec_GetSmartAssignmentPolicyProfiles
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        p.ProfileKey,
        p.TaskCategory,
        p.IsActive,
        v.VersionNumber,
        v.DisplayName,
        v.Description,
        v.ProfessionalFitWeight,
        v.AvailabilityWeight,
        v.WorkloadWeight,
        v.GeographyWeight,
        v.ExperienceWeight,
        v.MissingCriticalSkillRejects,
        v.ExactRequiredRoleMandatory,
        v.MissingAvailabilityMode,
        v.MissingAvailabilityScore,
        v.MissingRouteScore,
        v.MissingWorkloadScore,
        v.MissingExperienceScore,
        v.NoRequirementsProfessionalFitScore,
        v.UseContinuityAsTieBreak,
        v.EnableBatchSimulatedLoadBalancing,
        v.ChangeReason,
        v.CreatedAtUtc AS UpdatedAtUtc,
        v.CreatedByUserId AS UpdatedByUserId
    FROM dbo.Rec_SmartAssignmentPolicyProfiles AS p
    INNER JOIN dbo.Rec_SmartAssignmentPolicyVersions AS v
        ON v.PolicyProfileId = p.PolicyProfileId
       AND v.VersionNumber = p.ActiveVersionNumber
    ORDER BY
        CASE p.ProfileKey
            WHEN N'Default' THEN 0
            WHEN N'Regular' THEN 1
            WHEN N'Project' THEN 2
            WHEN N'ServiceCall' THEN 3
            ELSE 4
        END,
        p.ProfileKey;
END
GO

CREATE OR ALTER PROCEDURE dbo.Rec_GetSmartAssignmentPolicyVersionHistory
    @ProfileKey NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NormalizedProfileKey NVARCHAR(30) = NULLIF(LTRIM(RTRIM(@ProfileKey)), N'');

    SELECT
        p.ProfileKey,
        p.TaskCategory,
        p.IsActive,
        CAST(CASE WHEN v.VersionNumber = p.ActiveVersionNumber THEN 1 ELSE 0 END AS BIT) AS IsCurrentVersion,
        v.VersionNumber,
        v.DisplayName,
        v.Description,
        v.ProfessionalFitWeight,
        v.AvailabilityWeight,
        v.WorkloadWeight,
        v.GeographyWeight,
        v.ExperienceWeight,
        v.MissingCriticalSkillRejects,
        v.ExactRequiredRoleMandatory,
        v.MissingAvailabilityMode,
        v.MissingAvailabilityScore,
        v.MissingRouteScore,
        v.MissingWorkloadScore,
        v.MissingExperienceScore,
        v.NoRequirementsProfessionalFitScore,
        v.UseContinuityAsTieBreak,
        v.EnableBatchSimulatedLoadBalancing,
        v.ChangeReason,
        v.CreatedAtUtc AS UpdatedAtUtc,
        v.CreatedByUserId AS UpdatedByUserId
    FROM dbo.Rec_SmartAssignmentPolicyProfiles AS p
    INNER JOIN dbo.Rec_SmartAssignmentPolicyVersions AS v
        ON v.PolicyProfileId = p.PolicyProfileId
    WHERE p.ProfileKey = @NormalizedProfileKey
    ORDER BY v.VersionNumber DESC;
END
GO

/*
    The canonical definitions for dbo.Rec_SaveSmartAssignmentPolicyVersion,
    dbo.Rec_SaveTaskAssignmentRecommendation, dbo.Rec_CreateRecommendationRun, and
    dbo.Rec_CompleteRecommendationRun are maintained in database/SP. Re-deploy the canonical SP
    folder immediately after this migration. Keeping the transactional procedures in their canonical
    sources prevents drift during review.
*/

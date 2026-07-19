SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER PROCEDURE dbo.Rec_SaveSmartAssignmentPolicyVersion
    @ProfileKey NVARCHAR(30),
    @ExpectedVersionNumber INT,
    @DisplayName NVARCHAR(150),
    @Description NVARCHAR(500) = NULL,
    @ProfessionalFitWeight DECIMAL(7, 4),
    @AvailabilityWeight DECIMAL(7, 4),
    @WorkloadWeight DECIMAL(7, 4),
    @GeographyWeight DECIMAL(7, 4),
    @ExperienceWeight DECIMAL(7, 4),
    @MissingCriticalSkillRejects BIT,
    @ExactRequiredRoleMandatory BIT,
    @MissingAvailabilityMode NVARCHAR(20),
    @MissingAvailabilityScore DECIMAL(7, 4),
    @MissingRouteScore DECIMAL(7, 4),
    @MissingWorkloadScore DECIMAL(7, 4),
    @MissingExperienceScore DECIMAL(7, 4),
    @NoRequirementsProfessionalFitScore DECIMAL(7, 4),
    @UseContinuityAsTieBreak BIT,
    @EnableBatchSimulatedLoadBalancing BIT,
    @IsActive BIT,
    @ChangeReason NVARCHAR(500) = NULL,
    @UpdatedByUserId INT,
    @ClientIp NVARCHAR(64) = NULL,
    @UserAgent NVARCHAR(512) = NULL,
    @IsReset BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @NormalizedProfileKey NVARCHAR(30) = NULLIF(LTRIM(RTRIM(@ProfileKey)), N'');
    DECLARE @NormalizedDisplayName NVARCHAR(150) = NULLIF(LTRIM(RTRIM(@DisplayName)), N'');
    DECLARE @NormalizedDescription NVARCHAR(500) = NULLIF(LTRIM(RTRIM(@Description)), N'');
    DECLARE @NormalizedMode NVARCHAR(20) = NULLIF(LTRIM(RTRIM(@MissingAvailabilityMode)), N'');
    DECLARE @NormalizedReason NVARCHAR(500) = NULLIF(LTRIM(RTRIM(@ChangeReason)), N'');

    IF @NormalizedProfileKey IS NULL
        THROW 53200, 'ProfileKey is required.', 1;
    IF @ExpectedVersionNumber IS NULL OR @ExpectedVersionNumber < 1
        THROW 53201, 'ExpectedVersionNumber must be positive.', 1;
    IF @NormalizedDisplayName IS NULL
        THROW 53202, 'DisplayName is required.', 1;
    IF @UpdatedByUserId IS NULL OR @UpdatedByUserId < 1
        THROW 53203, 'UpdatedByUserId is required.', 1;
    IF @IsActive IS NULL
        THROW 53211, 'IsActive is required.', 1;
    IF @NormalizedProfileKey = N'Default' AND @IsActive = 0
        THROW 53210, 'The Default Smart Assignment profile must remain active.', 1;
    IF @NormalizedMode IS NULL OR @NormalizedMode NOT IN (N'NeutralScore', N'Reject')
        THROW 53204, 'MissingAvailabilityMode is invalid.', 1;

    IF @ProfessionalFitWeight IS NULL OR @AvailabilityWeight IS NULL
       OR @WorkloadWeight IS NULL OR @GeographyWeight IS NULL OR @ExperienceWeight IS NULL
        THROW 53212, 'All weights are required.', 1;

    IF @ProfessionalFitWeight < 0 OR @ProfessionalFitWeight > 100
       OR @AvailabilityWeight < 0 OR @AvailabilityWeight > 100
       OR @WorkloadWeight < 0 OR @WorkloadWeight > 100
       OR @GeographyWeight < 0 OR @GeographyWeight > 100
       OR @ExperienceWeight < 0 OR @ExperienceWeight > 100
        THROW 53205, 'All weights must be between 0 and 100.', 1;

    IF @ProfessionalFitWeight + @AvailabilityWeight + @WorkloadWeight
       + @GeographyWeight + @ExperienceWeight <> CAST(100.00 AS DECIMAL(7, 2))
        THROW 53206, 'Smart Assignment weights must sum to 100.', 1;

    IF @ProfessionalFitWeight <> ROUND(@ProfessionalFitWeight, 2)
       OR @AvailabilityWeight <> ROUND(@AvailabilityWeight, 2)
       OR @WorkloadWeight <> ROUND(@WorkloadWeight, 2)
       OR @GeographyWeight <> ROUND(@GeographyWeight, 2)
       OR @ExperienceWeight <> ROUND(@ExperienceWeight, 2)
        THROW 53214, 'Smart Assignment weights cannot have more than two decimal places.', 1;

    IF @MissingAvailabilityScore IS NULL OR @MissingRouteScore IS NULL
       OR @MissingWorkloadScore IS NULL OR @MissingExperienceScore IS NULL
       OR @NoRequirementsProfessionalFitScore IS NULL
        THROW 53213, 'All default scores are required.', 1;

    IF @MissingAvailabilityScore < 0 OR @MissingAvailabilityScore > 100
       OR @MissingRouteScore < 0 OR @MissingRouteScore > 100
       OR @MissingWorkloadScore < 0 OR @MissingWorkloadScore > 100
       OR @MissingExperienceScore < 0 OR @MissingExperienceScore > 100
       OR @NoRequirementsProfessionalFitScore < 0 OR @NoRequirementsProfessionalFitScore > 100
        THROW 53207, 'All default scores must be between 0 and 100.', 1;

    IF @MissingAvailabilityScore <> ROUND(@MissingAvailabilityScore, 2)
       OR @MissingRouteScore <> ROUND(@MissingRouteScore, 2)
       OR @MissingWorkloadScore <> ROUND(@MissingWorkloadScore, 2)
       OR @MissingExperienceScore <> ROUND(@MissingExperienceScore, 2)
       OR @NoRequirementsProfessionalFitScore <> ROUND(@NoRequirementsProfessionalFitScore, 2)
        THROW 53215, 'Default scores cannot have more than two decimal places.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @PolicyProfileId INT;
        DECLARE @CurrentVersionNumber INT;

        SELECT
            @PolicyProfileId = p.PolicyProfileId,
            @CurrentVersionNumber = p.ActiveVersionNumber
        FROM dbo.Rec_SmartAssignmentPolicyProfiles AS p WITH (UPDLOCK, HOLDLOCK)
        WHERE p.ProfileKey = @NormalizedProfileKey
          AND p.ActiveVersionNumber IS NOT NULL;

        IF @PolicyProfileId IS NULL OR @CurrentVersionNumber IS NULL
            THROW 53208, 'The active Smart Assignment profile was not found.', 1;

        IF @CurrentVersionNumber <> @ExpectedVersionNumber
            THROW 53209, 'The Smart Assignment profile was changed by another user. Reload and try again.', 1;

        DECLARE @NewVersionNumber INT = @CurrentVersionNumber + 1;
        DECLARE @ChangedAtUtc DATETIME2(0) = SYSUTCDATETIME();

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
        VALUES
        (
            @PolicyProfileId,
            @NewVersionNumber,
            @NormalizedDisplayName,
            @NormalizedDescription,
            @ProfessionalFitWeight,
            @AvailabilityWeight,
            @WorkloadWeight,
            @GeographyWeight,
            @ExperienceWeight,
            @MissingCriticalSkillRejects,
            @ExactRequiredRoleMandatory,
            @NormalizedMode,
            @MissingAvailabilityScore,
            @MissingRouteScore,
            @MissingWorkloadScore,
            @MissingExperienceScore,
            @NoRequirementsProfessionalFitScore,
            @UseContinuityAsTieBreak,
            @EnableBatchSimulatedLoadBalancing,
            @NormalizedReason,
            @ChangedAtUtc,
            @UpdatedByUserId
        );

        UPDATE dbo.Rec_SmartAssignmentPolicyProfiles
        SET
            IsActive = @IsActive,
            ActiveVersionNumber = @NewVersionNumber,
            UpdatedAtUtc = @ChangedAtUtc,
            UpdatedByUserId = @UpdatedByUserId
        WHERE PolicyProfileId = @PolicyProfileId;

        DECLARE @AuditMetadataJson NVARCHAR(MAX);
        SELECT @AuditMetadataJson =
        (
            SELECT
                @NormalizedProfileKey AS profileKey,
                @CurrentVersionNumber AS previousVersion,
                @NewVersionNumber AS newVersion,
                @NormalizedReason AS changeReason,
                @IsActive AS isActive,
                @IsReset AS resetToDefaults
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );

        DECLARE @AuditResult TABLE (AuditLogId BIGINT);
        DECLARE @AuditAction NVARCHAR(100) =
            CASE WHEN @IsReset = 1 THEN N'SmartAssignmentPolicyReset' ELSE N'SmartAssignmentPolicyUpdated' END;
        DECLARE @AuditSummary NVARCHAR(500) =
            CASE
                WHEN @IsReset = 1 THEN N'Smart Assignment policy reset to application defaults.'
                ELSE N'Smart Assignment policy updated.'
            END;
        DECLARE @AuditClientIp NVARCHAR(64) = LEFT(NULLIF(LTRIM(RTRIM(@ClientIp)), N''), 64);
        DECLARE @AuditUserAgent NVARCHAR(512) = LEFT(NULLIF(LTRIM(RTRIM(@UserAgent)), N''), 512);
        INSERT INTO @AuditResult (AuditLogId)
        EXEC dbo.sp_AuditLog_Create
            @UserId = @UpdatedByUserId,
            @Action = @AuditAction,
            @EntityType = N'SmartAssignmentPolicy',
            @EntityId = @PolicyProfileId,
            @Severity = N'Info',
            @Summary = @AuditSummary,
            @MetadataJson = @AuditMetadataJson,
            @ClientIp = @AuditClientIp,
            @UserAgent = @AuditUserAgent;

        COMMIT TRANSACTION;

        SELECT
            p.ProfileKey,
            p.TaskCategory,
            @IsActive AS IsActive,
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
           AND v.VersionNumber = @NewVersionNumber
        WHERE p.PolicyProfileId = @PolicyProfileId;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

/* =====================================================================
   ManageR2 - Dev Realistic Seed
   01_cleanup_operational_data.sql

   Purpose:
     Remove ALL operational/test data in a foreign-key-safe order so the
     realistic seed (scripts 03-09) can be inserted cleanly.

   Preserves (never touched here):
     Users, Roles, UserRoles, UserDepartments, Departments,
     CompanySettings, and Employees that are linked to a preserved User.
     Reference data Rec_Skills and Rec_WorkZones are also preserved.

   Safety:
     - No USE statement; relies on the current SSMS database context.
     - Refuses to run against system databases.
     - Refuses to run unless this looks like a ManageR2 database.
     - Wrapped in a single transaction with TRY/CATCH + XACT_ABORT.

   Idempotent: re-running deletes nothing new (tables already empty) and
   re-ensures the reserved internal/office work context.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ---- Context / sentinel guards ------------------------------------ */
IF DB_NAME() IN (N'master', N'model', N'msdb', N'tempdb')
    THROW 60010, N'Refusing to run against a system database. Select your ManageR2 dev database first.', 1;

IF OBJECT_ID(N'dbo.WorkItems', N'U') IS NULL
   OR OBJECT_ID(N'dbo.Users', N'U') IS NULL
   OR OBJECT_ID(N'dbo.Customers', N'U') IS NULL
    THROW 60011, N'Current database does not look like a ManageR2 database (missing core tables). Aborting.', 1;

DECLARE @n INT;
RAISERROR(N'== 01_cleanup_operational_data: starting against database [%s] ==', 0, 1, @@SERVERNAME) WITH NOWAIT;
PRINT N'Target database: ' + DB_NAME();

BEGIN TRY
    BEGIN TRAN;

    /* ---- 1. Quotes ------------------------------------------------- */
    DELETE FROM dbo.QuoteLineItems;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from QuoteLineItems.', 0, 1, @n) WITH NOWAIT;

    DELETE FROM dbo.Quotes;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from Quotes.', 0, 1, @n) WITH NOWAIT;

    /* ---- 2. Work reports ------------------------------------------ */
    DELETE FROM dbo.WorkReportSystems;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from WorkReportSystems.', 0, 1, @n) WITH NOWAIT;

    DELETE FROM dbo.WorkReportEmployeeAssignments;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from WorkReportEmployeeAssignments.', 0, 1, @n) WITH NOWAIT;

    DELETE FROM dbo.WorkReports;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from WorkReports.', 0, 1, @n) WITH NOWAIT;

    /* ---- 3. Smart Assignment runtime / computed results ----------- */
    DELETE FROM dbo.Rec_TaskAssignmentRecommendations;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from Rec_TaskAssignmentRecommendations.', 0, 1, @n) WITH NOWAIT;

    DELETE FROM dbo.Rec_RecommendationRuns;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from Rec_RecommendationRuns.', 0, 1, @n) WITH NOWAIT;

    DELETE FROM dbo.Rec_RouteEstimates;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from Rec_RouteEstimates.', 0, 1, @n) WITH NOWAIT;

    DELETE FROM dbo.Rec_EmployeeLocationEvents;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from Rec_EmployeeLocationEvents.', 0, 1, @n) WITH NOWAIT;

    DELETE FROM dbo.Rec_EmployeePlannedStops;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from Rec_EmployeePlannedStops.', 0, 1, @n) WITH NOWAIT;

    /* ---- 4. Smart Assignment input tables (reseeded in 08) -------- */
    DELETE FROM dbo.Rec_WorkItemRequiredSkills;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from Rec_WorkItemRequiredSkills.', 0, 1, @n) WITH NOWAIT;

    DELETE FROM dbo.Rec_WorkItemAlgorithmProfile;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from Rec_WorkItemAlgorithmProfile.', 0, 1, @n) WITH NOWAIT;

    DELETE FROM dbo.Rec_EmployeeSkills;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from Rec_EmployeeSkills.', 0, 1, @n) WITH NOWAIT;

    DELETE FROM dbo.Rec_EmployeeWorkZones;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from Rec_EmployeeWorkZones.', 0, 1, @n) WITH NOWAIT;

    DELETE FROM dbo.Rec_EmployeeAvailability;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from Rec_EmployeeAvailability.', 0, 1, @n) WITH NOWAIT;

    DELETE FROM dbo.Rec_EmployeeCapacity;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from Rec_EmployeeCapacity.', 0, 1, @n) WITH NOWAIT;

    DELETE FROM dbo.Rec_EmployeeBaseAddress;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from Rec_EmployeeBaseAddress.', 0, 1, @n) WITH NOWAIT;

    DELETE FROM dbo.Rec_SiteAddressProfile;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from Rec_SiteAddressProfile.', 0, 1, @n) WITH NOWAIT;

    /* ---- 5. Work assignments -------------------------------------- */
    DELETE FROM dbo.WorkEmployeeAssignments;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from WorkEmployeeAssignments.', 0, 1, @n) WITH NOWAIT;

    DELETE FROM dbo.WorkContractorAssignments;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from WorkContractorAssignments.', 0, 1, @n) WITH NOWAIT;

    /* ---- 6. Project detail children ------------------------------- */
    DELETE FROM dbo.ProjectBoqItems;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from ProjectBoqItems.', 0, 1, @n) WITH NOWAIT;

    DELETE FROM dbo.ProjectDrawings;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from ProjectDrawings.', 0, 1, @n) WITH NOWAIT;

    DELETE FROM dbo.ProjectEquipmentItems;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from ProjectEquipmentItems.', 0, 1, @n) WITH NOWAIT;

    /* ---- 7. WorkItems (self-referencing: children first) ---------- */
    DELETE FROM dbo.WorkItems WHERE ParentWorkItemId IS NOT NULL;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d child rows from WorkItems (tasks/children).', 0, 1, @n) WITH NOWAIT;

    DELETE FROM dbo.WorkItems;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d remaining rows from WorkItems (projects/service calls/containers).', 0, 1, @n) WITH NOWAIT;

    /* ---- 8. Customer-centric reference data ----------------------- */
    DELETE FROM dbo.Contacts;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from Contacts.', 0, 1, @n) WITH NOWAIT;

    DELETE FROM dbo.Sites;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from Sites.', 0, 1, @n) WITH NOWAIT;

    DELETE FROM dbo.Contractors;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from Contractors.', 0, 1, @n) WITH NOWAIT;

    /* ---- 9. Employees NOT linked to a preserved User -------------- */
    DELETE FROM dbo.Employees
    WHERE EmployeeId NOT IN (SELECT EmployeeId FROM dbo.Users WHERE EmployeeId IS NOT NULL);
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from Employees (kept user-linked employees).', 0, 1, @n) WITH NOWAIT;

    /* ---- 10. Customers (incl. reserved Internal customer) --------- */
    DELETE FROM dbo.Customers;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from Customers.', 0, 1, @n) WITH NOWAIT;

    /* ---- Inventory (no inbound FKs) ------------------------------- */
    DELETE FROM dbo.InventoryItems;
    SET @n = @@ROWCOUNT; RAISERROR(N'Deleted %d rows from InventoryItems.', 0, 1, @n) WITH NOWAIT;

    COMMIT TRAN;
    RAISERROR(N'== Cleanup committed successfully. ==', 0, 1) WITH NOWAIT;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRAN;
    RAISERROR(N'== Cleanup FAILED and was rolled back. See error below. ==', 16, 1) WITH NOWAIT;
    THROW;
END CATCH;

/* ---- Re-ensure the reserved Internal/Office work context ----------
   Called AFTER commit because the procedure manages its own
   transaction. It is idempotent (get-or-create).                      */
BEGIN TRY
    EXEC dbo.sp_WorkItems_GetInternalContext;
    RAISERROR(N'Internal/office work context ensured (reserved customer + site + container project).', 0, 1) WITH NOWAIT;
END TRY
BEGIN CATCH
    RAISERROR(N'WARNING: could not ensure internal/office work context (sp_WorkItems_GetInternalContext failed).', 16, 1) WITH NOWAIT;
    THROW;
END CATCH;

/* ---- Post-cleanup snapshot ---------------------------------------- */
SELECT
    (SELECT COUNT(*) FROM dbo.Customers)                 AS Customers_remaining,
    (SELECT COUNT(*) FROM dbo.Employees)                 AS Employees_remaining,
    (SELECT COUNT(*) FROM dbo.WorkItems)                 AS WorkItems_remaining,
    (SELECT COUNT(*) FROM dbo.Users)                     AS Users_preserved,
    (SELECT COUNT(*) FROM dbo.Rec_Skills)                AS Skills_preserved,
    (SELECT COUNT(*) FROM dbo.Rec_WorkZones)             AS WorkZones_preserved;

RAISERROR(N'== 01_cleanup_operational_data: done. ==', 0, 1) WITH NOWAIT;

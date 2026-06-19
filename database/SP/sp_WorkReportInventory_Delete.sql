SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_WorkReportInventory_Delete @WorkReportId INT,@WorkReportInventoryItemId INT
AS BEGIN SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
 DECLARE @Life NVARCHAR(20); SELECT @Life=LifecycleStatus FROM dbo.WorkReports WITH(UPDLOCK,HOLDLOCK) WHERE WorkReportId=@WorkReportId;
 IF @Life<>N'Draft' OR @Life IS NULL THROW 51310,'Inventory lines are editable only on Draft reports.',1;
 DELETE dbo.WorkReportInventoryItems WHERE WorkReportInventoryItemId=@WorkReportInventoryItemId AND WorkReportId=@WorkReportId;
 DECLARE @Rows INT=@@ROWCOUNT; COMMIT; SELECT @Rows RowsAffected;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
END
GO

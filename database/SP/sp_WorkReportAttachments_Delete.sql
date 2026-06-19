SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_WorkReportAttachments_Delete @WorkReportId INT,@WorkReportAttachmentId INT
AS BEGIN SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
 DECLARE @Life NVARCHAR(20); SELECT @Life=LifecycleStatus FROM dbo.WorkReports WITH(UPDLOCK,HOLDLOCK) WHERE WorkReportId=@WorkReportId;
 IF @Life<>N'Draft' OR @Life IS NULL THROW 51321,'Attachments are editable only on Draft reports.',1;
 DELETE dbo.WorkReportAttachments
 OUTPUT DELETED.WorkReportAttachmentId,DELETED.StoredFileName,DELETED.FilePath,DELETED.ContentType,DELETED.FileSizeBytes
 WHERE WorkReportAttachmentId=@WorkReportAttachmentId AND WorkReportId=@WorkReportId;
 COMMIT;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
END
GO

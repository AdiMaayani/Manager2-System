SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_WorkReportAttachments_Add
 @WorkReportId INT,@MediaType NVARCHAR(20),@OriginalFileName NVARCHAR(255),@StoredFileName NVARCHAR(255),
 @FilePath NVARCHAR(500),@ContentType NVARCHAR(100),@FileSizeBytes BIGINT,@UploadedByUserId INT=NULL
AS BEGIN SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION;
 DECLARE @Life NVARCHAR(20); SELECT @Life=LifecycleStatus FROM dbo.WorkReports WITH(UPDLOCK,HOLDLOCK) WHERE WorkReportId=@WorkReportId;
 IF @Life<>N'Draft' OR @Life IS NULL THROW 51320,'Attachments are editable only on Draft reports.',1;
 INSERT dbo.WorkReportAttachments(WorkReportId,MediaType,OriginalFileName,StoredFileName,FilePath,ContentType,FileSizeBytes,UploadedByUserId)
 VALUES(@WorkReportId,@MediaType,@OriginalFileName,@StoredFileName,@FilePath,@ContentType,@FileSizeBytes,@UploadedByUserId);
 DECLARE @Id INT=CAST(SCOPE_IDENTITY() AS INT); COMMIT; SELECT @Id WorkReportAttachmentId;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
END
GO

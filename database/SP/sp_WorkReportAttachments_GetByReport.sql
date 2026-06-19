SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE dbo.sp_WorkReportAttachments_GetByReport @WorkReportId INT AS
BEGIN SET NOCOUNT ON;
 SELECT WorkReportAttachmentId,WorkReportId,MediaType,OriginalFileName,StoredFileName,FilePath,ContentType,FileSizeBytes,UploadedAt,UploadedByUserId
 FROM dbo.WorkReportAttachments WHERE WorkReportId=@WorkReportId ORDER BY UploadedAt,WorkReportAttachmentId;
END
GO

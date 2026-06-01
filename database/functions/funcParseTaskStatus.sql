SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER FUNCTION [dbo].[funcParseTaskStatus](@status INT)
RETURNS NVARCHAR(20)
AS
BEGIN
	DECLARE @ReturnedString NVARCHAR(20)
	IF @status = 0
		BEGIN
			SET @ReturnedString = 'טרם הושלמה'
		END
	IF @status = 1
		BEGIN
			SET @ReturnedString = 'הושלמה'
		END
	IF @status = 2
		BEGIN
			SET @ReturnedString = 'בוטלה'
		END
	RETURN @ReturnedString
END
GO

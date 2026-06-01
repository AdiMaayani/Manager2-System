SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER FUNCTION [dbo].[funcCalculateStatus](@userStatus INT)
RETURNS NVARCHAR(30)
AS
BEGIN
	DECLARE @ReturnedString NVARCHAR(30)
	IF @userStatus = 0
		BEGIN
			SET @ReturnedString = 'לא פעיל'
		END
	IF @userStatus = 1
		BEGIN
			SET @ReturnedString = 'פעיל'
		END
	RETURN @ReturnedString
END
GO

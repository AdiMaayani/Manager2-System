SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER FUNCTION [dbo].[funcCalculate](@userType INT)
RETURNS NVARCHAR(30)
AS
BEGIN
	DECLARE @ReturnedString NVARCHAR(30)
	IF @userType = 1
		BEGIN
			SET @ReturnedString = 'מתנדב חדש'
		END
	IF @userType = 2
		BEGIN
			SET @ReturnedString = 'מתנדב מוסמך'
		END
	IF @userType = 3
		BEGIN
			SET @ReturnedString = 'עובד עמותה'
		END
	IF @userType = 4
		BEGIN
			SET @ReturnedString = 'מנהל מערכת'
		END
	RETURN @ReturnedString
END
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER FUNCTION [dbo].[funcCalculateGender](@gender INT)
RETURNS NVARCHAR(30)
AS
BEGIN
	DECLARE @ReturnedString NVARCHAR(30)
	IF @gender = 0
		BEGIN
			SET @ReturnedString = 'זכר'
		END
	IF @gender = 1
		BEGIN
			SET @ReturnedString = 'נקבה'
		END
	RETURN @ReturnedString
END
GO

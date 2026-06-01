SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER FUNCTION [dbo].[funcAddLeadingZero](@number NVARCHAR(5))
RETURNS NVARCHAR(30)
AS
BEGIN
	DECLARE @ReturnedString NVARCHAR(5)
	IF CONVERT(INT,@number) >= 0 AND CONVERT(INT,@number) <= 9
		BEGIN
			SET @ReturnedString = '0' + @number
		END
	ELSE
		BEGIN
			SET @ReturnedString = @number
		END
	RETURN @ReturnedString
END
GO

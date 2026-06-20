SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER FUNCTION [dbo].[funcParseTaskPriority](@prior NVARCHAR(10))
RETURNS NVARCHAR(10)
AS
BEGIN
	DECLARE @ReturnedString NVARCHAR(10)
	IF @prior = 'low'
		BEGIN
			SET @ReturnedString = 'נמוכה'
		END
	IF @prior = 'medium'
		BEGIN
			SET @ReturnedString = 'בינונית'
		END
	IF @prior = 'high'
		BEGIN
			SET @ReturnedString = 'גבוהה'
		END
	RETURN @ReturnedString
END
GO

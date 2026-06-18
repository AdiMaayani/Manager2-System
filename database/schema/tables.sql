/* =====================================================================
   ManageR2 - Table DDL Snapshot
   Source: igroup30_prod.sql (live DB dump, Script Date 31/05/2026)
   Contents: 35 tables, indexes, primary keys, defaults,
             check constraints and foreign keys.
   Run within your target database context (USE [<db>]; GO).
   ===================================================================== */

/****** Object:  Table [dbo].[CompanySettings]    Script Date: 02/06/2026 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CompanySettings](
	[CompanySettingsId] [tinyint] NOT NULL,
	[CompanyName] [nvarchar](200) NOT NULL,
	[LegalName] [nvarchar](200) NULL,
	[RegistrationNumber] [nvarchar](50) NULL,
	[Email] [nvarchar](254) NULL,
	[Phone] [nvarchar](50) NULL,
	[Address] [nvarchar](500) NULL,
	[Website] [nvarchar](250) NULL,
	[UpdatedAt] [datetime2](0) NOT NULL,
	[UpdatedByUserId] [int] NULL,
 CONSTRAINT [PK_CompanySettings] PRIMARY KEY CLUSTERED
(
	[CompanySettingsId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Contacts]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Contacts](
	[ContactId] [int] IDENTITY(1,1) NOT NULL,
	[FullName] [nvarchar](200) NOT NULL,
	[JobTitle] [nvarchar](150) NULL,
	[ContactCategory] [nvarchar](50) NOT NULL,
	[CustomerId] [int] NULL,
	[CompanyName] [nvarchar](200) NULL,
	[Phone] [nvarchar](50) NULL,
	[SecondaryPhone] [nvarchar](50) NULL,
	[Email] [nvarchar](255) NULL,
	[PreferredChannel] [nvarchar](50) NULL,
	[City] [nvarchar](100) NULL,
	[Address] [nvarchar](255) NULL,
	[Status] [nvarchar](50) NULL,
	[Notes] [nvarchar](1000) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[CreatedByUserId] [int] NOT NULL,
	[UpdatedAt] [datetime2](0) NULL,
	[UpdatedByUserId] [int] NULL,
 CONSTRAINT [PK_Contacts] PRIMARY KEY CLUSTERED 
(
	[ContactId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Contractors]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Contractors](
	[ContractorId] [int] IDENTITY(1,1) NOT NULL,
	[FullName] [nvarchar](100) NOT NULL,
	[CompanyName] [nvarchar](100) NULL,
	[Phone] [nvarchar](20) NULL,
	[Email] [nvarchar](100) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ContractorId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Customers]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Customers](
	[CustomerId] [int] IDENTITY(1,1) NOT NULL,
	[CustomerName] [nvarchar](200) NOT NULL,
	[CustomerType] [nvarchar](50) NOT NULL,
	[Phone] [nvarchar](20) NULL,
	[Email] [nvarchar](100) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[PrimaryPhone] [nvarchar](50) NULL,
	[PrimaryEmail] [nvarchar](255) NULL,
	[City] [nvarchar](100) NULL,
	[Region] [nvarchar](100) NULL,
	[Address] [nvarchar](255) NULL,
	[Status] [nvarchar](50) NULL,
	[Notes] [nvarchar](1000) NULL,
	[CreatedByUserId] [int] NOT NULL,
	[UpdatedAt] [datetime2](0) NULL,
	[UpdatedByUserId] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[CustomerId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Departments]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Departments](
	[DepartmentId] [int] IDENTITY(1,1) NOT NULL,
	[DepartmentName] [nvarchar](100) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[DepartmentId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[DepartmentName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Employees]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Employees](
	[EmployeeId] [int] IDENTITY(1,1) NOT NULL,
	[FullName] [nvarchar](100) NOT NULL,
	[PrimaryRole] [nvarchar](100) NOT NULL,
	[Phone] [nvarchar](20) NULL,
	[Email] [nvarchar](100) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[DailyCapacityHours] [decimal](4, 2) NULL,
	[IsAssignable] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[EmployeeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InventoryItems]    Script Date: 04/06/2026 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InventoryItems](
	[InventoryItemId] [int] IDENTITY(1,1) NOT NULL,
	[SkuCode] [nvarchar](50) NOT NULL,
	[ItemName] [nvarchar](200) NOT NULL,
	[Category] [nvarchar](100) NULL,
	[QuantityOnHand] [decimal](18, 3) NOT NULL CONSTRAINT [DF_InventoryItems_QuantityOnHand] DEFAULT ((0)),
	[Unit] [nvarchar](20) NOT NULL,
	[MinimumQuantity] [decimal](18, 3) NULL,
	[LocationName] [nvarchar](200) NULL,
	[Notes] [nvarchar](500) NULL,
	[IsActive] [bit] NOT NULL CONSTRAINT [DF_InventoryItems_IsActive] DEFAULT ((1)),
	[CreatedAt] [datetime2](7) NOT NULL CONSTRAINT [DF_InventoryItems_CreatedAt] DEFAULT (sysutcdatetime()),
	[UpdatedAt] [datetime2](7) NULL,
	[DeletedAt] [datetime2](7) NULL,
	[ImagePath] [nvarchar](260) NULL,
	[ImageContentType] [nvarchar](100) NULL,
	[ImageFileSizeBytes] [bigint] NULL,
 CONSTRAINT [PK_InventoryItems] PRIMARY KEY CLUSTERED
(
	[InventoryItemId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [CK_InventoryItems_SkuCode_NotBlank] CHECK ((len(ltrim(rtrim([SkuCode])))>(0))),
 CONSTRAINT [CK_InventoryItems_ItemName_NotBlank] CHECK ((len(ltrim(rtrim([ItemName])))>(0))),
 CONSTRAINT [CK_InventoryItems_QuantityOnHand_NonNegative] CHECK (([QuantityOnHand]>=(0))),
 CONSTRAINT [CK_InventoryItems_Unit_NotBlank] CHECK ((len(ltrim(rtrim([Unit])))>(0))),
 CONSTRAINT [CK_InventoryItems_MinimumQuantity_NonNegative] CHECK (([MinimumQuantity] IS NULL OR [MinimumQuantity]>=(0))),
 CONSTRAINT [CK_InventoryItems_ImageFileSizeBytes_NonNegative] CHECK (([ImageFileSizeBytes] IS NULL OR [ImageFileSizeBytes]>=(0)))
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ProjectEquipmentItems]    Script Date: 02/06/2026 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ProjectEquipmentItems](
	[ProjectEquipmentItemId] [int] IDENTITY(1,1) NOT NULL,
	[ProjectId] [int] NOT NULL,
	[EquipmentName] [nvarchar](200) NOT NULL,
	[Status] [nvarchar](50) NOT NULL,
	[Location] [nvarchar](200) NULL,
	[SortOrder] [int] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NULL,
 CONSTRAINT [PK_ProjectEquipmentItems] PRIMARY KEY CLUSTERED
(
	[ProjectEquipmentItemId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ProjectBoqItems]    Script Date: 04/06/2026 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ProjectBoqItems](
	[ProjectBoqItemId] [int] IDENTITY(1,1) NOT NULL,
	[ProjectId] [int] NOT NULL,
	[SystemName] [nvarchar](200) NULL,
	[ItemDescription] [nvarchar](500) NOT NULL,
	[Quantity] [decimal](18, 2) NOT NULL,
	[Unit] [nvarchar](50) NOT NULL,
	[SortOrder] [int] NOT NULL,
	[IsActive] [bit] NOT NULL CONSTRAINT [DF_ProjectBoqItems_IsActive] DEFAULT ((1)),
	[CreatedAt] [datetime2](7) NOT NULL CONSTRAINT [DF_ProjectBoqItems_CreatedAt] DEFAULT (sysutcdatetime()),
	[UpdatedAt] [datetime2](7) NULL,
	[DeletedAt] [datetime2](7) NULL,
 CONSTRAINT [PK_ProjectBoqItems] PRIMARY KEY CLUSTERED
(
	[ProjectBoqItemId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [CK_ProjectBoqItems_ItemDescription_NotBlank] CHECK ((len(ltrim(rtrim([ItemDescription])))>(0))),
 CONSTRAINT [CK_ProjectBoqItems_Quantity_Positive] CHECK (([Quantity]>(0))),
 CONSTRAINT [CK_ProjectBoqItems_Unit_NotBlank] CHECK ((len(ltrim(rtrim([Unit])))>(0)))
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ProjectDrawings]    Script Date: 04/06/2026 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ProjectDrawings](
	[ProjectDrawingId] [int] IDENTITY(1,1) NOT NULL,
	[ProjectId] [int] NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Type] [nvarchar](20) NOT NULL,
	[DrawingDate] [date] NOT NULL,
	[Note] [nvarchar](500) NULL,
	[SortOrder] [int] NOT NULL,
	[IsActive] [bit] NOT NULL CONSTRAINT [DF_ProjectDrawings_IsActive] DEFAULT ((1)),
	[CreatedAt] [datetime2](7) NOT NULL CONSTRAINT [DF_ProjectDrawings_CreatedAt] DEFAULT (sysutcdatetime()),
	[UpdatedAt] [datetime2](7) NULL,
	[DeletedAt] [datetime2](7) NULL,
 CONSTRAINT [PK_ProjectDrawings] PRIMARY KEY CLUSTERED
(
	[ProjectDrawingId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [CK_ProjectDrawings_Name_NotBlank] CHECK ((len(ltrim(rtrim([Name])))>(0))),
 CONSTRAINT [CK_ProjectDrawings_Type] CHECK (([Type]=N'DWG' OR [Type]=N'PDF'))
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Rec_EmployeeAvailability]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Rec_EmployeeAvailability](
	[EmployeeAvailabilityId] [int] IDENTITY(1,1) NOT NULL,
	[EmployeeId] [int] NOT NULL,
	[AvailableFrom] [datetime2](0) NOT NULL,
	[AvailableTo] [datetime2](0) NOT NULL,
	[AvailabilityType] [nvarchar](20) NOT NULL,
	[Source] [nvarchar](50) NULL,
	[Notes] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
 CONSTRAINT [PK_Rec_EmployeeAvailability] PRIMARY KEY CLUSTERED 
(
	[EmployeeAvailabilityId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Rec_EmployeeBaseAddress]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Rec_EmployeeBaseAddress](
	[EmployeeBaseAddressId] [int] IDENTITY(1,1) NOT NULL,
	[EmployeeId] [int] NOT NULL,
	[InputAddress] [nvarchar](300) NOT NULL,
	[FormattedAddress] [nvarchar](300) NULL,
	[ValidationProvider] [nvarchar](50) NULL,
	[ValidationStatus] [nvarchar](30) NULL,
	[ValidationVerdict] [nvarchar](50) NULL,
	[ValidationScore] [decimal](5, 2) NULL,
	[ExternalPlaceRef] [nvarchar](200) NULL,
	[Street] [nvarchar](200) NULL,
	[HouseNumber] [nvarchar](50) NULL,
	[City] [nvarchar](100) NULL,
	[Postcode] [nvarchar](30) NULL,
	[StateOrRegion] [nvarchar](100) NULL,
	[Country] [nvarchar](100) NULL,
	[ZoneId] [int] NULL,
	[ValidatedAt] [datetime2](0) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NULL,
 CONSTRAINT [PK_Rec_EmployeeBaseAddress] PRIMARY KEY CLUSTERED 
(
	[EmployeeBaseAddressId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_Rec_EmployeeBaseAddress_EmployeeId] UNIQUE NONCLUSTERED 
(
	[EmployeeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Rec_EmployeeCapacity]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Rec_EmployeeCapacity](
	[EmployeeCapacityId] [int] IDENTITY(1,1) NOT NULL,
	[EmployeeId] [int] NOT NULL,
	[WeeklyCapacityHours] [decimal](10, 2) NOT NULL,
	[EffectiveFrom] [date] NOT NULL,
	[EffectiveTo] [date] NULL,
	[Notes] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
 CONSTRAINT [PK_Rec_EmployeeCapacity] PRIMARY KEY CLUSTERED 
(
	[EmployeeCapacityId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Rec_EmployeeLocationEvents]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Rec_EmployeeLocationEvents](
	[EmployeeLocationEventId] [int] IDENTITY(1,1) NOT NULL,
	[EmployeeId] [int] NOT NULL,
	[WorkItemId] [int] NULL,
	[SiteId] [int] NULL,
	[EventType] [nvarchar](30) NOT NULL,
	[InputAddress] [nvarchar](300) NULL,
	[FormattedAddress] [nvarchar](300) NULL,
	[ExternalPlaceRef] [nvarchar](200) NULL,
	[ZoneId] [int] NULL,
	[EventDate] [date] NOT NULL,
	[EventTime] [datetime2](0) NOT NULL,
	[Source] [nvarchar](50) NULL,
	[Notes] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
 CONSTRAINT [PK_Rec_EmployeeLocationEvents] PRIMARY KEY CLUSTERED 
(
	[EmployeeLocationEventId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Rec_EmployeePlannedStops]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Rec_EmployeePlannedStops](
	[PlannedStopId] [int] IDENTITY(1,1) NOT NULL,
	[EmployeeId] [int] NOT NULL,
	[WorkItemId] [int] NOT NULL,
	[SiteId] [int] NULL,
	[PlannedDate] [date] NOT NULL,
	[PlannedStartAt] [datetime2](0) NULL,
	[PlannedEndAt] [datetime2](0) NULL,
	[InputAddress] [nvarchar](300) NULL,
	[FormattedAddress] [nvarchar](300) NULL,
	[ExternalPlaceRef] [nvarchar](200) NULL,
	[ZoneId] [int] NULL,
	[StopStatus] [nvarchar](30) NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NULL,
 CONSTRAINT [PK_Rec_EmployeePlannedStops] PRIMARY KEY CLUSTERED 
(
	[PlannedStopId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Rec_EmployeeSkills]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Rec_EmployeeSkills](
	[EmployeeSkillId] [int] IDENTITY(1,1) NOT NULL,
	[EmployeeId] [int] NOT NULL,
	[SkillId] [int] NOT NULL,
	[SkillLevel] [int] NOT NULL,
	[YearsExperience] [decimal](5, 2) NULL,
	[IsCertified] [bit] NOT NULL,
	[LastUsedAt] [datetime2](0) NULL,
	[Notes] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
 CONSTRAINT [PK_Rec_EmployeeSkills] PRIMARY KEY CLUSTERED 
(
	[EmployeeSkillId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_Rec_EmployeeSkills_EmployeeId_SkillId] UNIQUE NONCLUSTERED 
(
	[EmployeeId] ASC,
	[SkillId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Rec_EmployeeWorkZones]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Rec_EmployeeWorkZones](
	[EmployeeWorkZoneId] [int] IDENTITY(1,1) NOT NULL,
	[EmployeeId] [int] NOT NULL,
	[ZoneId] [int] NOT NULL,
	[IsPrimary] [bit] NOT NULL,
	[Notes] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
 CONSTRAINT [PK_Rec_EmployeeWorkZones] PRIMARY KEY CLUSTERED 
(
	[EmployeeWorkZoneId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_Rec_EmployeeWorkZones_EmployeeId_ZoneId] UNIQUE NONCLUSTERED 
(
	[EmployeeId] ASC,
	[ZoneId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Rec_RecommendationRuns]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Rec_RecommendationRuns](
	[RecommendationRunId] [int] IDENTITY(1,1) NOT NULL,
	[ScopeType] [nvarchar](30) NOT NULL,
	[ProjectId] [int] NULL,
	[TaskId] [int] NULL,
	[RequestedByUserId] [int] NULL,
	[AlgorithmVersion] [nvarchar](50) NOT NULL,
	[RunStatus] [nvarchar](30) NOT NULL,
	[InputSnapshotJson] [nvarchar](max) NULL,
	[SummaryJson] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
 CONSTRAINT [PK_Rec_RecommendationRuns] PRIMARY KEY CLUSTERED 
(
	[RecommendationRunId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Rec_RouteEstimates]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Rec_RouteEstimates](
	[RouteEstimateId] [int] IDENTITY(1,1) NOT NULL,
	[EmployeeId] [int] NOT NULL,
	[TargetSiteId] [int] NOT NULL,
	[OriginType] [nvarchar](30) NOT NULL,
	[OriginReferenceId] [int] NULL,
	[OriginAddress] [nvarchar](300) NULL,
	[TargetAddress] [nvarchar](300) NULL,
	[RoutingProvider] [nvarchar](50) NULL,
	[RoutingStatus] [nvarchar](30) NULL,
	[RoutingMode] [nvarchar](20) NOT NULL,
	[EstimatedDistanceKm] [decimal](10, 2) NULL,
	[EstimatedTravelMinutes] [int] NULL,
	[CalculatedAt] [datetime2](0) NOT NULL,
	[IsCurrent] [bit] NOT NULL,
 CONSTRAINT [PK_Rec_RouteEstimates] PRIMARY KEY CLUSTERED 
(
	[RouteEstimateId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Rec_SiteAddressProfile]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Rec_SiteAddressProfile](
	[SiteAddressProfileId] [int] IDENTITY(1,1) NOT NULL,
	[SiteId] [int] NOT NULL,
	[InputAddress] [nvarchar](300) NULL,
	[FormattedAddress] [nvarchar](300) NULL,
	[ValidationProvider] [nvarchar](50) NULL,
	[ValidationStatus] [nvarchar](30) NULL,
	[ValidationVerdict] [nvarchar](50) NULL,
	[ValidationScore] [decimal](5, 2) NULL,
	[ExternalPlaceRef] [nvarchar](200) NULL,
	[Street] [nvarchar](200) NULL,
	[HouseNumber] [nvarchar](50) NULL,
	[City] [nvarchar](100) NULL,
	[Postcode] [nvarchar](30) NULL,
	[StateOrRegion] [nvarchar](100) NULL,
	[Country] [nvarchar](100) NULL,
	[ZoneId] [int] NULL,
	[ValidatedAt] [datetime2](0) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NULL,
 CONSTRAINT [PK_Rec_SiteAddressProfile] PRIMARY KEY CLUSTERED 
(
	[SiteAddressProfileId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_Rec_SiteAddressProfile_SiteId] UNIQUE NONCLUSTERED 
(
	[SiteId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Rec_Skills]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Rec_Skills](
	[SkillId] [int] IDENTITY(1,1) NOT NULL,
	[SkillName] [nvarchar](100) NOT NULL,
	[SkillCategory] [nvarchar](100) NULL,
	[Description] [nvarchar](255) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
 CONSTRAINT [PK_Rec_Skills] PRIMARY KEY CLUSTERED 
(
	[SkillId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_Rec_Skills_SkillName] UNIQUE NONCLUSTERED 
(
	[SkillName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Rec_TaskAssignmentRecommendations]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Rec_TaskAssignmentRecommendations](
	[RecommendationId] [int] IDENTITY(1,1) NOT NULL,
	[RecommendationRunId] [int] NOT NULL,
	[TaskId] [int] NOT NULL,
	[EmployeeId] [int] NOT NULL,
	[UrgencyClass] [nvarchar](20) NULL,
	[OriginTypeUsed] [nvarchar](30) NULL,
	[RankOrder] [int] NOT NULL,
	[TotalScore] [decimal](10, 2) NOT NULL,
	[ProfessionalScore] [decimal](10, 2) NULL,
	[AvailabilityScore] [decimal](10, 2) NULL,
	[WorkloadScore] [decimal](10, 2) NULL,
	[ExperienceScore] [decimal](10, 2) NULL,
	[GeographicScore] [decimal](10, 2) NULL,
	[ContinuityScore] [decimal](10, 2) NULL,
	[DistanceKm] [decimal](10, 2) NULL,
	[TravelMinutes] [int] NULL,
	[MatchedSkillsCount] [int] NULL,
	[MissingSkillsCount] [int] NULL,
	[OpenAssignmentsCount] [int] NULL,
	[CurrentWorkloadHours] [decimal](10, 2) NULL,
	[ZoneMatch] [bit] NULL,
	[WorkedWithCustomerBefore] [bit] NULL,
	[WorkedAtSiteBefore] [bit] NULL,
	[RecommendationSummary] [nvarchar](1000) NULL,
	[WarningsJson] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
 CONSTRAINT [PK_Rec_TaskAssignmentRecommendations] PRIMARY KEY CLUSTERED 
(
	[RecommendationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_Rec_TaskAssignmentRecommendations_Run_Task_Employee] UNIQUE NONCLUSTERED 
(
	[RecommendationRunId] ASC,
	[TaskId] ASC,
	[EmployeeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Rec_WorkItemAlgorithmProfile]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Rec_WorkItemAlgorithmProfile](
	[WorkItemAlgorithmProfileId] [int] IDENTITY(1,1) NOT NULL,
	[WorkItemId] [int] NOT NULL,
	[ProjectType] [nvarchar](100) NULL,
	[RequiredWorkersCount] [int] NOT NULL,
	[AlgorithmPriorityOverride] [nvarchar](20) NULL,
	[UrgencyOverride] [nvarchar](20) NULL,
	[PlanningNotes] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
	[UpdatedAt] [datetime2](0) NULL,
 CONSTRAINT [PK_Rec_WorkItemAlgorithmProfile] PRIMARY KEY CLUSTERED 
(
	[WorkItemAlgorithmProfileId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_Rec_WorkItemAlgorithmProfile_WorkItemId] UNIQUE NONCLUSTERED 
(
	[WorkItemId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Rec_WorkItemRequiredSkills]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Rec_WorkItemRequiredSkills](
	[WorkItemRequiredSkillId] [int] IDENTITY(1,1) NOT NULL,
	[WorkItemId] [int] NOT NULL,
	[SkillId] [int] NOT NULL,
	[RequiredLevel] [int] NULL,
	[ImportanceLevel] [nvarchar](20) NOT NULL,
	[Notes] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
 CONSTRAINT [PK_Rec_WorkItemRequiredSkills] PRIMARY KEY CLUSTERED 
(
	[WorkItemRequiredSkillId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_Rec_WorkItemRequiredSkills_WorkItemId_SkillId] UNIQUE NONCLUSTERED 
(
	[WorkItemId] ASC,
	[SkillId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Rec_WorkZones]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Rec_WorkZones](
	[ZoneId] [int] IDENTITY(1,1) NOT NULL,
	[ZoneName] [nvarchar](100) NOT NULL,
	[Description] [nvarchar](255) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](0) NOT NULL,
 CONSTRAINT [PK_Rec_WorkZones] PRIMARY KEY CLUSTERED 
(
	[ZoneId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_Rec_WorkZones_ZoneName] UNIQUE NONCLUSTERED 
(
	[ZoneName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Roles]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Roles](
	[RoleId] [int] IDENTITY(1,1) NOT NULL,
	[RoleName] [nvarchar](50) NOT NULL,
	[RoleCode] [nvarchar](50) NOT NULL,
	[Description] [nvarchar](255) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[RoleId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[RoleCode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Sites]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Sites](
	[SiteId] [int] IDENTITY(1,1) NOT NULL,
	[CustomerId] [int] NOT NULL,
	[SiteName] [nvarchar](100) NOT NULL,
	[AddressLine] [nvarchar](200) NULL,
	[City] [nvarchar](50) NULL,
	[IsPrimary] [bit] NOT NULL,
	[Notes] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[IsActive] [bit] NOT NULL CONSTRAINT [DF_Sites_IsActive] DEFAULT ((1)),
	[UpdatedAt] [datetime2](7) NULL,
	[DeletedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[SiteId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserDepartments]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserDepartments](
	[UserDepartmentId] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[DepartmentId] [int] NOT NULL,
	[AssignedAt] [datetime2](7) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[RemovedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[UserDepartmentId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_UserDepartments_UserId_DepartmentId] UNIQUE NONCLUSTERED 
(
	[UserId] ASC,
	[DepartmentId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UserRoles]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UserRoles](
	[UserRoleId] [int] IDENTITY(1,1) NOT NULL,
	[UserId] [int] NOT NULL,
	[RoleId] [int] NOT NULL,
	[AssignedAt] [datetime2](7) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[RemovedAt] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[UserRoleId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_UserRoles_UserId_RoleId] UNIQUE NONCLUSTERED 
(
	[UserId] ASC,
	[RoleId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Users]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Users](
	[UserId] [int] IDENTITY(1,1) NOT NULL,
	[EmployeeId] [int] NOT NULL,
	[Username] [nvarchar](50) NOT NULL,
	[Email] [nvarchar](100) NOT NULL,
	[PasswordHash] [nvarchar](255) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[LastLoginAt] [datetime2](7) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[PasswordSalt] [nvarchar](500) NOT NULL,
	[Phone] [nvarchar](50) NULL,
	[Notes] [nvarchar](500) NULL,
PRIMARY KEY CLUSTERED 
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[Username] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [UQ_Users_Email] UNIQUE NONCLUSTERED 
(
	[Email] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WorkContractorAssignments]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkContractorAssignments](
	[WorkContractorAssignmentId] [int] IDENTITY(1,1) NOT NULL,
	[WorkItemId] [int] NOT NULL,
	[ContractorId] [int] NOT NULL,
	[AssignmentRole] [nvarchar](100) NOT NULL,
	[AssignedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[WorkContractorAssignmentId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WorkEmployeeAssignments]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkEmployeeAssignments](
	[WorkEmployeeAssignmentId] [int] IDENTITY(1,1) NOT NULL,
	[WorkItemId] [int] NOT NULL,
	[EmployeeId] [int] NOT NULL,
	[AssignmentRole] [nvarchar](100) NOT NULL,
	[AssignedAt] [datetime2](7) NOT NULL,
	[AssignedHours] [decimal](5, 2) NULL,
	[IsManualAssignment] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[WorkEmployeeAssignmentId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WorkItems]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkItems](
	[WorkItemId] [int] IDENTITY(1,1) NOT NULL,
	[Title] [nvarchar](150) NOT NULL,
	[WorkType] [nvarchar](50) NOT NULL,
	[Status] [nvarchar](50) NOT NULL,
	[BillingType] [nvarchar](50) NULL,
	[Description] [nvarchar](1000) NULL,
	[CustomerId] [int] NOT NULL,
	[SiteId] [int] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[ClosedAt] [datetime2](7) NULL,
	[ParentWorkItemId] [int] NULL,
	[DealCloseDate] [datetime2](7) NULL,
	[FinanceProjectNumber] [nvarchar](100) NULL,
	[InvoiceNumber] [nvarchar](100) NULL,
	[EstimatedHours] [decimal](5, 2) NULL,
	[Priority] [nvarchar](20) NULL,
	[PlannedStart] [datetime2](7) NULL,
	[PlannedEnd] [datetime2](7) NULL,
	[RequiredRole] [nvarchar](100) NULL,
	[IsLocked] [bit] NOT NULL,
	[ActualStart] [datetime] NULL,
	[ActualEnd] [datetime] NULL,
	[ActualHours] [decimal](10, 2) NULL,
PRIMARY KEY CLUSTERED 
(
	[WorkItemId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WorkReportEmployeeAssignments]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkReportEmployeeAssignments](
	[WorkReportEmployeeAssignmentId] [int] IDENTITY(1,1) NOT NULL,
	[WorkReportId] [int] NULL,
	[EmployeeId] [int] NULL,
	[EmployeeName] [nvarchar](100) NULL,
	[AssignmentRole] [nvarchar](100) NULL,
	[AssignedAt] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[WorkReportEmployeeAssignmentId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WorkReports]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkReports](
	[WorkReportId] [int] IDENTITY(1,1) NOT NULL,
	[WorkItemId] [int] NULL,
	[ReportType] [nvarchar](50) NULL,
	[ReportDate] [datetime] NULL,
	[ProjectName] [nvarchar](150) NULL,
	[CustomerName] [nvarchar](150) NULL,
	[Site] [nvarchar](200) NULL,
	[StartTime] [nvarchar](10) NULL,
	[EndTime] [nvarchar](10) NULL,
	[Summary] [nvarchar](1000) NULL,
	[Notes] [nvarchar](2000) NULL,
	[ReporterEmployeeId] [int] NULL,
	[ReporterName] [nvarchar](100) NULL,
	[ReporterRole] [nvarchar](100) NULL,
	[WorkersCount] [int] NULL,
	[FollowUpRequired] [bit] NULL,
	[FollowUpReason] [nvarchar](1000) NULL,
	[CreatedAt] [datetime] NULL,
	[Status] [nvarchar](50) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[WorkReportId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WorkReportSystems]    Script Date: 31/05/2026 16:54:53 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkReportSystems](
	[WorkReportSystemId] [int] IDENTITY(1,1) NOT NULL,
	[WorkReportId] [int] NULL,
	[SystemName] [nvarchar](100) NULL,
	[CreatedAt] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[WorkReportSystemId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Contacts_Category_IsActive]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_Contacts_Category_IsActive] ON [dbo].[Contacts]
(
	[ContactCategory] ASC,
	[IsActive] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_Contacts_CustomerId]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_Contacts_CustomerId] ON [dbo].[Contacts]
(
	[CustomerId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Contacts_FullName]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_Contacts_FullName] ON [dbo].[Contacts]
(
	[FullName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Customers_CustomerName]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_Customers_CustomerName] ON [dbo].[Customers]
(
	[CustomerName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Customers_CustomerType_IsActive]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_Customers_CustomerType_IsActive] ON [dbo].[Customers]
(
	[CustomerType] ASC,
	[IsActive] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_InventoryItems_SkuCode_Active]    Script Date: 04/06/2026 ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_InventoryItems_SkuCode_Active] ON [dbo].[InventoryItems]
(
	[SkuCode] ASC
)
WHERE ([IsActive]=(1))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_InventoryItems_IsActive_ItemName]    Script Date: 04/06/2026 ******/
CREATE NONCLUSTERED INDEX [IX_InventoryItems_IsActive_ItemName] ON [dbo].[InventoryItems]
(
	[IsActive] ASC,
	[ItemName] ASC,
	[InventoryItemId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_InventoryItems_Category_IsActive]    Script Date: 04/06/2026 ******/
CREATE NONCLUSTERED INDEX [IX_InventoryItems_Category_IsActive] ON [dbo].[InventoryItems]
(
	[Category] ASC,
	[IsActive] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_ProjectEquipmentItems_ProjectId_SortOrder]    Script Date: 02/06/2026 ******/
CREATE NONCLUSTERED INDEX [IX_ProjectEquipmentItems_ProjectId_SortOrder] ON [dbo].[ProjectEquipmentItems]
(
	[ProjectId] ASC,
	[SortOrder] ASC,
	[ProjectEquipmentItemId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_ProjectBoqItems_ProjectId_SortOrder]    Script Date: 04/06/2026 ******/
CREATE NONCLUSTERED INDEX [IX_ProjectBoqItems_ProjectId_SortOrder] ON [dbo].[ProjectBoqItems]
(
	[ProjectId] ASC,
	[SortOrder] ASC,
	[ProjectBoqItemId] ASC
)
WHERE ([IsActive]=(1))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_ProjectDrawings_ProjectId_SortOrder]    Script Date: 04/06/2026 ******/
CREATE NONCLUSTERED INDEX [IX_ProjectDrawings_ProjectId_SortOrder] ON [dbo].[ProjectDrawings]
(
	[ProjectId] ASC,
	[SortOrder] ASC,
	[ProjectDrawingId] ASC
)
WHERE ([IsActive]=(1))
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_Rec_EmployeeAvailability_EmployeeId_TimeRange]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_Rec_EmployeeAvailability_EmployeeId_TimeRange] ON [dbo].[Rec_EmployeeAvailability]
(
	[EmployeeId] ASC,
	[AvailableFrom] ASC,
	[AvailableTo] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_Rec_EmployeeCapacity_EmployeeId_EffectiveFrom]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_Rec_EmployeeCapacity_EmployeeId_EffectiveFrom] ON [dbo].[Rec_EmployeeCapacity]
(
	[EmployeeId] ASC,
	[EffectiveFrom] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_Rec_EmployeeLocationEvents_EmployeeId_EventDate_EventTime]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_Rec_EmployeeLocationEvents_EmployeeId_EventDate_EventTime] ON [dbo].[Rec_EmployeeLocationEvents]
(
	[EmployeeId] ASC,
	[EventDate] ASC,
	[EventTime] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_Rec_EmployeePlannedStops_EmployeeId_PlannedDate_PlannedEndAt]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_Rec_EmployeePlannedStops_EmployeeId_PlannedDate_PlannedEndAt] ON [dbo].[Rec_EmployeePlannedStops]
(
	[EmployeeId] ASC,
	[PlannedDate] ASC,
	[PlannedEndAt] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_Rec_EmployeeSkills_EmployeeId]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_Rec_EmployeeSkills_EmployeeId] ON [dbo].[Rec_EmployeeSkills]
(
	[EmployeeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_Rec_EmployeeSkills_SkillId]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_Rec_EmployeeSkills_SkillId] ON [dbo].[Rec_EmployeeSkills]
(
	[SkillId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_Rec_RecommendationRuns_ProjectId_CreatedAt]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_Rec_RecommendationRuns_ProjectId_CreatedAt] ON [dbo].[Rec_RecommendationRuns]
(
	[ProjectId] ASC,
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_Rec_RouteEstimates_EmployeeId_TargetSiteId_Current]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_Rec_RouteEstimates_EmployeeId_TargetSiteId_Current] ON [dbo].[Rec_RouteEstimates]
(
	[EmployeeId] ASC,
	[TargetSiteId] ASC,
	[IsCurrent] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_Rec_TaskAssignmentRecommendations_Run_Task_Rank]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_Rec_TaskAssignmentRecommendations_Run_Task_Rank] ON [dbo].[Rec_TaskAssignmentRecommendations]
(
	[RecommendationRunId] ASC,
	[TaskId] ASC,
	[RankOrder] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_Rec_WorkItemAlgorithmProfile_WorkItemId]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_Rec_WorkItemAlgorithmProfile_WorkItemId] ON [dbo].[Rec_WorkItemAlgorithmProfile]
(
	[WorkItemId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_Rec_WorkItemRequiredSkills_WorkItemId]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_Rec_WorkItemRequiredSkills_WorkItemId] ON [dbo].[Rec_WorkItemRequiredSkills]
(
	[WorkItemId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_Sites_CustomerId]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_Sites_CustomerId] ON [dbo].[Sites]
(
	[CustomerId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_UserRoles_RoleId]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_UserRoles_RoleId] ON [dbo].[UserRoles]
(
	[RoleId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_UserRoles_UserId]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_UserRoles_UserId] ON [dbo].[UserRoles]
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_Users_EmployeeId]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_Users_EmployeeId] ON [dbo].[Users]
(
	[EmployeeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WorkContractorAssignments_ContractorId]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_WorkContractorAssignments_ContractorId] ON [dbo].[WorkContractorAssignments]
(
	[ContractorId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WorkContractorAssignments_WorkItemId]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_WorkContractorAssignments_WorkItemId] ON [dbo].[WorkContractorAssignments]
(
	[WorkItemId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WorkEmployeeAssignments_EmployeeId]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_WorkEmployeeAssignments_EmployeeId] ON [dbo].[WorkEmployeeAssignments]
(
	[EmployeeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WorkEmployeeAssignments_WorkItemId]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_WorkEmployeeAssignments_WorkItemId] ON [dbo].[WorkEmployeeAssignments]
(
	[WorkItemId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WorkItems_CustomerId]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_WorkItems_CustomerId] ON [dbo].[WorkItems]
(
	[CustomerId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
/****** Object:  Index [IX_WorkItems_SiteId]    Script Date: 31/05/2026 16:54:53 ******/
CREATE NONCLUSTERED INDEX [IX_WorkItems_SiteId] ON [dbo].[WorkItems]
(
	[SiteId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
GO
ALTER TABLE [dbo].[CompanySettings] ADD  CONSTRAINT [DF_CompanySettings_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[Contacts] ADD  CONSTRAINT [DF_Contacts_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Contacts] ADD  CONSTRAINT [DF_Contacts_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Contractors] ADD  CONSTRAINT [DF_Contractors_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Contractors] ADD  CONSTRAINT [DF_Contractors_CreatedAt]  DEFAULT (sysdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Customers] ADD  CONSTRAINT [DF_Customers_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Customers] ADD  CONSTRAINT [DF_Customers_CreatedAt]  DEFAULT (sysdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Employees] ADD  CONSTRAINT [DF_Employees_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Employees] ADD  CONSTRAINT [DF_Employees_CreatedAt]  DEFAULT (sysdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Employees] ADD  CONSTRAINT [DF_Employees_IsAssignable]  DEFAULT ((1)) FOR [IsAssignable]
GO
ALTER TABLE [dbo].[ProjectEquipmentItems] ADD  CONSTRAINT [DF_ProjectEquipmentItems_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Rec_EmployeeAvailability] ADD  CONSTRAINT [DF_Rec_EmployeeAvailability_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Rec_EmployeeBaseAddress] ADD  CONSTRAINT [DF_Rec_EmployeeBaseAddress_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Rec_EmployeeCapacity] ADD  CONSTRAINT [DF_Rec_EmployeeCapacity_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Rec_EmployeeLocationEvents] ADD  CONSTRAINT [DF_Rec_EmployeeLocationEvents_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Rec_EmployeePlannedStops] ADD  CONSTRAINT [DF_Rec_EmployeePlannedStops_StopStatus]  DEFAULT (N'Planned') FOR [StopStatus]
GO
ALTER TABLE [dbo].[Rec_EmployeePlannedStops] ADD  CONSTRAINT [DF_Rec_EmployeePlannedStops_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Rec_EmployeeSkills] ADD  CONSTRAINT [DF_Rec_EmployeeSkills_IsCertified]  DEFAULT ((0)) FOR [IsCertified]
GO
ALTER TABLE [dbo].[Rec_EmployeeSkills] ADD  CONSTRAINT [DF_Rec_EmployeeSkills_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Rec_EmployeeWorkZones] ADD  CONSTRAINT [DF_Rec_EmployeeWorkZones_IsPrimary]  DEFAULT ((0)) FOR [IsPrimary]
GO
ALTER TABLE [dbo].[Rec_EmployeeWorkZones] ADD  CONSTRAINT [DF_Rec_EmployeeWorkZones_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Rec_RecommendationRuns] ADD  CONSTRAINT [DF_Rec_RecommendationRuns_AlgorithmVersion]  DEFAULT (N'1.0') FOR [AlgorithmVersion]
GO
ALTER TABLE [dbo].[Rec_RecommendationRuns] ADD  CONSTRAINT [DF_Rec_RecommendationRuns_RunStatus]  DEFAULT (N'Completed') FOR [RunStatus]
GO
ALTER TABLE [dbo].[Rec_RecommendationRuns] ADD  CONSTRAINT [DF_Rec_RecommendationRuns_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Rec_RouteEstimates] ADD  CONSTRAINT [DF_Rec_RouteEstimates_RoutingMode]  DEFAULT (N'Driving') FOR [RoutingMode]
GO
ALTER TABLE [dbo].[Rec_RouteEstimates] ADD  CONSTRAINT [DF_Rec_RouteEstimates_CalculatedAt]  DEFAULT (sysutcdatetime()) FOR [CalculatedAt]
GO
ALTER TABLE [dbo].[Rec_RouteEstimates] ADD  CONSTRAINT [DF_Rec_RouteEstimates_IsCurrent]  DEFAULT ((1)) FOR [IsCurrent]
GO
ALTER TABLE [dbo].[Rec_SiteAddressProfile] ADD  CONSTRAINT [DF_Rec_SiteAddressProfile_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Rec_Skills] ADD  CONSTRAINT [DF_Rec_Skills_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Rec_Skills] ADD  CONSTRAINT [DF_Rec_Skills_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Rec_TaskAssignmentRecommendations] ADD  CONSTRAINT [DF_Rec_TaskAssignmentRecommendations_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Rec_WorkItemAlgorithmProfile] ADD  CONSTRAINT [DF_Rec_WorkItemAlgorithmProfile_RequiredWorkersCount]  DEFAULT ((1)) FOR [RequiredWorkersCount]
GO
ALTER TABLE [dbo].[Rec_WorkItemAlgorithmProfile] ADD  CONSTRAINT [DF_Rec_WorkItemAlgorithmProfile_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Rec_WorkItemRequiredSkills] ADD  CONSTRAINT [DF_Rec_WorkItemRequiredSkills_ImportanceLevel]  DEFAULT (N'Preferred') FOR [ImportanceLevel]
GO
ALTER TABLE [dbo].[Rec_WorkItemRequiredSkills] ADD  CONSTRAINT [DF_Rec_WorkItemRequiredSkills_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Rec_WorkZones] ADD  CONSTRAINT [DF_Rec_WorkZones_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Rec_WorkZones] ADD  CONSTRAINT [DF_Rec_WorkZones_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Roles] ADD  CONSTRAINT [DF_Roles_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Roles] ADD  CONSTRAINT [DF_Roles_CreatedAt]  DEFAULT (sysdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Sites] ADD  CONSTRAINT [DF_Sites_IsPrimary]  DEFAULT ((0)) FOR [IsPrimary]
GO
ALTER TABLE [dbo].[Sites] ADD  CONSTRAINT [DF_Sites_CreatedAt]  DEFAULT (sysdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[UserDepartments] ADD  DEFAULT (getdate()) FOR [AssignedAt]
GO
ALTER TABLE [dbo].[UserDepartments] ADD  CONSTRAINT [DF_UserDepartments_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[UserRoles] ADD  CONSTRAINT [DF_UserRoles_AssignedAt]  DEFAULT (sysdatetime()) FOR [AssignedAt]
GO
ALTER TABLE [dbo].[UserRoles] ADD  CONSTRAINT [DF_UserRoles_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Users] ADD  CONSTRAINT [DF_Users_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Users] ADD  CONSTRAINT [DF_Users_CreatedAt]  DEFAULT (sysdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ('') FOR [PasswordSalt]
GO
ALTER TABLE [dbo].[WorkContractorAssignments] ADD  CONSTRAINT [DF_WorkContractorAssignments_AssignedAt]  DEFAULT (sysdatetime()) FOR [AssignedAt]
GO
ALTER TABLE [dbo].[WorkEmployeeAssignments] ADD  CONSTRAINT [DF_WorkEmployeeAssignments_AssignedAt]  DEFAULT (sysdatetime()) FOR [AssignedAt]
GO
ALTER TABLE [dbo].[WorkEmployeeAssignments] ADD  CONSTRAINT [DF_WorkEmployeeAssignments_IsManualAssignment]  DEFAULT ((0)) FOR [IsManualAssignment]
GO
ALTER TABLE [dbo].[WorkItems] ADD  CONSTRAINT [DF_WorkItems_CreatedAt]  DEFAULT (sysdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WorkItems] ADD  CONSTRAINT [DF_WorkItems_IsLocked]  DEFAULT ((0)) FOR [IsLocked]
GO
ALTER TABLE [dbo].[WorkReportEmployeeAssignments] ADD  CONSTRAINT [DF_WorkReportEmployeeAssignments_AssignedAt]  DEFAULT (getdate()) FOR [AssignedAt]
GO
ALTER TABLE [dbo].[WorkReports] ADD  CONSTRAINT [DF_WorkReports_WorkersCount]  DEFAULT ((0)) FOR [WorkersCount]
GO
ALTER TABLE [dbo].[WorkReports] ADD  CONSTRAINT [DF_WorkReports_FollowUpRequired]  DEFAULT ((0)) FOR [FollowUpRequired]
GO
ALTER TABLE [dbo].[WorkReports] ADD  CONSTRAINT [DF_WorkReports_CreatedAt]  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WorkReports] ADD  CONSTRAINT [DF_WorkReports_Status]  DEFAULT ('טיוטה') FOR [Status]
GO
ALTER TABLE [dbo].[WorkReportSystems] ADD  CONSTRAINT [DF_WorkReportSystems_CreatedAt]  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Contacts]  WITH CHECK ADD  CONSTRAINT [FK_Contacts_CreatedByUser] FOREIGN KEY([CreatedByUserId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[Contacts] CHECK CONSTRAINT [FK_Contacts_CreatedByUser]
GO
ALTER TABLE [dbo].[Contacts]  WITH CHECK ADD  CONSTRAINT [FK_Contacts_Customers] FOREIGN KEY([CustomerId])
REFERENCES [dbo].[Customers] ([CustomerId])
GO
ALTER TABLE [dbo].[Contacts] CHECK CONSTRAINT [FK_Contacts_Customers]
GO
ALTER TABLE [dbo].[Contacts]  WITH CHECK ADD  CONSTRAINT [FK_Contacts_UpdatedByUser] FOREIGN KEY([UpdatedByUserId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[Contacts] CHECK CONSTRAINT [FK_Contacts_UpdatedByUser]
GO
ALTER TABLE [dbo].[Customers]  WITH CHECK ADD  CONSTRAINT [FK_Customers_CreatedByUser] FOREIGN KEY([CreatedByUserId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[Customers] CHECK CONSTRAINT [FK_Customers_CreatedByUser]
GO
ALTER TABLE [dbo].[Customers]  WITH CHECK ADD  CONSTRAINT [FK_Customers_UpdatedByUser] FOREIGN KEY([UpdatedByUserId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[Customers] CHECK CONSTRAINT [FK_Customers_UpdatedByUser]
GO
ALTER TABLE [dbo].[ProjectEquipmentItems]  WITH CHECK ADD  CONSTRAINT [FK_ProjectEquipmentItems_WorkItems] FOREIGN KEY([ProjectId])
REFERENCES [dbo].[WorkItems] ([WorkItemId])
GO
ALTER TABLE [dbo].[ProjectEquipmentItems] CHECK CONSTRAINT [FK_ProjectEquipmentItems_WorkItems]
GO
ALTER TABLE [dbo].[ProjectBoqItems]  WITH CHECK ADD  CONSTRAINT [FK_ProjectBoqItems_WorkItems] FOREIGN KEY([ProjectId])
REFERENCES [dbo].[WorkItems] ([WorkItemId])
GO
ALTER TABLE [dbo].[ProjectBoqItems] CHECK CONSTRAINT [FK_ProjectBoqItems_WorkItems]
GO
ALTER TABLE [dbo].[ProjectDrawings]  WITH CHECK ADD  CONSTRAINT [FK_ProjectDrawings_WorkItems] FOREIGN KEY([ProjectId])
REFERENCES [dbo].[WorkItems] ([WorkItemId])
GO
ALTER TABLE [dbo].[ProjectDrawings] CHECK CONSTRAINT [FK_ProjectDrawings_WorkItems]
GO
ALTER TABLE [dbo].[Rec_EmployeeAvailability]  WITH CHECK ADD  CONSTRAINT [FK_Rec_EmployeeAvailability_Employees] FOREIGN KEY([EmployeeId])
REFERENCES [dbo].[Employees] ([EmployeeId])
GO
ALTER TABLE [dbo].[Rec_EmployeeAvailability] CHECK CONSTRAINT [FK_Rec_EmployeeAvailability_Employees]
GO
ALTER TABLE [dbo].[Rec_EmployeeBaseAddress]  WITH CHECK ADD  CONSTRAINT [FK_Rec_EmployeeBaseAddress_Employees] FOREIGN KEY([EmployeeId])
REFERENCES [dbo].[Employees] ([EmployeeId])
GO
ALTER TABLE [dbo].[Rec_EmployeeBaseAddress] CHECK CONSTRAINT [FK_Rec_EmployeeBaseAddress_Employees]
GO
ALTER TABLE [dbo].[Rec_EmployeeBaseAddress]  WITH CHECK ADD  CONSTRAINT [FK_Rec_EmployeeBaseAddress_WorkZones] FOREIGN KEY([ZoneId])
REFERENCES [dbo].[Rec_WorkZones] ([ZoneId])
GO
ALTER TABLE [dbo].[Rec_EmployeeBaseAddress] CHECK CONSTRAINT [FK_Rec_EmployeeBaseAddress_WorkZones]
GO
ALTER TABLE [dbo].[Rec_EmployeeCapacity]  WITH CHECK ADD  CONSTRAINT [FK_Rec_EmployeeCapacity_Employees] FOREIGN KEY([EmployeeId])
REFERENCES [dbo].[Employees] ([EmployeeId])
GO
ALTER TABLE [dbo].[Rec_EmployeeCapacity] CHECK CONSTRAINT [FK_Rec_EmployeeCapacity_Employees]
GO
ALTER TABLE [dbo].[Rec_EmployeeLocationEvents]  WITH CHECK ADD  CONSTRAINT [FK_Rec_EmployeeLocationEvents_Employees] FOREIGN KEY([EmployeeId])
REFERENCES [dbo].[Employees] ([EmployeeId])
GO
ALTER TABLE [dbo].[Rec_EmployeeLocationEvents] CHECK CONSTRAINT [FK_Rec_EmployeeLocationEvents_Employees]
GO
ALTER TABLE [dbo].[Rec_EmployeeLocationEvents]  WITH CHECK ADD  CONSTRAINT [FK_Rec_EmployeeLocationEvents_Sites] FOREIGN KEY([SiteId])
REFERENCES [dbo].[Sites] ([SiteId])
GO
ALTER TABLE [dbo].[Rec_EmployeeLocationEvents] CHECK CONSTRAINT [FK_Rec_EmployeeLocationEvents_Sites]
GO
ALTER TABLE [dbo].[Rec_EmployeeLocationEvents]  WITH CHECK ADD  CONSTRAINT [FK_Rec_EmployeeLocationEvents_WorkItems] FOREIGN KEY([WorkItemId])
REFERENCES [dbo].[WorkItems] ([WorkItemId])
GO
ALTER TABLE [dbo].[Rec_EmployeeLocationEvents] CHECK CONSTRAINT [FK_Rec_EmployeeLocationEvents_WorkItems]
GO
ALTER TABLE [dbo].[Rec_EmployeeLocationEvents]  WITH CHECK ADD  CONSTRAINT [FK_Rec_EmployeeLocationEvents_WorkZones] FOREIGN KEY([ZoneId])
REFERENCES [dbo].[Rec_WorkZones] ([ZoneId])
GO
ALTER TABLE [dbo].[Rec_EmployeeLocationEvents] CHECK CONSTRAINT [FK_Rec_EmployeeLocationEvents_WorkZones]
GO
ALTER TABLE [dbo].[Rec_EmployeePlannedStops]  WITH CHECK ADD  CONSTRAINT [FK_Rec_EmployeePlannedStops_Employees] FOREIGN KEY([EmployeeId])
REFERENCES [dbo].[Employees] ([EmployeeId])
GO
ALTER TABLE [dbo].[Rec_EmployeePlannedStops] CHECK CONSTRAINT [FK_Rec_EmployeePlannedStops_Employees]
GO
ALTER TABLE [dbo].[Rec_EmployeePlannedStops]  WITH CHECK ADD  CONSTRAINT [FK_Rec_EmployeePlannedStops_Sites] FOREIGN KEY([SiteId])
REFERENCES [dbo].[Sites] ([SiteId])
GO
ALTER TABLE [dbo].[Rec_EmployeePlannedStops] CHECK CONSTRAINT [FK_Rec_EmployeePlannedStops_Sites]
GO
ALTER TABLE [dbo].[Rec_EmployeePlannedStops]  WITH CHECK ADD  CONSTRAINT [FK_Rec_EmployeePlannedStops_WorkItems] FOREIGN KEY([WorkItemId])
REFERENCES [dbo].[WorkItems] ([WorkItemId])
GO
ALTER TABLE [dbo].[Rec_EmployeePlannedStops] CHECK CONSTRAINT [FK_Rec_EmployeePlannedStops_WorkItems]
GO
ALTER TABLE [dbo].[Rec_EmployeePlannedStops]  WITH CHECK ADD  CONSTRAINT [FK_Rec_EmployeePlannedStops_WorkZones] FOREIGN KEY([ZoneId])
REFERENCES [dbo].[Rec_WorkZones] ([ZoneId])
GO
ALTER TABLE [dbo].[Rec_EmployeePlannedStops] CHECK CONSTRAINT [FK_Rec_EmployeePlannedStops_WorkZones]
GO
ALTER TABLE [dbo].[Rec_EmployeeSkills]  WITH CHECK ADD  CONSTRAINT [FK_Rec_EmployeeSkills_Employees] FOREIGN KEY([EmployeeId])
REFERENCES [dbo].[Employees] ([EmployeeId])
GO
ALTER TABLE [dbo].[Rec_EmployeeSkills] CHECK CONSTRAINT [FK_Rec_EmployeeSkills_Employees]
GO
ALTER TABLE [dbo].[Rec_EmployeeSkills]  WITH CHECK ADD  CONSTRAINT [FK_Rec_EmployeeSkills_Skills] FOREIGN KEY([SkillId])
REFERENCES [dbo].[Rec_Skills] ([SkillId])
GO
ALTER TABLE [dbo].[Rec_EmployeeSkills] CHECK CONSTRAINT [FK_Rec_EmployeeSkills_Skills]
GO
ALTER TABLE [dbo].[Rec_EmployeeWorkZones]  WITH CHECK ADD  CONSTRAINT [FK_Rec_EmployeeWorkZones_Employees] FOREIGN KEY([EmployeeId])
REFERENCES [dbo].[Employees] ([EmployeeId])
GO
ALTER TABLE [dbo].[Rec_EmployeeWorkZones] CHECK CONSTRAINT [FK_Rec_EmployeeWorkZones_Employees]
GO
ALTER TABLE [dbo].[Rec_EmployeeWorkZones]  WITH CHECK ADD  CONSTRAINT [FK_Rec_EmployeeWorkZones_WorkZones] FOREIGN KEY([ZoneId])
REFERENCES [dbo].[Rec_WorkZones] ([ZoneId])
GO
ALTER TABLE [dbo].[Rec_EmployeeWorkZones] CHECK CONSTRAINT [FK_Rec_EmployeeWorkZones_WorkZones]
GO
ALTER TABLE [dbo].[Rec_RecommendationRuns]  WITH CHECK ADD  CONSTRAINT [FK_Rec_RecommendationRuns_Project_WorkItems] FOREIGN KEY([ProjectId])
REFERENCES [dbo].[WorkItems] ([WorkItemId])
GO
ALTER TABLE [dbo].[Rec_RecommendationRuns] CHECK CONSTRAINT [FK_Rec_RecommendationRuns_Project_WorkItems]
GO
ALTER TABLE [dbo].[Rec_RecommendationRuns]  WITH CHECK ADD  CONSTRAINT [FK_Rec_RecommendationRuns_Task_WorkItems] FOREIGN KEY([TaskId])
REFERENCES [dbo].[WorkItems] ([WorkItemId])
GO
ALTER TABLE [dbo].[Rec_RecommendationRuns] CHECK CONSTRAINT [FK_Rec_RecommendationRuns_Task_WorkItems]
GO
ALTER TABLE [dbo].[Rec_RecommendationRuns]  WITH CHECK ADD  CONSTRAINT [FK_Rec_RecommendationRuns_Users] FOREIGN KEY([RequestedByUserId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[Rec_RecommendationRuns] CHECK CONSTRAINT [FK_Rec_RecommendationRuns_Users]
GO
ALTER TABLE [dbo].[Rec_RouteEstimates]  WITH CHECK ADD  CONSTRAINT [FK_Rec_RouteEstimates_Employees] FOREIGN KEY([EmployeeId])
REFERENCES [dbo].[Employees] ([EmployeeId])
GO
ALTER TABLE [dbo].[Rec_RouteEstimates] CHECK CONSTRAINT [FK_Rec_RouteEstimates_Employees]
GO
ALTER TABLE [dbo].[Rec_RouteEstimates]  WITH CHECK ADD  CONSTRAINT [FK_Rec_RouteEstimates_Sites] FOREIGN KEY([TargetSiteId])
REFERENCES [dbo].[Sites] ([SiteId])
GO
ALTER TABLE [dbo].[Rec_RouteEstimates] CHECK CONSTRAINT [FK_Rec_RouteEstimates_Sites]
GO
ALTER TABLE [dbo].[Rec_SiteAddressProfile]  WITH CHECK ADD  CONSTRAINT [FK_Rec_SiteAddressProfile_Sites] FOREIGN KEY([SiteId])
REFERENCES [dbo].[Sites] ([SiteId])
GO
ALTER TABLE [dbo].[Rec_SiteAddressProfile] CHECK CONSTRAINT [FK_Rec_SiteAddressProfile_Sites]
GO
ALTER TABLE [dbo].[Rec_SiteAddressProfile]  WITH CHECK ADD  CONSTRAINT [FK_Rec_SiteAddressProfile_WorkZones] FOREIGN KEY([ZoneId])
REFERENCES [dbo].[Rec_WorkZones] ([ZoneId])
GO
ALTER TABLE [dbo].[Rec_SiteAddressProfile] CHECK CONSTRAINT [FK_Rec_SiteAddressProfile_WorkZones]
GO
ALTER TABLE [dbo].[Rec_TaskAssignmentRecommendations]  WITH CHECK ADD  CONSTRAINT [FK_Rec_TaskAssignmentRecommendations_Employees] FOREIGN KEY([EmployeeId])
REFERENCES [dbo].[Employees] ([EmployeeId])
GO
ALTER TABLE [dbo].[Rec_TaskAssignmentRecommendations] CHECK CONSTRAINT [FK_Rec_TaskAssignmentRecommendations_Employees]
GO
ALTER TABLE [dbo].[Rec_TaskAssignmentRecommendations]  WITH CHECK ADD  CONSTRAINT [FK_Rec_TaskAssignmentRecommendations_Runs] FOREIGN KEY([RecommendationRunId])
REFERENCES [dbo].[Rec_RecommendationRuns] ([RecommendationRunId])
GO
ALTER TABLE [dbo].[Rec_TaskAssignmentRecommendations] CHECK CONSTRAINT [FK_Rec_TaskAssignmentRecommendations_Runs]
GO
ALTER TABLE [dbo].[Rec_TaskAssignmentRecommendations]  WITH CHECK ADD  CONSTRAINT [FK_Rec_TaskAssignmentRecommendations_WorkItems] FOREIGN KEY([TaskId])
REFERENCES [dbo].[WorkItems] ([WorkItemId])
GO
ALTER TABLE [dbo].[Rec_TaskAssignmentRecommendations] CHECK CONSTRAINT [FK_Rec_TaskAssignmentRecommendations_WorkItems]
GO
ALTER TABLE [dbo].[Rec_WorkItemAlgorithmProfile]  WITH CHECK ADD  CONSTRAINT [FK_Rec_WorkItemAlgorithmProfile_WorkItems] FOREIGN KEY([WorkItemId])
REFERENCES [dbo].[WorkItems] ([WorkItemId])
GO
ALTER TABLE [dbo].[Rec_WorkItemAlgorithmProfile] CHECK CONSTRAINT [FK_Rec_WorkItemAlgorithmProfile_WorkItems]
GO
ALTER TABLE [dbo].[Rec_WorkItemRequiredSkills]  WITH CHECK ADD  CONSTRAINT [FK_Rec_WorkItemRequiredSkills_Skills] FOREIGN KEY([SkillId])
REFERENCES [dbo].[Rec_Skills] ([SkillId])
GO
ALTER TABLE [dbo].[Rec_WorkItemRequiredSkills] CHECK CONSTRAINT [FK_Rec_WorkItemRequiredSkills_Skills]
GO
ALTER TABLE [dbo].[Rec_WorkItemRequiredSkills]  WITH CHECK ADD  CONSTRAINT [FK_Rec_WorkItemRequiredSkills_WorkItems] FOREIGN KEY([WorkItemId])
REFERENCES [dbo].[WorkItems] ([WorkItemId])
GO
ALTER TABLE [dbo].[Rec_WorkItemRequiredSkills] CHECK CONSTRAINT [FK_Rec_WorkItemRequiredSkills_WorkItems]
GO
ALTER TABLE [dbo].[Sites]  WITH CHECK ADD  CONSTRAINT [FK_Sites_Customers] FOREIGN KEY([CustomerId])
REFERENCES [dbo].[Customers] ([CustomerId])
GO
ALTER TABLE [dbo].[Sites] CHECK CONSTRAINT [FK_Sites_Customers]
GO
ALTER TABLE [dbo].[UserDepartments]  WITH CHECK ADD  CONSTRAINT [FK_UserDepartments_Departments] FOREIGN KEY([DepartmentId])
REFERENCES [dbo].[Departments] ([DepartmentId])
GO
ALTER TABLE [dbo].[UserDepartments] CHECK CONSTRAINT [FK_UserDepartments_Departments]
GO
ALTER TABLE [dbo].[UserDepartments]  WITH CHECK ADD  CONSTRAINT [FK_UserDepartments_Users] FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[UserDepartments] CHECK CONSTRAINT [FK_UserDepartments_Users]
GO
ALTER TABLE [dbo].[UserRoles]  WITH CHECK ADD  CONSTRAINT [FK_UserRoles_Roles] FOREIGN KEY([RoleId])
REFERENCES [dbo].[Roles] ([RoleId])
GO
ALTER TABLE [dbo].[UserRoles] CHECK CONSTRAINT [FK_UserRoles_Roles]
GO
ALTER TABLE [dbo].[UserRoles]  WITH CHECK ADD  CONSTRAINT [FK_UserRoles_Users] FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[UserRoles] CHECK CONSTRAINT [FK_UserRoles_Users]
GO
ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [FK_Users_Employees] FOREIGN KEY([EmployeeId])
REFERENCES [dbo].[Employees] ([EmployeeId])
GO
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [FK_Users_Employees]
GO
ALTER TABLE [dbo].[WorkContractorAssignments]  WITH CHECK ADD  CONSTRAINT [FK_WorkContractorAssignments_Contractors] FOREIGN KEY([ContractorId])
REFERENCES [dbo].[Contractors] ([ContractorId])
GO
ALTER TABLE [dbo].[WorkContractorAssignments] CHECK CONSTRAINT [FK_WorkContractorAssignments_Contractors]
GO
ALTER TABLE [dbo].[WorkContractorAssignments]  WITH CHECK ADD  CONSTRAINT [FK_WorkContractorAssignments_WorkItems] FOREIGN KEY([WorkItemId])
REFERENCES [dbo].[WorkItems] ([WorkItemId])
GO
ALTER TABLE [dbo].[WorkContractorAssignments] CHECK CONSTRAINT [FK_WorkContractorAssignments_WorkItems]
GO
ALTER TABLE [dbo].[WorkEmployeeAssignments]  WITH CHECK ADD  CONSTRAINT [FK_WorkEmployeeAssignments_Employees] FOREIGN KEY([EmployeeId])
REFERENCES [dbo].[Employees] ([EmployeeId])
GO
ALTER TABLE [dbo].[WorkEmployeeAssignments] CHECK CONSTRAINT [FK_WorkEmployeeAssignments_Employees]
GO
ALTER TABLE [dbo].[WorkEmployeeAssignments]  WITH CHECK ADD  CONSTRAINT [FK_WorkEmployeeAssignments_WorkItems] FOREIGN KEY([WorkItemId])
REFERENCES [dbo].[WorkItems] ([WorkItemId])
GO
ALTER TABLE [dbo].[WorkEmployeeAssignments] CHECK CONSTRAINT [FK_WorkEmployeeAssignments_WorkItems]
GO
ALTER TABLE [dbo].[WorkItems]  WITH CHECK ADD  CONSTRAINT [FK_WorkItems_Customers] FOREIGN KEY([CustomerId])
REFERENCES [dbo].[Customers] ([CustomerId])
GO
ALTER TABLE [dbo].[WorkItems] CHECK CONSTRAINT [FK_WorkItems_Customers]
GO
ALTER TABLE [dbo].[WorkItems]  WITH CHECK ADD  CONSTRAINT [FK_WorkItems_ParentWorkItem] FOREIGN KEY([ParentWorkItemId])
REFERENCES [dbo].[WorkItems] ([WorkItemId])
GO
ALTER TABLE [dbo].[WorkItems] CHECK CONSTRAINT [FK_WorkItems_ParentWorkItem]
GO
ALTER TABLE [dbo].[WorkItems]  WITH CHECK ADD  CONSTRAINT [FK_WorkItems_Sites] FOREIGN KEY([SiteId])
REFERENCES [dbo].[Sites] ([SiteId])
GO
ALTER TABLE [dbo].[WorkItems] CHECK CONSTRAINT [FK_WorkItems_Sites]
GO
ALTER TABLE [dbo].[WorkReportEmployeeAssignments]  WITH CHECK ADD  CONSTRAINT [FK_WorkReportEmployeeAssignments_Employees] FOREIGN KEY([EmployeeId])
REFERENCES [dbo].[Employees] ([EmployeeId])
GO
ALTER TABLE [dbo].[WorkReportEmployeeAssignments] CHECK CONSTRAINT [FK_WorkReportEmployeeAssignments_Employees]
GO
ALTER TABLE [dbo].[WorkReportEmployeeAssignments]  WITH CHECK ADD  CONSTRAINT [FK_WorkReportEmployeeAssignments_WorkReports] FOREIGN KEY([WorkReportId])
REFERENCES [dbo].[WorkReports] ([WorkReportId])
GO
ALTER TABLE [dbo].[WorkReportEmployeeAssignments] CHECK CONSTRAINT [FK_WorkReportEmployeeAssignments_WorkReports]
GO
ALTER TABLE [dbo].[WorkReports]  WITH CHECK ADD  CONSTRAINT [FK_WorkReports_Employees] FOREIGN KEY([ReporterEmployeeId])
REFERENCES [dbo].[Employees] ([EmployeeId])
GO
ALTER TABLE [dbo].[WorkReports] CHECK CONSTRAINT [FK_WorkReports_Employees]
GO
ALTER TABLE [dbo].[WorkReports]  WITH CHECK ADD  CONSTRAINT [FK_WorkReports_WorkItems] FOREIGN KEY([WorkItemId])
REFERENCES [dbo].[WorkItems] ([WorkItemId])
GO
ALTER TABLE [dbo].[WorkReports] CHECK CONSTRAINT [FK_WorkReports_WorkItems]
GO
ALTER TABLE [dbo].[WorkReportSystems]  WITH CHECK ADD  CONSTRAINT [FK_WorkReportSystems_WorkReports] FOREIGN KEY([WorkReportId])
REFERENCES [dbo].[WorkReports] ([WorkReportId])
GO
ALTER TABLE [dbo].[WorkReportSystems] CHECK CONSTRAINT [FK_WorkReportSystems_WorkReports]
GO
ALTER TABLE [dbo].[Contacts]  WITH CHECK ADD  CONSTRAINT [CK_Contacts_ContactCategory] CHECK  (([ContactCategory]='Other' OR [ContactCategory]='Contractor' OR [ContactCategory]='Architect' OR [ContactCategory]='Consultant' OR [ContactCategory]='BusinessPartner' OR [ContactCategory]='Supplier' OR [ContactCategory]='CustomerRepresentative' OR [ContactCategory]='CustomerPrimary'))
GO
ALTER TABLE [dbo].[Contacts] CHECK CONSTRAINT [CK_Contacts_ContactCategory]
GO
ALTER TABLE [dbo].[Contacts]  WITH CHECK ADD  CONSTRAINT [CK_Contacts_CustomerRequiredByCategory] CHECK  ((([ContactCategory]='CustomerRepresentative' OR [ContactCategory]='CustomerPrimary') AND [CustomerId] IS NOT NULL OR NOT ([ContactCategory]='CustomerRepresentative' OR [ContactCategory]='CustomerPrimary')))
GO
ALTER TABLE [dbo].[Contacts] CHECK CONSTRAINT [CK_Contacts_CustomerRequiredByCategory]
GO
ALTER TABLE [dbo].[Contacts]  WITH CHECK ADD  CONSTRAINT [CK_Contacts_PhoneOrEmailRequired] CHECK  ((nullif(ltrim(rtrim(isnull([Phone],''))),'') IS NOT NULL OR nullif(ltrim(rtrim(isnull([Email],''))),'') IS NOT NULL))
GO
ALTER TABLE [dbo].[Contacts] CHECK CONSTRAINT [CK_Contacts_PhoneOrEmailRequired]
GO
ALTER TABLE [dbo].[CompanySettings]  WITH CHECK ADD  CONSTRAINT [CK_CompanySettings_SingleRow] CHECK  (([CompanySettingsId]=(1)))
GO
ALTER TABLE [dbo].[CompanySettings] CHECK CONSTRAINT [CK_CompanySettings_SingleRow]
GO
ALTER TABLE [dbo].[ProjectEquipmentItems]  WITH CHECK ADD  CONSTRAINT [CK_ProjectEquipmentItems_EquipmentName_NotBlank] CHECK  ((len(ltrim(rtrim([EquipmentName])))>(0)))
GO
ALTER TABLE [dbo].[ProjectEquipmentItems] CHECK CONSTRAINT [CK_ProjectEquipmentItems_EquipmentName_NotBlank]
GO
ALTER TABLE [dbo].[ProjectEquipmentItems]  WITH CHECK ADD  CONSTRAINT [CK_ProjectEquipmentItems_Status_NotBlank] CHECK  ((len(ltrim(rtrim([Status])))>(0)))
GO
ALTER TABLE [dbo].[ProjectEquipmentItems] CHECK CONSTRAINT [CK_ProjectEquipmentItems_Status_NotBlank]
GO
ALTER TABLE [dbo].[Rec_EmployeeAvailability]  WITH CHECK ADD  CONSTRAINT [CK_Rec_EmployeeAvailability_TimeRange] CHECK  (([AvailableFrom]<[AvailableTo]))
GO
ALTER TABLE [dbo].[Rec_EmployeeAvailability] CHECK CONSTRAINT [CK_Rec_EmployeeAvailability_TimeRange]
GO
ALTER TABLE [dbo].[Rec_EmployeeAvailability]  WITH CHECK ADD  CONSTRAINT [CK_Rec_EmployeeAvailability_Type] CHECK  (([AvailabilityType]=N'Training' OR [AvailabilityType]=N'Sick' OR [AvailabilityType]=N'Leave' OR [AvailabilityType]=N'Busy' OR [AvailabilityType]=N'Available'))
GO
ALTER TABLE [dbo].[Rec_EmployeeAvailability] CHECK CONSTRAINT [CK_Rec_EmployeeAvailability_Type]
GO
ALTER TABLE [dbo].[Rec_EmployeeBaseAddress]  WITH CHECK ADD  CONSTRAINT [CK_Rec_EmployeeBaseAddress_ValidationScore] CHECK  (([ValidationScore] IS NULL OR [ValidationScore]>=(0) AND [ValidationScore]<=(100)))
GO
ALTER TABLE [dbo].[Rec_EmployeeBaseAddress] CHECK CONSTRAINT [CK_Rec_EmployeeBaseAddress_ValidationScore]
GO
ALTER TABLE [dbo].[Rec_EmployeeCapacity]  WITH CHECK ADD  CONSTRAINT [CK_Rec_EmployeeCapacity_DateRange] CHECK  (([EffectiveTo] IS NULL OR [EffectiveTo]>=[EffectiveFrom]))
GO
ALTER TABLE [dbo].[Rec_EmployeeCapacity] CHECK CONSTRAINT [CK_Rec_EmployeeCapacity_DateRange]
GO
ALTER TABLE [dbo].[Rec_EmployeeCapacity]  WITH CHECK ADD  CONSTRAINT [CK_Rec_EmployeeCapacity_WeeklyCapacityHours] CHECK  (([WeeklyCapacityHours]>(0)))
GO
ALTER TABLE [dbo].[Rec_EmployeeCapacity] CHECK CONSTRAINT [CK_Rec_EmployeeCapacity_WeeklyCapacityHours]
GO
ALTER TABLE [dbo].[Rec_EmployeeLocationEvents]  WITH CHECK ADD  CONSTRAINT [CK_Rec_EmployeeLocationEvents_EventType] CHECK  (([EventType]=N'WorkCompletion' OR [EventType]=N'Manual' OR [EventType]=N'SiteVisit' OR [EventType]=N'HomeBase'))
GO
ALTER TABLE [dbo].[Rec_EmployeeLocationEvents] CHECK CONSTRAINT [CK_Rec_EmployeeLocationEvents_EventType]
GO
ALTER TABLE [dbo].[Rec_EmployeePlannedStops]  WITH CHECK ADD  CONSTRAINT [CK_Rec_EmployeePlannedStops_StopStatus] CHECK  (([StopStatus]=N'Cancelled' OR [StopStatus]=N'Completed' OR [StopStatus]=N'InProgress' OR [StopStatus]=N'Planned'))
GO
ALTER TABLE [dbo].[Rec_EmployeePlannedStops] CHECK CONSTRAINT [CK_Rec_EmployeePlannedStops_StopStatus]
GO
ALTER TABLE [dbo].[Rec_EmployeePlannedStops]  WITH CHECK ADD  CONSTRAINT [CK_Rec_EmployeePlannedStops_TimeRange] CHECK  (([PlannedStartAt] IS NULL OR [PlannedEndAt] IS NULL OR [PlannedStartAt]<=[PlannedEndAt]))
GO
ALTER TABLE [dbo].[Rec_EmployeePlannedStops] CHECK CONSTRAINT [CK_Rec_EmployeePlannedStops_TimeRange]
GO
ALTER TABLE [dbo].[Rec_EmployeeSkills]  WITH CHECK ADD  CONSTRAINT [CK_Rec_EmployeeSkills_SkillLevel] CHECK  (([SkillLevel]>=(1) AND [SkillLevel]<=(5)))
GO
ALTER TABLE [dbo].[Rec_EmployeeSkills] CHECK CONSTRAINT [CK_Rec_EmployeeSkills_SkillLevel]
GO
ALTER TABLE [dbo].[Rec_EmployeeSkills]  WITH CHECK ADD  CONSTRAINT [CK_Rec_EmployeeSkills_YearsExperience] CHECK  (([YearsExperience] IS NULL OR [YearsExperience]>=(0)))
GO
ALTER TABLE [dbo].[Rec_EmployeeSkills] CHECK CONSTRAINT [CK_Rec_EmployeeSkills_YearsExperience]
GO
ALTER TABLE [dbo].[Rec_RecommendationRuns]  WITH CHECK ADD  CONSTRAINT [CK_Rec_RecommendationRuns_RunStatus] CHECK  (([RunStatus]=N'Partial' OR [RunStatus]=N'Failed' OR [RunStatus]=N'Completed'))
GO
ALTER TABLE [dbo].[Rec_RecommendationRuns] CHECK CONSTRAINT [CK_Rec_RecommendationRuns_RunStatus]
GO
ALTER TABLE [dbo].[Rec_RecommendationRuns]  WITH CHECK ADD  CONSTRAINT [CK_Rec_RecommendationRuns_ScopeType] CHECK  (([ScopeType]=N'AllProjects' OR [ScopeType]=N'Task' OR [ScopeType]=N'Project'))
GO
ALTER TABLE [dbo].[Rec_RecommendationRuns] CHECK CONSTRAINT [CK_Rec_RecommendationRuns_ScopeType]
GO
ALTER TABLE [dbo].[Rec_RouteEstimates]  WITH CHECK ADD  CONSTRAINT [CK_Rec_RouteEstimates_Distance] CHECK  (([EstimatedDistanceKm] IS NULL OR [EstimatedDistanceKm]>=(0)))
GO
ALTER TABLE [dbo].[Rec_RouteEstimates] CHECK CONSTRAINT [CK_Rec_RouteEstimates_Distance]
GO
ALTER TABLE [dbo].[Rec_RouteEstimates]  WITH CHECK ADD  CONSTRAINT [CK_Rec_RouteEstimates_OriginType] CHECK  (([OriginType]=N'PlannedStop' OR [OriginType]=N'LastKnownLocation' OR [OriginType]=N'HomeBase'))
GO
ALTER TABLE [dbo].[Rec_RouteEstimates] CHECK CONSTRAINT [CK_Rec_RouteEstimates_OriginType]
GO
ALTER TABLE [dbo].[Rec_RouteEstimates]  WITH CHECK ADD  CONSTRAINT [CK_Rec_RouteEstimates_RoutingMode] CHECK  (([RoutingMode]=N'Cycling' OR [RoutingMode]=N'Walking' OR [RoutingMode]=N'Driving'))
GO
ALTER TABLE [dbo].[Rec_RouteEstimates] CHECK CONSTRAINT [CK_Rec_RouteEstimates_RoutingMode]
GO
ALTER TABLE [dbo].[Rec_RouteEstimates]  WITH CHECK ADD  CONSTRAINT [CK_Rec_RouteEstimates_TravelMinutes] CHECK  (([EstimatedTravelMinutes] IS NULL OR [EstimatedTravelMinutes]>=(0)))
GO
ALTER TABLE [dbo].[Rec_RouteEstimates] CHECK CONSTRAINT [CK_Rec_RouteEstimates_TravelMinutes]
GO
ALTER TABLE [dbo].[Rec_SiteAddressProfile]  WITH CHECK ADD  CONSTRAINT [CK_Rec_SiteAddressProfile_ValidationScore] CHECK  (([ValidationScore] IS NULL OR [ValidationScore]>=(0) AND [ValidationScore]<=(100)))
GO
ALTER TABLE [dbo].[Rec_SiteAddressProfile] CHECK CONSTRAINT [CK_Rec_SiteAddressProfile_ValidationScore]
GO
ALTER TABLE [dbo].[Rec_TaskAssignmentRecommendations]  WITH CHECK ADD  CONSTRAINT [CK_Rec_TaskAssignmentRecommendations_OriginTypeUsed] CHECK  (([OriginTypeUsed] IS NULL OR ([OriginTypeUsed]=N'PlannedStop' OR [OriginTypeUsed]=N'LastKnownLocation' OR [OriginTypeUsed]=N'HomeBase')))
GO
ALTER TABLE [dbo].[Rec_TaskAssignmentRecommendations] CHECK CONSTRAINT [CK_Rec_TaskAssignmentRecommendations_OriginTypeUsed]
GO
ALTER TABLE [dbo].[Rec_TaskAssignmentRecommendations]  WITH CHECK ADD  CONSTRAINT [CK_Rec_TaskAssignmentRecommendations_RankOrder] CHECK  (([RankOrder]>=(1)))
GO
ALTER TABLE [dbo].[Rec_TaskAssignmentRecommendations] CHECK CONSTRAINT [CK_Rec_TaskAssignmentRecommendations_RankOrder]
GO
ALTER TABLE [dbo].[Rec_TaskAssignmentRecommendations]  WITH CHECK ADD  CONSTRAINT [CK_Rec_TaskAssignmentRecommendations_TotalScore] CHECK  (([TotalScore]>=(0)))
GO
ALTER TABLE [dbo].[Rec_TaskAssignmentRecommendations] CHECK CONSTRAINT [CK_Rec_TaskAssignmentRecommendations_TotalScore]
GO
ALTER TABLE [dbo].[Rec_TaskAssignmentRecommendations]  WITH CHECK ADD  CONSTRAINT [CK_Rec_TaskAssignmentRecommendations_UrgencyClass] CHECK  (([UrgencyClass] IS NULL OR ([UrgencyClass]=N'Critical' OR [UrgencyClass]=N'Urgent' OR [UrgencyClass]=N'Normal' OR [UrgencyClass]=N'Low')))
GO
ALTER TABLE [dbo].[Rec_TaskAssignmentRecommendations] CHECK CONSTRAINT [CK_Rec_TaskAssignmentRecommendations_UrgencyClass]
GO
ALTER TABLE [dbo].[Rec_WorkItemAlgorithmProfile]  WITH CHECK ADD  CONSTRAINT [CK_Rec_WorkItemAlgorithmProfile_AlgorithmPriorityOverride] CHECK  (([AlgorithmPriorityOverride] IS NULL OR ([AlgorithmPriorityOverride]=N'Critical' OR [AlgorithmPriorityOverride]=N'High' OR [AlgorithmPriorityOverride]=N'Medium' OR [AlgorithmPriorityOverride]=N'Low')))
GO
ALTER TABLE [dbo].[Rec_WorkItemAlgorithmProfile] CHECK CONSTRAINT [CK_Rec_WorkItemAlgorithmProfile_AlgorithmPriorityOverride]
GO
ALTER TABLE [dbo].[Rec_WorkItemAlgorithmProfile]  WITH CHECK ADD  CONSTRAINT [CK_Rec_WorkItemAlgorithmProfile_RequiredWorkersCount] CHECK  (([RequiredWorkersCount]>=(1)))
GO
ALTER TABLE [dbo].[Rec_WorkItemAlgorithmProfile] CHECK CONSTRAINT [CK_Rec_WorkItemAlgorithmProfile_RequiredWorkersCount]
GO
ALTER TABLE [dbo].[Rec_WorkItemAlgorithmProfile]  WITH CHECK ADD  CONSTRAINT [CK_Rec_WorkItemAlgorithmProfile_UrgencyOverride] CHECK  (([UrgencyOverride] IS NULL OR ([UrgencyOverride]=N'Critical' OR [UrgencyOverride]=N'Urgent' OR [UrgencyOverride]=N'Normal' OR [UrgencyOverride]=N'Low')))
GO
ALTER TABLE [dbo].[Rec_WorkItemAlgorithmProfile] CHECK CONSTRAINT [CK_Rec_WorkItemAlgorithmProfile_UrgencyOverride]
GO
ALTER TABLE [dbo].[Rec_WorkItemRequiredSkills]  WITH CHECK ADD  CONSTRAINT [CK_Rec_WorkItemRequiredSkills_ImportanceLevel] CHECK  (([ImportanceLevel]=N'Preferred' OR [ImportanceLevel]=N'Important' OR [ImportanceLevel]=N'Critical'))
GO
ALTER TABLE [dbo].[Rec_WorkItemRequiredSkills] CHECK CONSTRAINT [CK_Rec_WorkItemRequiredSkills_ImportanceLevel]
GO
ALTER TABLE [dbo].[Rec_WorkItemRequiredSkills]  WITH CHECK ADD  CONSTRAINT [CK_Rec_WorkItemRequiredSkills_RequiredLevel] CHECK  (([RequiredLevel] IS NULL OR [RequiredLevel]>=(1) AND [RequiredLevel]<=(5)))
GO
ALTER TABLE [dbo].[Rec_WorkItemRequiredSkills] CHECK CONSTRAINT [CK_Rec_WorkItemRequiredSkills_RequiredLevel]
GO
/****** Object:  Table [dbo].[Quotes]    Script Date: 04/06/2026 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Quotes](
	[QuoteId] [int] IDENTITY(1,1) NOT NULL,
	[QuoteNumber] [nvarchar](50) NOT NULL,
	[CustomerId] [int] NOT NULL,
	[ProjectId] [int] NULL,
	[QuoteDate] [date] NOT NULL,
	[ValidUntil] [date] NULL,
	[Status] [nvarchar](50) NOT NULL CONSTRAINT [DF_Quotes_Status] DEFAULT (N'Draft'),
	[Notes] [nvarchar](1000) NULL,
	[VatRate] [decimal](5, 2) NOT NULL CONSTRAINT [DF_Quotes_VatRate] DEFAULT ((17.00)),
	[Subtotal] [decimal](18, 2) NOT NULL CONSTRAINT [DF_Quotes_Subtotal] DEFAULT ((0)),
	[VatAmount] [decimal](18, 2) NOT NULL CONSTRAINT [DF_Quotes_VatAmount] DEFAULT ((0)),
	[Total] [decimal](18, 2) NOT NULL CONSTRAINT [DF_Quotes_Total] DEFAULT ((0)),
	[IsActive] [bit] NOT NULL CONSTRAINT [DF_Quotes_IsActive] DEFAULT ((1)),
	[CreatedAt] [datetime2](7) NOT NULL CONSTRAINT [DF_Quotes_CreatedAt] DEFAULT (sysutcdatetime()),
	[CreatedByUserId] [int] NULL,
	[UpdatedAt] [datetime2](7) NULL,
	[UpdatedByUserId] [int] NULL,
	[DeletedAt] [datetime2](7) NULL,
 CONSTRAINT [PK_Quotes] PRIMARY KEY CLUSTERED
(
	[QuoteId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [CK_Quotes_QuoteNumber_NotBlank] CHECK ((len(ltrim(rtrim([QuoteNumber])))>(0))),
 CONSTRAINT [CK_Quotes_Status_Allowed] CHECK (([Status]=N'Draft' OR [Status]=N'Sent' OR [Status]=N'Tracking' OR [Status]=N'Approved' OR [Status]=N'Rejected')),
 CONSTRAINT [CK_Quotes_VatRate_NonNegative] CHECK (([VatRate]>=(0)))
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[QuoteLineItems]    Script Date: 04/06/2026 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[QuoteLineItems](
	[QuoteLineItemId] [int] IDENTITY(1,1) NOT NULL,
	[QuoteId] [int] NOT NULL,
	[Description] [nvarchar](500) NOT NULL,
	[Quantity] [decimal](18, 2) NOT NULL,
	[Unit] [nvarchar](50) NOT NULL,
	[UnitPrice] [decimal](18, 2) NOT NULL,
	[LineTotal] [decimal](18, 2) NOT NULL CONSTRAINT [DF_QuoteLineItems_LineTotal] DEFAULT ((0)),
	[SortOrder] [int] NOT NULL CONSTRAINT [DF_QuoteLineItems_SortOrder] DEFAULT ((1)),
	[CreatedAt] [datetime2](7) NOT NULL CONSTRAINT [DF_QuoteLineItems_CreatedAt] DEFAULT (sysutcdatetime()),
	[UpdatedAt] [datetime2](7) NULL,
 CONSTRAINT [PK_QuoteLineItems] PRIMARY KEY CLUSTERED
(
	[QuoteLineItemId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY],
 CONSTRAINT [CK_QuoteLineItems_Description_NotBlank] CHECK ((len(ltrim(rtrim([Description])))>(0))),
 CONSTRAINT [CK_QuoteLineItems_Unit_NotBlank] CHECK ((len(ltrim(rtrim([Unit])))>(0))),
 CONSTRAINT [CK_QuoteLineItems_Quantity_NonNegative] CHECK (([Quantity]>=(0))),
 CONSTRAINT [CK_QuoteLineItems_UnitPrice_NonNegative] CHECK (([UnitPrice]>=(0)))
) ON [PRIMARY]
GO
ALTER TABLE [dbo].[Quotes]  WITH CHECK ADD  CONSTRAINT [FK_Quotes_Customers] FOREIGN KEY([CustomerId])
REFERENCES [dbo].[Customers] ([CustomerId])
GO
ALTER TABLE [dbo].[Quotes] CHECK CONSTRAINT [FK_Quotes_Customers]
GO
ALTER TABLE [dbo].[Quotes]  WITH CHECK ADD  CONSTRAINT [FK_Quotes_WorkItems] FOREIGN KEY([ProjectId])
REFERENCES [dbo].[WorkItems] ([WorkItemId])
GO
ALTER TABLE [dbo].[Quotes] CHECK CONSTRAINT [FK_Quotes_WorkItems]
GO
ALTER TABLE [dbo].[Quotes]  WITH CHECK ADD  CONSTRAINT [FK_Quotes_CreatedByUser] FOREIGN KEY([CreatedByUserId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[Quotes] CHECK CONSTRAINT [FK_Quotes_CreatedByUser]
GO
ALTER TABLE [dbo].[Quotes]  WITH CHECK ADD  CONSTRAINT [FK_Quotes_UpdatedByUser] FOREIGN KEY([UpdatedByUserId])
REFERENCES [dbo].[Users] ([UserId])
GO
ALTER TABLE [dbo].[Quotes] CHECK CONSTRAINT [FK_Quotes_UpdatedByUser]
GO
ALTER TABLE [dbo].[QuoteLineItems]  WITH CHECK ADD  CONSTRAINT [FK_QuoteLineItems_Quotes] FOREIGN KEY([QuoteId])
REFERENCES [dbo].[Quotes] ([QuoteId])
GO
ALTER TABLE [dbo].[QuoteLineItems] CHECK CONSTRAINT [FK_QuoteLineItems_Quotes]
GO

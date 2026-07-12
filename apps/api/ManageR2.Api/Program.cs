using System.Diagnostics;
using System.Text;
using System.Threading.RateLimiting;
using FluentValidation;
using ManageR2.Api.Authorization;
using ManageR2.Api.Middleware;
using ManageR2.Api.Validation;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.DAL.Providers;
using ManageR2.Infrastructure.Features.Contacts.Repositories;
using ManageR2.Infrastructure.Features.Customers.Repositories;
using ManageR2.Infrastructure.Features.Employees.Repositories;
using ManageR2.Infrastructure.Features.Inventory.Repositories;
using ManageR2.Infrastructure.Features.Reports.Repositories;
using ManageR2.Infrastructure.Features.Settings.Repositories;
using ManageR2.Infrastructure.Features.Sites.Repositories;
using ManageR2.Infrastructure.Features.Quotes.Repositories;
using ManageR2.Infrastructure.Features.Users.Repositories;
using ManageR2.Infrastructure.Features.WorkItems.Repositories;
using ManageR2.Infrastructure.Features.WorkItems.Services;
using ManageR2.Infrastructure.Interfaces;
using ManageR2.Infrastructure.Repositories;
using ManageR2.Infrastructure.Security;
using ManageR2.Infrastructure.Services;
using ManageR2.Api.Features.Reports.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using AdvancedSmartAssignmentService = ManageR2.Infrastructure.Services.SmartAssignment.SmartAssignmentService;
using AdvancedSmartAssignmentRepository = ManageR2.Infrastructure.Repositories.SmartAssignment.SmartAssignmentRepository;
using ManageR2.Infrastructure.Repositories.SmartAssignment;
using ManageR2.Infrastructure.Services.SmartAssignment;
using ManageR2.Infrastructure.Features.Geo.Clients;
using ManageR2.Infrastructure.Features.Geo.Services;
using ManageR2.Infrastructure.Features.AddressProfiles.Repositories;
using ManageR2.Infrastructure.Features.AddressProfiles.Services;




var builder = WebApplication.CreateBuilder(args);

// API composition root: registers controllers, auth, CORS, Swagger, and Infrastructure services for the ManageR2 web API.
// Add services to the container.
// ValidationActionFilter runs registered FluentValidation validators on bound DTOs before each action executes.
builder.Services.AddControllers(options => options.Filters.Add<ValidationActionFilter>());
builder.Services.AddEndpointsApiExplorer();

// Discovers and registers every AbstractValidator<T> defined in this API assembly for the action filter to resolve.
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

// Model-binding failures (e.g. malformed JSON, wrong types) are shaped into the same ProblemDetails contract as
// our validation/business errors, including the flattened "message" the SPA reads for error toasts.
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var traceId = Activity.Current?.Id ?? context.HttpContext.TraceIdentifier;
        var problemDetails = new ValidationProblemDetails(context.ModelState)
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "One or more validation errors occurred.",
            Type = "https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1",
            Instance = context.HttpContext.Request.Path
        };
        problemDetails.Extensions["traceId"] = traceId;
        problemDetails.Extensions["message"] = string.Join(
            " ",
            problemDetails.Errors.SelectMany(error => error.Value));

        return new BadRequestObjectResult(problemDetails)
        {
            ContentTypes = { "application/problem+json" }
        };
    };
});

// Global exception handling: unhandled exceptions are turned into RFC7807 ProblemDetails responses
// (see GlobalExceptionHandler) instead of leaking stack traces or raw messages to clients.
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

// Login rate limiting: throttles repeated login attempts per client IP to slow brute-force attacks.
// Limits are configurable via RateLimiting:Login in appsettings/environment with safe defaults.
var loginPermitLimit = builder.Configuration.GetValue<int?>("RateLimiting:Login:PermitLimit") ?? 10;
var loginWindowSeconds = builder.Configuration.GetValue<int?>("RateLimiting:Login:WindowSeconds") ?? 60;
builder.Services.AddRateLimiter(rateLimiterOptions =>
{
    rateLimiterOptions.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    rateLimiterOptions.AddPolicy("login", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = loginPermitLimit,
                Window = TimeSpan.FromSeconds(loginWindowSeconds),
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst
            }));
});
// OpenAPI document with Bearer JWT scheme so Swagger UI can authorize test calls.
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter a valid JWT Bearer token."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// CORS: always allow local frontend dev servers, plus any production origins configured through
// Cors:AllowedOrigins in appsettings/environment (e.g. Cors__AllowedOrigins__0=https://app.example.com).
var localDevOrigins = new[]
{
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:5173",
    "http://localhost:5173"
};

var configuredCorsOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? Array.Empty<string>();

var allowedCorsOrigins = localDevOrigins
    .Concat(configuredCorsOrigins)
    .Where(origin => !string.IsNullOrWhiteSpace(origin))
    .Select(origin => origin.Trim().TrimEnd('/'))
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            policy
                .WithOrigins(allowedCorsOrigins)
                .AllowAnyHeader()
                .AllowAnyMethod();
        });
});

// JWT signing and validation parameters from configuration (fail fast if misconfigured).
var jwtKey = GetRequiredSecretConfigurationValue(builder.Configuration, "Jwt:Key", "JWT key");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? throw new InvalidOperationException("JWT issuer is missing.");
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? throw new InvalidOperationException("JWT audience is missing.");

// ASP.NET Core JWT bearer authentication validates the Authorization header on each request.
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.Zero
        };
    });

// Role/permission matrix: registers named policies (CanManage*, CanView*/CanEdit*) plus the global
// fallback that requires authentication unless an endpoint carries [AllowAnonymous] (e.g. POST /users/login).
builder.Services.AddManageR2AuthorizationPolicies();

// DI: scoped lifetime ties one DBServices + repositories per HTTP request (safe for SqlConnection usage).
// DI
builder.Services.AddScoped<DBServices>();
// Postgres migration data layer (additive): provider factories, role resolver, drift/observability,
// and exception translators. Defaults keep the SQL Server baseline until DataProvider flags are set.
builder.Services.AddManageR2DataProviders(builder.Configuration);
// WorkItems / work-plan / assignments dual-run (Wave 3): self-referencing hierarchy, milestones and
// multi-result-set schedule. Both provider repositories + router; default flags delegate to SQL Server.
builder.Services.AddScoped<WorkItemRepository>();
builder.Services.AddScoped<PostgresWorkItemRepository>();
builder.Services.AddScoped<IWorkItemRepository, WorkItemRepositoryRouter>();
builder.Services.AddScoped<IWorkItemTaskService, WorkItemTaskService>();
builder.Services.AddScoped<IProjectMilestoneRepository, ProjectMilestoneRepository>();
builder.Services.AddScoped<IWorkReportAttachmentStorageService, WorkReportAttachmentStorageService>();
// Users dual-run (Wave 2, high risk).
builder.Services.AddScoped<UserRepository>();
builder.Services.AddScoped<PostgresUserRepository>();
builder.Services.AddScoped<IUserRepository, UserRepositoryRouter>();
// Customers dual-run (Wave 2): both provider repositories + router, following the CompanySettings pattern.
builder.Services.AddScoped<CustomerRepository>();
builder.Services.AddScoped<PostgresCustomerRepository>();
builder.Services.AddScoped<ICustomerRepository, CustomerRepositoryRouter>();
// Contacts dual-run (Wave 2).
builder.Services.AddScoped<ContactRepository>();
builder.Services.AddScoped<PostgresContactRepository>();
builder.Services.AddScoped<IContactRepository, ContactRepositoryRouter>();
// Sites dual-run (Wave 2).
builder.Services.AddScoped<SiteRepository>();
builder.Services.AddScoped<PostgresSiteRepository>();
builder.Services.AddScoped<ISiteRepository, SiteRepositoryRouter>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IPasswordService, PasswordService>();
builder.Services.AddScoped<IUserAuthorizationService, UserAuthorizationService>();
// WorkReports dual-run (Wave 4): report lifecycle + the transactional inventory finalize/reverse
// orchestration (service-refactor of sp_InventoryStockMovements_ApplyForReport). Both provider
// repositories + router; default flags delegate to SQL Server.
builder.Services.AddScoped<WorkReportRepository>();
builder.Services.AddScoped<PostgresWorkReportRepository>();
builder.Services.AddScoped<IWorkReportRepository, WorkReportRepositoryRouter>();
builder.Services.AddScoped<IProjectLifecycleRepository, ProjectLifecycleRepository>();
builder.Services.AddScoped<IProjectEquipmentRepository, ProjectEquipmentRepository>();
builder.Services.AddScoped<IProjectBoqRepository, ProjectBoqRepository>();
builder.Services.AddScoped<IProjectDrawingRepository, ProjectDrawingRepository>();
// Inventory dual-run (Wave 4): both provider repositories + router; default flags delegate to SQL Server.
builder.Services.AddScoped<InventoryItemRepository>();
builder.Services.AddScoped<PostgresInventoryItemRepository>();
builder.Services.AddScoped<IInventoryItemRepository, InventoryItemRepositoryRouter>();
// Quotes dual-run (Wave 3): transactional header + line replacement + totals recalculation.
builder.Services.AddScoped<QuoteRepository>();
builder.Services.AddScoped<PostgresQuoteRepository>();
builder.Services.AddScoped<IQuoteRepository, QuoteRepositoryRouter>();
// Employees dual-run (Wave 2).
builder.Services.AddScoped<EmployeeRepository>();
builder.Services.AddScoped<PostgresEmployeeRepository>();
builder.Services.AddScoped<IEmployeeRepository, EmployeeRepositoryRouter>();
// CompanySettings is the Wave-1 dual-run reference: both provider repositories are registered as
// concretes and the router (registered as the interface) selects/compares them per DataProvider flags.
// With default flags the router delegates purely to the SQL Server repository.
builder.Services.AddScoped<CompanySettingsRepository>();
builder.Services.AddScoped<PostgresCompanySettingsRepository>();
builder.Services.AddScoped<ICompanySettingsRepository, CompanySettingsRepositoryRouter>();
builder.Services.AddScoped<ICustomerSystemRepository, CustomerSystemRepository>();
// Core audit trail: append-only repository + best-effort logging service used by security/operational endpoints.
builder.Services.AddScoped<IAuditLogRepository, AuditLogRepository>();
builder.Services.AddScoped<IAuditLogService, AuditLogService>();
// Customer Systems Vault encryption. Singleton holds the validated AES-256 key; constructed lazily on
// first vault request, so a missing/invalid key fails only vault operations (with a clear message), not startup.
builder.Services.AddSingleton<ISecretProtector, AesGcmSecretProtector>();
// Dashboard command center: focused read-only repository + orchestration service for GET /api/dashboard.
builder.Services.AddScoped<IDashboardRepository, DashboardRepository>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<ISmartAssignmentService, SmartAssignmentBatchService>();
// SmartAssignment dual-run (Wave 5): both provider repositories + router behind the provider-neutral
// ISmartAssignmentRepository. Default flags delegate reads/writes to SQL Server; Postgres is only used
// for shadow reads / best-effort dual writes when the migration flags are enabled.
builder.Services.AddScoped<AdvancedSmartAssignmentRepository>();
builder.Services.AddScoped<PostgresSmartAssignmentRepository>();
builder.Services.AddScoped<ISmartAssignmentRepository, SmartAssignmentRepositoryRouter>();
builder.Services.AddScoped<IAdvancedSmartAssignmentService, AdvancedSmartAssignmentService>();
builder.Services.AddHttpClient<GeoapifyClient>(client =>
{
    client.BaseAddress = new Uri("https://api.geoapify.com/");
    client.Timeout = TimeSpan.FromSeconds(20);
})
// Geoapify authenticates through a query parameter. Disable the default HttpClient
// URI logger so the server-side key cannot appear in application logs.
.RemoveAllLoggers();
builder.Services.AddScoped<IGeoService, GeoService>();
builder.Services.AddScoped<IEmployeeBaseAddressRepository, EmployeeBaseAddressRepository>();
builder.Services.AddScoped<ISiteAddressProfileRepository, SiteAddressProfileRepository>();
builder.Services.AddScoped<IAddressProfileService, AddressProfileService>();

var httpsRedirectionEnabled =
    builder.Configuration.GetValue<bool?>("HttpsRedirection:Enabled") ?? true;

var app = builder.Build();

// Catch-all: converts unhandled exceptions into ProblemDetails. Registered first so it wraps the whole pipeline.
app.UseExceptionHandler();

// HTTP pipeline order: CORS early, then TLS, then auth middleware, then endpoint routing to controllers.
// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    // Interactive API docs only in Development to avoid exposing metadata in production.
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");

if (httpsRedirectionEnabled)
{
    app.UseHttpsRedirection();
}

// Serves publicly readable static assets from wwwroot (e.g. uploaded product images under /uploads/inventory).
// Registered before authentication so image URLs returned in DTOs load directly in <img> without a bearer token.
app.UseStaticFiles();

// Populates HttpContext.User from JWT; UseAuthorization enforces policies/roles on endpoints.
app.UseAuthentication();
app.UseAuthorization();

// Enforces the per-endpoint rate limiting policies declared with [EnableRateLimiting].
app.UseRateLimiter();

// Discovers controller actions under ManageR2.Api.Controllers and maps routes (e.g. api/[controller]).
app.MapControllers();

app.Run();

static string GetRequiredSecretConfigurationValue(IConfiguration configuration, string key, string displayName)
{
    var value = configuration[key];
    if (string.IsNullOrWhiteSpace(value) || value.StartsWith("__SET_WITH_", StringComparison.Ordinal))
    {
        throw new InvalidOperationException($"{displayName} is missing. Configure {key} with user secrets or environment variables.");
    }

    return value;
}

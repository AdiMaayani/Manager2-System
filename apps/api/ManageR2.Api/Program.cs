using System.Text;
using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Interfaces;
using ManageR2.Infrastructure.Repositories;
using ManageR2.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using AdvancedSmartAssignmentService = ManageR2.Infrastructure.Services.SmartAssignment.SmartAssignmentService;
using AdvancedSmartAssignmentRepository = ManageR2.Infrastructure.Repositories.SmartAssignment.SmartAssignmentRepository;
using ManageR2.Infrastructure.Services.SmartAssignment;




var builder = WebApplication.CreateBuilder(args);

// API composition root: registers controllers, auth, CORS, Swagger, and Infrastructure services for the ManageR2 web API.
// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
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

// CORS: allow the static frontend (Live Server on port 5500) to call this API with credentials/headers.
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            policy
                .WithOrigins("http://127.0.0.1:5500", "http://localhost:5500")
                .AllowAnyHeader()
                .AllowAnyMethod();
        });
});

// JWT signing and validation parameters from configuration (fail fast if misconfigured).
var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT key is missing.");
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

// Supports [Authorize] and role checks on controllers after authentication succeeds.
builder.Services.AddAuthorization();

// DI: scoped lifetime ties one DBServices + repositories per HTTP request (safe for SqlConnection usage).
// DI
builder.Services.AddScoped<DBServices>();
builder.Services.AddScoped<IWorkItemRepository, WorkItemRepository>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<ICustomerRepository, CustomerRepository>();
builder.Services.AddScoped<IContactRepository, ContactRepository>();
builder.Services.AddScoped<ISiteRepository, SiteRepository>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IPasswordService, PasswordService>();
builder.Services.AddScoped<IUserAuthorizationService, UserAuthorizationService>();
builder.Services.AddScoped<IWorkReportRepository, WorkReportRepository>();
builder.Services.AddScoped<IProjectLifecycleRepository, ProjectLifecycleRepository>();
builder.Services.AddScoped<IEmployeeRepository, EmployeeRepository>();
//builder.Services.AddScoped<ISmartAssignmentRepository, SmartAssignmentRepository>();
//builder.Services.AddScoped<ISmartAssignmentService, SmartAssignmentService>();
// Advanced ranked recommendations: concrete repository + service from SmartAssignment module (aliased at top of file).
builder.Services.AddScoped<AdvancedSmartAssignmentRepository>();
builder.Services.AddScoped<IAdvancedSmartAssignmentService, AdvancedSmartAssignmentService>();

var app = builder.Build();

// HTTP pipeline order: CORS early, then TLS, then auth middleware, then endpoint routing to controllers.
// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    // Interactive API docs only in Development to avoid exposing metadata in production.
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");

app.UseHttpsRedirection();

// Populates HttpContext.User from JWT; UseAuthorization enforces policies/roles on endpoints.
app.UseAuthentication();
app.UseAuthorization();

// Discovers controller actions under ManageR2.Api.Controllers and maps routes (e.g. api/[controller]).
app.MapControllers();

app.Run();
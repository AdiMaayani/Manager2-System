using ManageR2.Infrastructure.DAL;
using ManageR2.Infrastructure.Repositories;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ✅ CORS CONFIGURATION
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

// DI
builder.Services.AddScoped<DBServices>();
builder.Services.AddScoped<IWorkItemRepository, WorkItemRepository>();
builder.Services.AddScoped<IUserRepository, UserRepository>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// ✅ USE CORS
app.UseCors("AllowFrontend");

app.UseHttpsRedirection();

app.MapControllers();

app.Run();
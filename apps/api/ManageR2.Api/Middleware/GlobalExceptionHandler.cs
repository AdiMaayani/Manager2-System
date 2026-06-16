using System.Diagnostics;
using FluentValidation;
using ManageR2.Domain.Exceptions;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Middleware;

// Single place that turns exceptions into RFC7807 ProblemDetails responses so the API never leaks stack traces.
// Expected client faults (business-rule and input validation) map to 400; everything else maps to 500.
// Every response also carries a top-level "message" extension because the SPA reads that field for error toasts.
public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;
    private readonly IHostEnvironment _environment;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger, IHostEnvironment environment)
    {
        _logger = logger;
        _environment = environment;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var traceId = Activity.Current?.Id ?? httpContext.TraceIdentifier;

        var problemDetails = exception switch
        {
            ValidationException validationException =>
                BuildValidationProblemDetails(httpContext, validationException, traceId),
            UserValidationException userValidationException =>
                BuildBadRequestProblemDetails(httpContext, userValidationException.Message, traceId),
            _ => BuildServerErrorProblemDetails(httpContext, exception, traceId)
        };

        httpContext.Response.StatusCode = problemDetails.Status ?? StatusCodes.Status500InternalServerError;
        httpContext.Response.ContentType = "application/problem+json";
        // Serialize with the runtime type so ValidationProblemDetails emits its "errors" dictionary
        // (the static switch type is the ProblemDetails base, which would otherwise drop "errors").
        await httpContext.Response.WriteAsJsonAsync(problemDetails, problemDetails.GetType(), cancellationToken);

        return true;
    }

    // FluentValidation failures surfaced by ValidationActionFilter. Exposes the standard RFC7807 "errors"
    // dictionary plus a flattened "message" so existing frontend error handling keeps working unchanged.
    private ValidationProblemDetails BuildValidationProblemDetails(
        HttpContext httpContext,
        ValidationException exception,
        string traceId)
    {
        _logger.LogWarning(
            "Validation failed for {Method} {Path}. TraceId={TraceId}",
            httpContext.Request.Method,
            httpContext.Request.Path,
            traceId);

        var errors = exception.Errors
            .GroupBy(failure => failure.PropertyName)
            .ToDictionary(
                group => group.Key,
                group => group.Select(failure => failure.ErrorMessage).ToArray());

        var problemDetails = new ValidationProblemDetails(errors)
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "One or more validation errors occurred.",
            Type = "https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1",
            Instance = httpContext.Request.Path
        };
        problemDetails.Extensions["traceId"] = traceId;
        problemDetails.Extensions["message"] = string.Join(" ", exception.Errors.Select(failure => failure.ErrorMessage));

        return problemDetails;
    }

    // Business-rule failures thrown from repositories/services (e.g. duplicate email, invalid state transition).
    private ProblemDetails BuildBadRequestProblemDetails(HttpContext httpContext, string message, string traceId)
    {
        _logger.LogWarning(
            "Business validation failed for {Method} {Path}. TraceId={TraceId}. Message={Message}",
            httpContext.Request.Method,
            httpContext.Request.Path,
            traceId,
            message);

        var problemDetails = new ProblemDetails
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "The request could not be completed.",
            Type = "https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1",
            Instance = httpContext.Request.Path,
            Detail = message
        };
        problemDetails.Extensions["traceId"] = traceId;
        problemDetails.Extensions["message"] = message;

        return problemDetails;
    }

    private ProblemDetails BuildServerErrorProblemDetails(HttpContext httpContext, Exception exception, string traceId)
    {
        _logger.LogError(
            exception,
            "Unhandled exception for {Method} {Path}. TraceId={TraceId}",
            httpContext.Request.Method,
            httpContext.Request.Path,
            traceId);

        var problemDetails = new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "An unexpected error occurred.",
            Type = "https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1",
            Instance = httpContext.Request.Path
        };
        problemDetails.Extensions["traceId"] = traceId;

        // Surface the raw message only in non-production environments to aid local debugging.
        var clientMessage = _environment.IsProduction() ? "An unexpected error occurred." : exception.Message;
        if (!_environment.IsProduction())
        {
            problemDetails.Detail = exception.Message;
        }
        problemDetails.Extensions["message"] = clientMessage;

        return problemDetails;
    }
}

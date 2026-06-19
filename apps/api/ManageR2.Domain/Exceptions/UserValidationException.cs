namespace ManageR2.Domain.Exceptions;

// Business-rule failure surfaced from repositories/services; API layer maps this to HTTP 400 with the message body.
public class UserValidationException : Exception
{
    // Single-message constructor for expected validation failures (duplicate email, invalid state, etc.).
    public UserValidationException(string message) : base(message)
    {
    }

    // Wraps lower-level errors while still treated as a client-visible validation fault when caught in controllers.
    public UserValidationException(string message, Exception innerException) : base(message, innerException)
    {
    }
}

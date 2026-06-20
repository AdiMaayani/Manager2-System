namespace ManageR2.Domain.Exceptions;

public class GeoProviderUnavailableException : Exception
{
    public GeoProviderUnavailableException(string message)
        : base(message)
    {
    }

    public GeoProviderUnavailableException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}

namespace ManageR2.Api.Features.Reports.Services;

public sealed class WorkReportAttachmentSaveResult
{
    public string StoredFileName { get; init; } = string.Empty;
    public string RelativeFilePath { get; init; } = string.Empty;
    public string ContentType { get; init; } = string.Empty;
    public string MediaType { get; init; } = string.Empty;
}

public interface IWorkReportAttachmentStorageService
{
    string? ValidateAttachmentFile(IFormFile? file);
    Task<WorkReportAttachmentSaveResult> SaveAttachmentAsync(int workReportId, IFormFile file);
    string? GetSafeFilePath(string relativeFilePath);
    void DeleteFileIfExists(string? relativeFilePath);
}

public sealed class WorkReportAttachmentStorageService : IWorkReportAttachmentStorageService
{
    private const long MaxAttachmentFileSizeBytes = 50 * 1024 * 1024;
    private const string RelativeRoot = "App_Data/work-reports";

    private static readonly Dictionary<string, (string Extension, string MediaType)> AllowedContentTypes =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = (".jpg", "Image"),
            ["image/png"] = (".png", "Image"),
            ["image/webp"] = (".webp", "Image"),
            ["video/mp4"] = (".mp4", "Video"),
            ["video/webm"] = (".webm", "Video")
        };

    private readonly IWebHostEnvironment _environment;

    public WorkReportAttachmentStorageService(IWebHostEnvironment environment)
    {
        _environment = environment;
    }

    public string? ValidateAttachmentFile(IFormFile? file)
    {
        if (file == null || file.Length == 0)
        {
            return "Attachment file is required.";
        }

        if (file.Length > MaxAttachmentFileSizeBytes)
        {
            return "Attachment file is too large. Maximum size is 50 MB.";
        }

        if (string.IsNullOrWhiteSpace(file.ContentType) || !AllowedContentTypes.ContainsKey(file.ContentType))
        {
            return "Attachment must be an image (JPEG, PNG, WebP) or video (MP4, WebM).";
        }

        return null;
    }

    public async Task<WorkReportAttachmentSaveResult> SaveAttachmentAsync(int workReportId, IFormFile file)
    {
        var validationError = ValidateAttachmentFile(file);
        if (validationError != null)
        {
            throw new InvalidOperationException(validationError);
        }

        var (extension, mediaType) = AllowedContentTypes[file.ContentType];
        var storedFileName = $"{Guid.NewGuid():N}{extension}";
        var relativeDirectory = Path.Combine(RelativeRoot, workReportId.ToString());
        var storageRoot = GetStorageRoot();
        var reportDirectory = Path.GetFullPath(Path.Combine(storageRoot, workReportId.ToString()));

        if (!reportDirectory.StartsWith(storageRoot, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Invalid upload path.");
        }

        Directory.CreateDirectory(reportDirectory);

        var fullFilePath = Path.GetFullPath(Path.Combine(reportDirectory, storedFileName));
        if (!fullFilePath.StartsWith(reportDirectory, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Invalid upload path.");
        }

        await using (var stream = System.IO.File.Create(fullFilePath))
        {
            await file.CopyToAsync(stream);
        }

        var relativeFilePath = Path.Combine(relativeDirectory, storedFileName).Replace('\\', '/');
        return new WorkReportAttachmentSaveResult
        {
            StoredFileName = storedFileName,
            RelativeFilePath = relativeFilePath,
            ContentType = file.ContentType,
            MediaType = mediaType
        };
    }

    public string? GetSafeFilePath(string relativeFilePath)
    {
        if (string.IsNullOrWhiteSpace(relativeFilePath))
        {
            return null;
        }

        var normalizedRelativePath = relativeFilePath.Replace('\\', '/').TrimStart('/');
        if (normalizedRelativePath.Contains("..", StringComparison.Ordinal))
        {
            return null;
        }

        var fullFilePath = Path.GetFullPath(Path.Combine(_environment.ContentRootPath, normalizedRelativePath));
        var allowedRoot = Path.GetFullPath(Path.Combine(_environment.ContentRootPath, RelativeRoot));
        return fullFilePath.StartsWith(allowedRoot, StringComparison.OrdinalIgnoreCase) && System.IO.File.Exists(fullFilePath)
            ? fullFilePath
            : null;
    }

    public void DeleteFileIfExists(string? relativeFilePath)
    {
        if (string.IsNullOrWhiteSpace(relativeFilePath))
        {
            return;
        }

        var fullFilePath = GetSafeFilePath(relativeFilePath);
        if (fullFilePath != null && System.IO.File.Exists(fullFilePath))
        {
            System.IO.File.Delete(fullFilePath);
        }
    }

    private string GetStorageRoot()
    {
        var storageRoot = Path.GetFullPath(Path.Combine(_environment.ContentRootPath, RelativeRoot));
        Directory.CreateDirectory(storageRoot);
        return storageRoot;
    }
}

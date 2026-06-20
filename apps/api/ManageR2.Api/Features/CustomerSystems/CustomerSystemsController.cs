using ManageR2.Api.Authorization;
using ManageR2.Api.Features.Audit;
using ManageR2.Api.Features.CustomerSystems.DTOs;
using ManageR2.Domain.Entities;
using ManageR2.Infrastructure.Interfaces;
using ManageR2.Infrastructure.Security;
using ManageR2.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ManageR2.Api.Features.CustomerSystems;

// Customer Systems Vault: secure storage of customer system metadata and encrypted secrets.
// Thin controller — delegates persistence to ICustomerSystemRepository (stored procedures only) and
// encryption to ISecretProtector. Every endpoint is gated by a dedicated vault policy. Plaintext secrets
// are accepted only on create/update bodies and returned only from the explicit, audited reveal endpoint.
[ApiController]
[Route("api/customer-systems")]
public class CustomerSystemsController : ControllerBase
{
    private readonly ICustomerSystemRepository _repository;
    private readonly ISecretProtector _secretProtector;
    // General audit trail. The authoritative, blocking reveal log remains the dedicated
    // CustomerSystemSecretAccessLog (via _repository.LogSecretAccessAsync); this is an additional
    // best-effort mirror for the unified audit screen.
    private readonly IAuditLogService _auditLogService;

    public CustomerSystemsController(
        ICustomerSystemRepository repository,
        ISecretProtector secretProtector,
        IAuditLogService auditLogService)
    {
        _repository = repository;
        _secretProtector = secretProtector;
        _auditLogService = auditLogService;
    }

    // GET /api/customer-systems?customerId=123&includeInactive=false
    [Authorize(Policy = Policies.CanViewCustomerSystems)]
    [HttpGet]
    public async Task<IActionResult> GetList([FromQuery] int customerId, [FromQuery] bool includeInactive = false)
    {
        if (customerId <= 0)
        {
            return BadRequest(new { message = "customerId is required." });
        }

        var systems = await _repository.GetSystemsAsync(customerId, includeInactive);
        return Ok(systems.Select(ToSystemDto));
    }

    [Authorize(Policy = Policies.CanViewCustomerSystems)]
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var system = await _repository.GetSystemByIdAsync(id);
        if (system == null)
        {
            return NotFound(new { message = $"Customer system {id} was not found." });
        }

        return Ok(ToSystemDto(system));
    }

    [Authorize(Policy = Policies.CanManageCustomerSystems)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCustomerSystemRequestDto dto)
    {
        var system = new CustomerSystem
        {
            CustomerId = dto.CustomerId,
            SiteId = dto.SiteId,
            SystemType = dto.SystemType.Trim(),
            SystemName = dto.SystemName.Trim(),
            Vendor = CleanOptional(dto.Vendor),
            Model = CleanOptional(dto.Model),
            Host = CleanOptional(dto.Host),
            Port = dto.Port,
            Url = CleanOptional(dto.Url),
            LocationDescription = CleanOptional(dto.LocationDescription),
            Notes = CleanOptional(dto.Notes),
            IsActive = dto.IsActive
        };

        var id = await _repository.CreateSystemAsync(system);

        await _auditLogService.LogAsync(this.BuildAuditEvent(
            AuditActions.CustomerSystemCreated,
            AuditEntityTypes.CustomerSystem,
            $"Customer system '{system.SystemName}' (#{id}) created for customer #{system.CustomerId}.",
            entityId: id,
            metadata: new Dictionary<string, object?>
            {
                ["customerId"] = system.CustomerId,
                ["systemType"] = system.SystemType,
                ["systemName"] = system.SystemName
            }));

        var created = await _repository.GetSystemByIdAsync(id);
        return CreatedAtAction(nameof(GetById), new { id }, created == null ? null : ToSystemDto(created));
    }

    [Authorize(Policy = Policies.CanManageCustomerSystems)]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateCustomerSystemRequestDto dto)
    {
        var existing = await _repository.GetSystemByIdAsync(id);
        if (existing == null)
        {
            return NotFound(new { message = $"Customer system {id} was not found." });
        }

        existing.SiteId = dto.SiteId;
        existing.SystemType = dto.SystemType.Trim();
        existing.SystemName = dto.SystemName.Trim();
        existing.Vendor = CleanOptional(dto.Vendor);
        existing.Model = CleanOptional(dto.Model);
        existing.Host = CleanOptional(dto.Host);
        existing.Port = dto.Port;
        existing.Url = CleanOptional(dto.Url);
        existing.LocationDescription = CleanOptional(dto.LocationDescription);
        existing.Notes = CleanOptional(dto.Notes);
        existing.IsActive = dto.IsActive;

        var updated = await _repository.UpdateSystemAsync(existing);
        if (!updated)
        {
            return BadRequest(new { message = "Failed to update the customer system." });
        }

        await _auditLogService.LogAsync(this.BuildAuditEvent(
            AuditActions.CustomerSystemUpdated,
            AuditEntityTypes.CustomerSystem,
            $"Customer system '{existing.SystemName}' (#{id}) updated.",
            entityId: id,
            metadata: new Dictionary<string, object?>
            {
                ["systemType"] = existing.SystemType,
                ["systemName"] = existing.SystemName,
                ["isActive"] = existing.IsActive
            }));

        var refreshed = await _repository.GetSystemByIdAsync(id);
        return Ok(refreshed == null ? null : ToSystemDto(refreshed));
    }

    [Authorize(Policy = Policies.CanManageCustomerSystems)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Deactivate(int id)
    {
        var existing = await _repository.GetSystemByIdAsync(id);
        if (existing == null)
        {
            return NotFound(new { message = $"Customer system {id} was not found." });
        }

        await _repository.DeactivateSystemAsync(id);

        await _auditLogService.LogAsync(this.BuildAuditEvent(
            AuditActions.CustomerSystemDeactivated,
            AuditEntityTypes.CustomerSystem,
            $"Customer system '{existing.SystemName}' (#{id}) deactivated.",
            entityId: id,
            severity: AuditSeverity.Warning,
            metadata: new Dictionary<string, object?>
            {
                ["systemName"] = existing.SystemName
            }));

        return NoContent();
    }

    // GET /api/customer-systems/{id}/secrets — masked metadata only, never the encrypted blob or plaintext.
    [Authorize(Policy = Policies.CanViewCustomerSystems)]
    [HttpGet("{id:int}/secrets")]
    public async Task<IActionResult> GetSecrets(int id)
    {
        var system = await _repository.GetSystemByIdAsync(id);
        if (system == null)
        {
            return NotFound(new { message = $"Customer system {id} was not found." });
        }

        var secrets = await _repository.GetSecretsMetadataAsync(id);
        return Ok(secrets.Select(ToSecretMetadataDto));
    }

    [Authorize(Policy = Policies.CanManageCustomerSystems)]
    [HttpPost("{id:int}/secrets")]
    public async Task<IActionResult> CreateSecret(int id, [FromBody] CreateCustomerSystemSecretRequestDto dto)
    {
        var system = await _repository.GetSystemByIdAsync(id);
        if (system == null)
        {
            return NotFound(new { message = $"Customer system {id} was not found." });
        }

        var secret = new CustomerSystemSecret
        {
            CustomerSystemId = id,
            SecretType = dto.SecretType.Trim(),
            Username = CleanOptional(dto.Username),
            EncryptedSecretValue = _secretProtector.Protect(dto.SecretValue),
            MaskedPreview = _secretProtector.CreateMaskedPreview(dto.SecretValue),
            Notes = CleanOptional(dto.Notes),
            IsActive = dto.IsActive
        };

        var secretId = await _repository.CreateSecretAsync(secret);

        await _auditLogService.LogAsync(this.BuildAuditEvent(
            AuditActions.CustomerSystemSecretCreated,
            AuditEntityTypes.CustomerSystemSecret,
            $"Secret (#{secretId}, type '{secret.SecretType}') created for customer system #{id}.",
            entityId: secretId,
            metadata: new Dictionary<string, object?>
            {
                ["customerSystemId"] = id,
                ["secretType"] = secret.SecretType
            }));

        var metadata = await _repository.GetSecretsMetadataAsync(id);
        var created = metadata.FirstOrDefault(s => s.SecretId == secretId);
        return Ok(created == null ? null : ToSecretMetadataDto(created));
    }

    [Authorize(Policy = Policies.CanManageCustomerSystems)]
    [HttpPut("{id:int}/secrets/{secretId:int}")]
    public async Task<IActionResult> UpdateSecret(int id, int secretId, [FromBody] UpdateCustomerSystemSecretRequestDto dto)
    {
        var existing = await _repository.GetSecretForRevealAsync(id, secretId);
        if (existing == null)
        {
            return NotFound(new { message = $"Secret {secretId} was not found for customer system {id}." });
        }

        var replaceSecretValue = !string.IsNullOrEmpty(dto.SecretValue);

        var secret = new CustomerSystemSecret
        {
            SecretId = secretId,
            CustomerSystemId = id,
            SecretType = dto.SecretType.Trim(),
            Username = CleanOptional(dto.Username),
            Notes = CleanOptional(dto.Notes),
            IsActive = dto.IsActive
        };

        if (replaceSecretValue)
        {
            secret.EncryptedSecretValue = _secretProtector.Protect(dto.SecretValue!);
            secret.MaskedPreview = _secretProtector.CreateMaskedPreview(dto.SecretValue!);
        }

        var updated = await _repository.UpdateSecretAsync(secret, replaceSecretValue);
        if (!updated)
        {
            return BadRequest(new { message = "Failed to update the secret." });
        }

        await _auditLogService.LogAsync(this.BuildAuditEvent(
            AuditActions.CustomerSystemSecretUpdated,
            AuditEntityTypes.CustomerSystemSecret,
            $"Secret (#{secretId}, type '{secret.SecretType}') updated for customer system #{id}.",
            entityId: secretId,
            metadata: new Dictionary<string, object?>
            {
                ["customerSystemId"] = id,
                ["secretType"] = secret.SecretType,
                ["secretValueReplaced"] = replaceSecretValue,
                ["isActive"] = secret.IsActive
            }));

        // Re-read metadata so the masked preview reflects the stored state.
        var metadata = await _repository.GetSecretsMetadataAsync(id);
        var refreshed = metadata.FirstOrDefault(s => s.SecretId == secretId);
        return Ok(refreshed == null ? null : ToSecretMetadataDto(refreshed));
    }

    [Authorize(Policy = Policies.CanManageCustomerSystems)]
    [HttpDelete("{id:int}/secrets/{secretId:int}")]
    public async Task<IActionResult> DeactivateSecret(int id, int secretId)
    {
        var existing = await _repository.GetSecretForRevealAsync(id, secretId);
        if (existing == null)
        {
            return NotFound(new { message = $"Secret {secretId} was not found for customer system {id}." });
        }

        await _repository.DeactivateSecretAsync(secretId);

        await _auditLogService.LogAsync(this.BuildAuditEvent(
            AuditActions.CustomerSystemSecretDeactivated,
            AuditEntityTypes.CustomerSystemSecret,
            $"Secret (#{secretId}) deactivated for customer system #{id}.",
            entityId: secretId,
            severity: AuditSeverity.Warning,
            metadata: new Dictionary<string, object?>
            {
                ["customerSystemId"] = id
            }));

        return NoContent();
    }

    // The only endpoint that returns a decrypted secret. Requires CanRevealCustomerSystemSecrets and
    // always writes an access-log entry before returning the value.
    [Authorize(Policy = Policies.CanRevealCustomerSystemSecrets)]
    [HttpPost("{id:int}/secrets/{secretId:int}/reveal")]
    public async Task<IActionResult> RevealSecret(int id, int secretId, [FromBody] RevealSecretRequestDto? dto)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
        {
            return Unauthorized(new { message = "Invalid user token." });
        }

        var secret = await _repository.GetSecretForRevealAsync(id, secretId);
        if (secret == null)
        {
            return NotFound(new { message = $"Secret {secretId} was not found for customer system {id}." });
        }

        if (!secret.IsActive)
        {
            return BadRequest(new { message = "This secret is inactive and cannot be revealed." });
        }

        var plaintext = _secretProtector.Unprotect(secret.EncryptedSecretValue);

        // Audit the reveal before returning the value. Never log the plaintext itself.
        // This dedicated access log is authoritative and intentionally allowed to throw: if we cannot
        // record a reveal, we must not return the secret.
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
        await _repository.LogSecretAccessAsync(
            secretId,
            id,
            currentUserId,
            CleanOptional(dto?.AccessReason),
            "RevealSecret",
            clientIp);

        // Additionally mirror the reveal into the unified audit trail (best-effort; never the plaintext).
        await _auditLogService.LogAsync(this.BuildAuditEvent(
            AuditActions.CustomerSystemSecretRevealed,
            AuditEntityTypes.CustomerSystemSecret,
            $"Secret (#{secretId}, type '{secret.SecretType}') revealed for customer system #{id}.",
            entityId: secretId,
            severity: AuditSeverity.Critical,
            metadata: new Dictionary<string, object?>
            {
                ["customerSystemId"] = id,
                ["secretType"] = secret.SecretType,
                ["hasAccessReason"] = !string.IsNullOrWhiteSpace(dto?.AccessReason)
            },
            userIdOverride: currentUserId));

        return Ok(new RevealSecretResponseDto
        {
            SecretId = secret.SecretId,
            CustomerSystemId = secret.CustomerSystemId,
            SecretType = secret.SecretType,
            Username = secret.Username,
            SecretValue = plaintext,
            RevealedAtUtc = DateTime.UtcNow
        });
    }

    private bool TryGetCurrentUserId(out int userId)
    {
        userId = 0;
        var claim = User.FindFirst("userId")?.Value;
        return !string.IsNullOrWhiteSpace(claim) && int.TryParse(claim, out userId);
    }

    private static string? CleanOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static CustomerSystemResponseDto ToSystemDto(CustomerSystem system)
    {
        return new CustomerSystemResponseDto
        {
            CustomerSystemId = system.CustomerSystemId,
            CustomerId = system.CustomerId,
            SiteId = system.SiteId,
            SiteName = system.SiteName,
            SystemType = system.SystemType,
            SystemName = system.SystemName,
            Vendor = system.Vendor,
            Model = system.Model,
            Host = system.Host,
            Port = system.Port,
            Url = system.Url,
            LocationDescription = system.LocationDescription,
            Notes = system.Notes,
            IsActive = system.IsActive,
            CreatedAtUtc = system.CreatedAtUtc,
            UpdatedAtUtc = system.UpdatedAtUtc
        };
    }

    private static CustomerSystemSecretMetadataDto ToSecretMetadataDto(CustomerSystemSecret secret)
    {
        return new CustomerSystemSecretMetadataDto
        {
            SecretId = secret.SecretId,
            CustomerSystemId = secret.CustomerSystemId,
            SecretType = secret.SecretType,
            Username = secret.Username,
            MaskedPreview = secret.MaskedPreview,
            Notes = secret.Notes,
            IsActive = secret.IsActive,
            CreatedAtUtc = secret.CreatedAtUtc,
            UpdatedAtUtc = secret.UpdatedAtUtc
        };
    }
}

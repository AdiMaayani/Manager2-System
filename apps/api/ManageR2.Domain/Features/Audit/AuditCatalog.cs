namespace ManageR2.Domain.Entities;

// Canonical, stable string constants for audit rows. Centralizing them keeps action/entity/severity
// values consistent across controllers and makes the audit screen's filter options easy to derive.

public static class AuditSeverity
{
    public const string Info = "Info";
    public const string Warning = "Warning";
    public const string Critical = "Critical";
}

public static class AuditEntityTypes
{
    public const string User = "User";
    public const string CustomerSystem = "CustomerSystem";
    public const string CustomerSystemSecret = "CustomerSystemSecret";
    public const string ServiceCall = "ServiceCall";
    public const string WorkItem = "WorkItem";
}

public static class AuditActions
{
    // Security / authentication
    public const string LoginSucceeded = "LoginSucceeded";
    public const string LoginFailed = "LoginFailed";
    public const string AccountLockoutBlocked = "AccountLockoutBlocked";

    // User & role management
    public const string UserCreated = "UserCreated";
    public const string UserUpdated = "UserUpdated";
    public const string UserDeleted = "UserDeleted";
    public const string UserRestored = "UserRestored";

    // Customer Systems Vault
    public const string CustomerSystemCreated = "CustomerSystemCreated";
    public const string CustomerSystemUpdated = "CustomerSystemUpdated";
    public const string CustomerSystemDeactivated = "CustomerSystemDeactivated";
    public const string CustomerSystemSecretCreated = "CustomerSystemSecretCreated";
    public const string CustomerSystemSecretUpdated = "CustomerSystemSecretUpdated";
    public const string CustomerSystemSecretDeactivated = "CustomerSystemSecretDeactivated";
    public const string CustomerSystemSecretRevealed = "CustomerSystemSecretRevealed";

    // Service calls
    public const string ServiceCallCreated = "ServiceCallCreated";
    public const string ServiceCallUpdated = "ServiceCallUpdated";
    public const string ServiceCallAssigned = "ServiceCallAssigned";
    public const string ServiceCallClosed = "ServiceCallClosed";

    // Work items (projects/tasks)
    public const string WorkItemCreated = "WorkItemCreated";
    public const string WorkItemUpdated = "WorkItemUpdated";
    public const string WorkItemAssigned = "WorkItemAssigned";
    public const string WorkItemClosed = "WorkItemClosed";
    public const string WorkItemDeleted = "WorkItemDeleted";
}

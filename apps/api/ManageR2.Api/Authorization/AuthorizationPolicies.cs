using Microsoft.AspNetCore.Authorization;

namespace ManageR2.Api.Authorization;

// Central definition of the ManageR2 role/permission matrix used for server-side authorization.
// Each policy maps to the set of roles allowed to perform that class of action. Admin is included in
// every policy so administrators retain full access. Role names mirror the dbo.Roles catalog and the
// ClaimTypes.Role claims issued by JwtTokenService.
public static class Roles
{
    public const string Admin = "Admin";
    public const string SeniorManagement = "SeniorManagement";
    public const string ProjectManager = "ProjectManager";
    public const string Office = "Office";
    public const string Technician = "Technician";
    public const string Inventory = "Inventory";
}

public static class Policies
{
    // Management (write) policies
    public const string CanManageUsers = "CanManageUsers";
    public const string CanManageSettings = "CanManageSettings";
    public const string CanManageInventory = "CanManageInventory";
    public const string CanManageCustomers = "CanManageCustomers";
    public const string CanManageProjects = "CanManageProjects";
    public const string CanManageWorkPlan = "CanManageWorkPlan";
    public const string CanEditReports = "CanEditReports";
    public const string CanManageQuotes = "CanManageQuotes";
    public const string CanManageServiceCalls = "CanManageServiceCalls";

    // View (read) policies applied to GET/list/detail endpoints
    public const string CanViewUsers = "CanViewUsers";
    public const string CanViewSettings = "CanViewSettings";
    public const string CanViewInventory = "CanViewInventory";
    public const string CanViewCustomers = "CanViewCustomers";
    public const string CanViewProjects = "CanViewProjects";
    public const string CanViewWorkPlan = "CanViewWorkPlan";
    public const string CanViewReports = "CanViewReports";
    public const string CanViewQuotes = "CanViewQuotes";
    public const string CanViewServiceCalls = "CanViewServiceCalls";
    public const string CanViewEmployees = "CanViewEmployees";

    // Minimal employee selection lookup (id + display/scheduling fields only, no contact PII).
    public const string CanLookupEmployees = "CanLookupEmployees";

    // Customer Systems Vault (sensitive customer system access details + encrypted secrets)
    public const string CanViewCustomerSystems = "CanViewCustomerSystems";
    public const string CanManageCustomerSystems = "CanManageCustomerSystems";
    public const string CanRevealCustomerSystemSecrets = "CanRevealCustomerSystemSecrets";

    // Core audit trail (high-value security/operational events). Read-only; no public write endpoint.
    public const string CanViewAuditLog = "CanViewAuditLog";
}

public static class AuthorizationPolicyRegistration
{
    // Registers every ManageR2 policy with the role groups that satisfy it. Keeping the matrix in one
    // place makes the server-side enforcement easy to audit against the documented role expectations.
    public static IServiceCollection AddManageR2AuthorizationPolicies(this IServiceCollection services)
    {
        services.AddAuthorization(options =>
        {
            options.AddPolicy(Policies.CanManageUsers, policy =>
                policy.RequireRole(Roles.Admin));

            options.AddPolicy(Policies.CanManageSettings, policy =>
                policy.RequireRole(Roles.Admin));

            options.AddPolicy(Policies.CanManageInventory, policy =>
                policy.RequireRole(Roles.Admin, Roles.SeniorManagement, Roles.Inventory));

            options.AddPolicy(Policies.CanManageCustomers, policy =>
                policy.RequireRole(Roles.Admin, Roles.SeniorManagement, Roles.Office));

            options.AddPolicy(Policies.CanManageProjects, policy =>
                policy.RequireRole(Roles.Admin, Roles.SeniorManagement, Roles.ProjectManager));

            options.AddPolicy(Policies.CanManageWorkPlan, policy =>
                policy.RequireRole(Roles.Admin, Roles.SeniorManagement, Roles.ProjectManager));

            options.AddPolicy(Policies.CanViewReports, policy =>
                policy.RequireRole(Roles.Admin, Roles.SeniorManagement, Roles.ProjectManager, Roles.Office, Roles.Technician));

            options.AddPolicy(Policies.CanEditReports, policy =>
                policy.RequireRole(Roles.Admin, Roles.SeniorManagement, Roles.ProjectManager, Roles.Office, Roles.Technician));

            options.AddPolicy(Policies.CanManageQuotes, policy =>
                policy.RequireRole(Roles.Admin, Roles.SeniorManagement, Roles.Office));

            // Technician is intentionally excluded from managing service calls: they may view them but
            // cannot create/assign/close/edit (no partial technician service-call workflow in this branch).
            options.AddPolicy(Policies.CanManageServiceCalls, policy =>
                policy.RequireRole(Roles.Admin, Roles.SeniorManagement, Roles.ProjectManager, Roles.Office));

            // View (read) policies. By design each view policy is a superset of its matching management
            // policy, so combining a class-level view policy with a method-level management policy (logical
            // AND) still resolves to exactly the management role set on write endpoints.
            options.AddPolicy(Policies.CanViewUsers, policy =>
                policy.RequireRole(Roles.Admin));

            options.AddPolicy(Policies.CanViewSettings, policy =>
                policy.RequireRole(Roles.Admin));

            options.AddPolicy(Policies.CanViewInventory, policy =>
                policy.RequireRole(Roles.Admin, Roles.SeniorManagement, Roles.Inventory));

            options.AddPolicy(Policies.CanViewCustomers, policy =>
                policy.RequireRole(Roles.Admin, Roles.SeniorManagement, Roles.ProjectManager, Roles.Office));

            options.AddPolicy(Policies.CanViewProjects, policy =>
                policy.RequireRole(Roles.Admin, Roles.SeniorManagement, Roles.ProjectManager));

            options.AddPolicy(Policies.CanViewWorkPlan, policy =>
                policy.RequireRole(Roles.Admin, Roles.SeniorManagement, Roles.ProjectManager, Roles.Office, Roles.Technician));

            options.AddPolicy(Policies.CanViewQuotes, policy =>
                policy.RequireRole(Roles.Admin, Roles.SeniorManagement, Roles.Office));

            options.AddPolicy(Policies.CanViewServiceCalls, policy =>
                policy.RequireRole(Roles.Admin, Roles.SeniorManagement, Roles.ProjectManager, Roles.Office, Roles.Technician));

            options.AddPolicy(Policies.CanViewEmployees, policy =>
                policy.RequireRole(Roles.Admin, Roles.SeniorManagement));

            // Employee selection lookup: every role that has an employee picker (work plan, reports,
            // service-call assignment, project assignment). Inventory has no employee picker and is excluded.
            options.AddPolicy(Policies.CanLookupEmployees, policy =>
                policy.RequireRole(Roles.Admin, Roles.SeniorManagement, Roles.ProjectManager, Roles.Office, Roles.Technician));

            // Customer Systems Vault. View = metadata read; Manage = create/update/deactivate records and
            // secret metadata; Reveal = decrypt a stored secret (separately gated and always audited).
            // Technician and Inventory get no vault access in this branch.
            options.AddPolicy(Policies.CanViewCustomerSystems, policy =>
                policy.RequireRole(Roles.Admin, Roles.SeniorManagement, Roles.ProjectManager, Roles.Office));

            options.AddPolicy(Policies.CanManageCustomerSystems, policy =>
                policy.RequireRole(Roles.Admin, Roles.SeniorManagement, Roles.ProjectManager));

            options.AddPolicy(Policies.CanRevealCustomerSystemSecrets, policy =>
                policy.RequireRole(Roles.Admin, Roles.SeniorManagement, Roles.ProjectManager));

            // Audit trail is sensitive cross-cutting data (who did what, when, from where). Limited to
            // Admin and SeniorManagement; no role can write to it through the API.
            options.AddPolicy(Policies.CanViewAuditLog, policy =>
                policy.RequireRole(Roles.Admin, Roles.SeniorManagement));

            // Preserve the existing global default: every endpoint requires an authenticated user unless [AllowAnonymous].
            options.FallbackPolicy = new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .Build();
        });

        return services;
    }
}

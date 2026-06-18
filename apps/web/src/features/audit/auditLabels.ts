import type { AuditLogEntry } from './types';

/**
 * Centralized Hebrew labels for the audit log. The backend stores stable English
 * codes (see AuditCatalog.cs); these maps localize them for display only. Raw codes
 * are still preserved in the detail drawer's technical section for troubleshooting.
 */

// 21 canonical actions from AuditCatalog.cs (+ UserRestored for the restore flow).
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  LoginSucceeded: 'התחברות הצליחה',
  LoginFailed: 'התחברות נכשלה',
  AccountLockoutBlocked: 'חשבון נחסם',
  UserCreated: 'משתמש נוצר',
  UserUpdated: 'משתמש עודכן',
  UserDeleted: 'משתמש נמחק',
  UserRestored: 'משתמש שוחזר',
  CustomerSystemCreated: 'מערכת לקוח נוצרה',
  CustomerSystemUpdated: 'מערכת לקוח עודכנה',
  CustomerSystemDeactivated: 'מערכת לקוח הוסרה',
  CustomerSystemSecretCreated: 'סוד מערכת נוצר',
  CustomerSystemSecretUpdated: 'סוד מערכת עודכן',
  CustomerSystemSecretDeactivated: 'סוד מערכת הוסר',
  CustomerSystemSecretRevealed: 'סוד מערכת נחשף',
  ServiceCallCreated: 'קריאת שירות נוצרה',
  ServiceCallUpdated: 'קריאת שירות עודכנה',
  ServiceCallAssigned: 'קריאת שירות שויכה',
  ServiceCallClosed: 'קריאת שירות נסגרה',
  WorkItemCreated: 'פריט עבודה נוצר',
  WorkItemUpdated: 'פריט עבודה עודכן',
  WorkItemAssigned: 'פריט עבודה שויך',
  WorkItemClosed: 'פריט עבודה נסגר',
};

// 5 entity types from AuditCatalog.cs.
export const AUDIT_ENTITY_TYPE_LABELS: Record<string, string> = {
  User: 'משתמש',
  CustomerSystem: 'מערכת לקוח',
  CustomerSystemSecret: 'סוד מערכת לקוח',
  ServiceCall: 'קריאת שירות',
  WorkItem: 'פריט עבודה',
};

// camelCase metadata keys emitted by the controllers (sanitized context).
export const AUDIT_METADATA_KEY_LABELS: Record<string, string> = {
  username: 'שם משתמש',
  roles: 'תפקידים',
  departments: 'מחלקות',
  isActive: 'פעיל',
  deactivated: 'הוסר',
  rolesChanged: 'תפקידים שונו',
  previousRoles: 'תפקידים קודמים',
  newRoles: 'תפקידים חדשים',
  passwordChanged: 'סיסמה שונתה',
  attemptedEmail: 'אימייל שהוזן',
  reason: 'סיבה',
  lockoutEndUtc: 'סיום נעילה',
  customerId: 'מזהה לקוח',
  systemType: 'סוג מערכת',
  systemName: 'שם מערכת',
  customerSystemId: 'מזהה מערכת לקוח',
  secretType: 'סוג סוד',
  secretValueReplaced: 'ערך הסוד הוחלף',
  hasAccessReason: 'סיבת גישה סופקה',
  siteId: 'מזהה אתר',
  status: 'סטטוס',
  priority: 'עדיפות',
  employeeId: 'מזהה עובד',
  assignmentRole: 'תפקיד בשיוך',
  workType: 'סוג עבודה',
  parentWorkItemId: 'מזהה פריט אב',
  restoredRoles: 'תפקידים ששוחזרו',
  restoredDepartments: 'מחלקות ששוחזרו',
};

// Login failure reason codes (LoginFailed metadata).
export const AUDIT_LOGIN_REASON_LABELS: Record<string, string> = {
  UnknownEmail: 'אימייל לא ידוע',
  InvalidPassword: 'סיסמה שגויה',
  InactiveUser: 'משתמש לא פעיל',
};

export function localizeAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function localizeAuditEntityType(entityType: string): string {
  return AUDIT_ENTITY_TYPE_LABELS[entityType] ?? entityType;
}

export function localizeAuditMetadataKey(key: string): string {
  return AUDIT_METADATA_KEY_LABELS[key] ?? key;
}

export function localizeAuditLoginReason(reason: string): string {
  return AUDIT_LOGIN_REASON_LABELS[reason] ?? reason;
}

/**
 * Deterministic Hebrew description built from structured fields only (no free-text
 * translation). This — not the English backend `summary` — is the primary user-facing
 * description in the table and detail header.
 */
export function buildAuditDisplaySummary(entry: AuditLogEntry): string {
  const parts: string[] = [localizeAuditAction(entry.action)];

  if (entry.entityType) {
    const entityLabel = localizeAuditEntityType(entry.entityType);
    parts.push(entry.entityId != null ? `${entityLabel} #${entry.entityId}` : entityLabel);
  }

  return parts.join(' · ');
}

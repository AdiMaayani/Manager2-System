import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Drawer, useDrawerMaximize } from '@shared/components/Drawer';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { DetailsField } from '@shared/components/DetailsField';
import { DetailsSection } from '@shared/components/DetailsSection';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { Textarea } from '@shared/components/Textarea';
import { Checkbox } from '@shared/components/Checkbox';
import { InlineAlert } from '@shared/components/InlineAlert';
import { ConfirmInline } from '@shared/components/ConfirmInline';
import { getCurrentUser, getRoleDisplayLabel } from '@api/auth';
import type { Employee } from '@features/employees';
import { useUserMutations } from '../../hooks/useUsers';
import type { CreateUserRequest, UpdateUserRequest, User } from '../../types';
import './UserDrawer.css';

interface UserDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
  employees: Employee[];
  roles: string[];
  departments: string[];
  isLookupLoading: boolean;
  onSaved: (user: User, message: string) => void;
}

interface UserFormState {
  employeeId: string;
  username: string;
  email: string;
  password: string;
  isActive: boolean;
  phone: string;
  notes: string;
  roles: string[];
  departments: string[];
}

function buildInitialState(user: User | null): UserFormState {
  return {
    employeeId: user?.employeeId ? String(user.employeeId) : '',
    username: user?.username ?? '',
    email: user?.email ?? '',
    password: '',
    isActive: user?.isActive ?? true,
    phone: user?.phone ?? '',
    notes: user?.notes ?? '',
    roles: user?.roles ?? [],
    departments: user?.departments ?? [],
  };
}

function toggleSelection(values: string[], selectedValue: string): string[] {
  return values.includes(selectedValue)
    ? values.filter((value) => value !== selectedValue)
    : [...values, selectedValue];
}

function formatUserDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return undefined;
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsedDate);
}

export function UserDrawer({
  isOpen,
  onClose,
  user,
  employees,
  roles,
  departments,
  isLookupLoading,
  onSaved,
}: UserDrawerProps) {
  if (!isOpen) return null;

  // Remount per user so form/edit state always resets when the drawer opens
  // for a different record (or switches from create to a saved record).
  return (
    <UserDrawerContent
      key={user?.userId ?? 'new'}
      user={user ?? null}
      employees={employees}
      roles={roles}
      departments={departments}
      isLookupLoading={isLookupLoading}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

interface UserDrawerContentProps {
  user: User | null;
  employees: Employee[];
  roles: string[];
  departments: string[];
  isLookupLoading: boolean;
  onClose: () => void;
  onSaved: (user: User, message: string) => void;
}

function UserDrawerContent({
  user,
  employees,
  roles,
  departments,
  isLookupLoading,
  onClose,
  onSaved,
}: UserDrawerContentProps) {
  const isExistingUser = user != null;
  // Guard against an admin locking themselves out mid-demo: editing your own user must not let you
  // delete/deactivate yourself or strip your own Admin role (session roles wouldn't refresh until re-login).
  const isSelf = isExistingUser && user.userId === getCurrentUser()?.userId;
  const { createMutation, updateMutation, deleteMutation, restoreMutation } = useUserMutations();

  // Existing users open in read-only review mode; create opens editable.
  // The whole /users route is Admin-only (AdminRoute), so edit is allowed here.
  const [isEditing, setIsEditing] = useState(!isExistingUser);
  const [form, setForm] = useState<UserFormState>(() => buildInitialState(user));
  const [error, setError] = useState<string | null>(null);
  const { isMaximized, toggleMaximize } = useDrawerMaximize(true);

  // Restore is an explicit admin-driven selection (not a blanket reactivation): the admin chooses
  // which roles/departments the restored user gets, with at least one role required.
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreRoles, setRestoreRoles] = useState<string[]>([]);
  const [restoreDepartments, setRestoreDepartments] = useState<string[]>([]);

  function setField<K extends keyof UserFormState>(key: K, value: UserFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleStartEdit() {
    setForm(buildInitialState(user));
    setError(null);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    if (!isExistingUser) {
      onClose();
      return;
    }

    setForm(buildInitialState(user));
    setError(null);
    setIsEditing(false);
  }

  function validate(): string | null {
    if (!form.employeeId) return 'יש לבחור עובד מקושר.';
    if (!form.username.trim()) return 'שם משתמש הוא שדה חובה.';
    if (!form.email.trim()) return 'אימייל הוא שדה חובה.';
    if (!isExistingUser && !form.password.trim()) return 'סיסמה היא שדה חובה למשתמש חדש.';
    if (form.roles.length === 0) return 'יש לבחור לפחות תפקיד אחד.';
    if (form.departments.length === 0) return 'יש לבחור לפחות מחלקה אחת.';
    if (isSelf && !form.isActive) {
      return 'לא ניתן לבטל את פעילות המשתמש שאיתו אתה מחובר.';
    }
    if (isSelf && user.roles.includes('Admin') && !form.roles.includes('Admin')) {
      return 'לא ניתן להסיר לעצמך את תפקיד המנהל.';
    }
    return null;
  }

  function buildRequest(): CreateUserRequest | UpdateUserRequest {
    return {
      employeeId: Number(form.employeeId),
      username: form.username.trim(),
      email: form.email.trim(),
      password: form.password.trim(),
      isActive: form.isActive,
      phone: form.phone.trim() || undefined,
      notes: form.notes.trim() || undefined,
      roles: form.roles,
      departments: form.departments,
    };
  }

  function buildUpdatedUserFallback(existingUser: User): User {
    return {
      ...existingUser,
      employeeId: Number(form.employeeId),
      username: form.username.trim(),
      email: form.email.trim(),
      isActive: form.isActive,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
      roles: form.roles,
      departments: form.departments,
    };
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    try {
      let savedUser: User;
      let message: string;
      if (isExistingUser) {
        const updatedUser = await updateMutation.mutateAsync({
          id: user.userId,
          request: buildRequest(),
        });
        savedUser = updatedUser ?? buildUpdatedUserFallback(user);
        message = 'המשתמש עודכן בהצלחה.';
      } else {
        savedUser = await createMutation.mutateAsync(buildRequest() as CreateUserRequest);
        message = 'המשתמש נוצר בהצלחה.';
      }

      setIsEditing(false);
      onSaved(savedUser, message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירת המשתמש נכשלה');
    }
  }

  async function handleDelete() {
    if (!isExistingUser) return;
    if (isSelf) {
      setError('לא ניתן למחוק את המשתמש שאיתו אתה מחובר.');
      return;
    }
    setError(null);

    try {
      await deleteMutation.mutateAsync(user.userId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'מחיקת המשתמש נכשלה');
    }
  }

  function handleStartRestore() {
    setRestoreRoles([]);
    setRestoreDepartments([]);
    setError(null);
    setIsRestoring(true);
  }

  function handleCancelRestore() {
    setError(null);
    setIsRestoring(false);
  }

  async function handleRestore() {
    if (!isExistingUser) return;
    if (restoreRoles.length === 0) {
      setError('יש לבחור לפחות תפקיד אחד לשחזור המשתמש.');
      return;
    }
    setError(null);

    try {
      const restoredUser = await restoreMutation.mutateAsync({
        id: user.userId,
        request: { roles: restoreRoles, departments: restoreDepartments },
      });
      onSaved(
        restoredUser ?? {
          ...user,
          isActive: true,
          roles: restoreRoles,
          departments: restoreDepartments,
        },
        'המשתמש שוחזר בהצלחה.',
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שחזור המשתמש נכשל');
    }
  }

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    restoreMutation.isPending;

  const linkedEmployee = isExistingUser
    ? employees.find((employee) => employee.employeeId === user.employeeId) ?? null
    : null;

  const title = !isExistingUser
    ? 'משתמש חדש'
    : isRestoring
      ? `שחזור משתמש — ${user.username}`
      : isEditing
        ? `עריכת משתמש — ${user.username}`
        : `פרטי משתמש — ${user.username}`;

  // Edit mode keeps only save/cancel; delete + restore live in the read-only footer.
  const editFooter = (
    <div className="userDrawer__footerContent">
      {error && <InlineAlert variant="danger">{error}</InlineAlert>}
      <div className="userDrawer__actions">
        <Button onClick={handleSave} isLoading={isSaving} disabled={isLookupLoading}>
          שמור
        </Button>
        <Button variant="secondary" onClick={handleCancelEdit} disabled={isSaving}>
          בטל שינויים
        </Button>
      </div>
    </div>
  );

  const restoreFooter = (
    <div className="userDrawer__footerContent">
      {error && <InlineAlert variant="danger">{error}</InlineAlert>}
      <div className="userDrawer__actions">
        <Button onClick={handleRestore} isLoading={isSaving} disabled={isLookupLoading}>
          שחזר משתמש
        </Button>
        <Button variant="secondary" onClick={handleCancelRestore} disabled={isSaving}>
          ביטול
        </Button>
      </div>
    </div>
  );

  const reviewFooter =
    isExistingUser ? (
      <div className="userDrawer__footerContent">
        {error && <InlineAlert variant="danger">{error}</InlineAlert>}
        <div className="userDrawer__dangerActions">
          {user.isActive ? (
            !isSelf && (
              <ConfirmInline
                triggerLabel="בטל פעילות"
                message="לבטל את פעילות המשתמש? הגישה תבוטל."
                confirmLabel="אישור"
                onConfirm={handleDelete}
                isPending={isSaving}
              />
            )
          ) : (
            <Button type="button" variant="primary" onClick={handleStartRestore}>
              שחזור
            </Button>
          )}
        </div>
      </div>
    ) : undefined;

  const footer = isEditing ? editFooter : isRestoring ? restoreFooter : reviewFooter;

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={title}
      isMaximized={isMaximized}
      onToggleMaximize={toggleMaximize}
      headerActions={
        isExistingUser && !isEditing && !isRestoring ? (
          <Button type="button" variant="secondary" onClick={handleStartEdit}>
            ערוך פרטים
          </Button>
        ) : undefined
      }
      footer={footer}
    >
      {isRestoring && isExistingUser ? (
        <UserRestoreForm
          roles={roles}
          departments={departments}
          isLookupLoading={isLookupLoading}
          selectedRoles={restoreRoles}
          selectedDepartments={restoreDepartments}
          onToggleRole={(role) => setRestoreRoles((current) => toggleSelection(current, role))}
          onToggleDepartment={(department) =>
            setRestoreDepartments((current) => toggleSelection(current, department))
          }
        />
      ) : !isEditing && isExistingUser ? (
        <UserReviewDetails user={user} linkedEmployee={linkedEmployee} />
      ) : (
        <div className="userDrawer userDrawer--edit">
          {isLookupLoading && (
            <p className="userDrawer__hint">טוען רשימות תפקידים, מחלקות ועובדים...</p>
          )}

          <DetailsSection title="פרטים כלליים">
            <Select
              label="עובד מקושר"
              required
              value={form.employeeId}
              onChange={(event) => setField('employeeId', event.target.value)}
              disabled={isLookupLoading}
            >
              <option value="">-- בחר עובד --</option>
              {employees.map((employee) => (
                <option key={employee.employeeId} value={employee.employeeId}>
                  {employee.fullName} ({employee.employeeId})
                </option>
              ))}
            </Select>

            <div className="userDrawer__grid">
              <Input
                label="שם משתמש"
                value={form.username}
                onChange={(event) => setField('username', event.target.value)}
                required
              />

              <Input
                label="אימייל"
                type="email"
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
                required
              />
            </div>

            <Checkbox
              label="משתמש פעיל"
              checked={form.isActive}
              onChange={(event) => setField('isActive', event.target.checked)}
            />
          </DetailsSection>

          <DetailsSection title="הרשאות">
            <div className="userDrawer__selectionGrid">
              <fieldset className="userDrawer__fieldset">
                <legend>תפקידים *</legend>
                {roles.length === 0 ? (
                  <p className="userDrawer__hint">לא נמצאו תפקידים זמינים.</p>
                ) : (
                  roles.map((role) => (
                    <Checkbox
                      key={role}
                      label={`${getRoleDisplayLabel(role)}${role === 'Admin' ? ' (Admin)' : ''}`}
                      checked={form.roles.includes(role)}
                      onChange={() => setField('roles', toggleSelection(form.roles, role))}
                    />
                  ))
                )}
              </fieldset>

              <fieldset className="userDrawer__fieldset">
                <legend>מחלקות *</legend>
                {departments.length === 0 ? (
                  <p className="userDrawer__hint">לא נמצאו מחלקות זמינות.</p>
                ) : (
                  departments.map((department) => (
                    <Checkbox
                      key={department}
                      label={department}
                      checked={form.departments.includes(department)}
                      onChange={() =>
                        setField('departments', toggleSelection(form.departments, department))
                      }
                    />
                  ))
                )}
              </fieldset>
            </div>
          </DetailsSection>

          <DetailsSection title="סיסמה">
            <div className="userDrawer__grid">
              <Input
                label={isExistingUser ? 'סיסמה חדשה' : 'סיסמה'}
                type="password"
                value={form.password}
                onChange={(event) => setField('password', event.target.value)}
                required={!isExistingUser}
              />
            </div>
            {isExistingUser && (
              <p className="userDrawer__hint">השאר ריק כדי לשמור על הסיסמה הנוכחית.</p>
            )}
          </DetailsSection>

          <DetailsSection title="מידע נוסף">
            <div className="userDrawer__grid">
              <Input
                label="טלפון"
                type="tel"
                value={form.phone}
                onChange={(event) => setField('phone', event.target.value)}
              />
            </div>

            <Textarea
              label="הערות"
              rows={3}
              value={form.notes}
              onChange={(event) => setField('notes', event.target.value)}
            />
          </DetailsSection>
        </div>
      )}
    </Drawer>
  );
}

interface UserRestoreFormProps {
  roles: string[];
  departments: string[];
  isLookupLoading: boolean;
  selectedRoles: string[];
  selectedDepartments: string[];
  onToggleRole: (role: string) => void;
  onToggleDepartment: (department: string) => void;
}

// Small admin-driven restore form: the admin explicitly chooses which roles (>=1) and departments the
// restored user should have. It does not reactivate historical assignments automatically.
function UserRestoreForm({
  roles,
  departments,
  isLookupLoading,
  selectedRoles,
  selectedDepartments,
  onToggleRole,
  onToggleDepartment,
}: UserRestoreFormProps) {
  return (
    <div className="userDrawer userDrawer--edit">
      <p className="userDrawer__hint">
        בחר אילו תפקידים ומחלקות יוקצו למשתמש המשוחזר. נדרש לפחות תפקיד אחד. הקצאות קודמות שלא ייבחרו לא
        ישוחזרו.
      </p>

      {isLookupLoading && (
        <p className="userDrawer__hint">טוען רשימות תפקידים ומחלקות...</p>
      )}

      <DetailsSection title="הרשאות לשחזור">
        <div className="userDrawer__selectionGrid">
          <fieldset className="userDrawer__fieldset">
            <legend>תפקידים *</legend>
            {roles.length === 0 ? (
              <p className="userDrawer__hint">לא נמצאו תפקידים זמינים.</p>
            ) : (
              roles.map((role) => (
                <Checkbox
                  key={role}
                  label={`${getRoleDisplayLabel(role)}${role === 'Admin' ? ' (Admin)' : ''}`}
                  checked={selectedRoles.includes(role)}
                  onChange={() => onToggleRole(role)}
                />
              ))
            )}
          </fieldset>

          <fieldset className="userDrawer__fieldset">
            <legend>מחלקות</legend>
            {departments.length === 0 ? (
              <p className="userDrawer__hint">לא נמצאו מחלקות זמינות.</p>
            ) : (
              departments.map((department) => (
                <Checkbox
                  key={department}
                  label={department}
                  checked={selectedDepartments.includes(department)}
                  onChange={() => onToggleDepartment(department)}
                />
              ))
            )}
          </fieldset>
        </div>
      </DetailsSection>
    </div>
  );
}

interface UserReviewDetailsProps {
  user: User;
  /** Resolved from the employees lookup already loaded by the Users page. */
  linkedEmployee: Employee | null;
}

function UserReviewDetails({ user, linkedEmployee }: UserReviewDetailsProps) {
  return (
    <div className="userDrawer userDrawer--review">
      <DetailsSection title="פרטי משתמש">
        <div className="userDrawer__detailsGrid">
          <DetailsField label="שם משתמש" value={user.username} />
          <DetailsField label="אימייל" value={user.email} />
          <DetailsField label="טלפון" value={user.phone} />
          <DetailsField
            label="סטטוס"
            value={
              <Badge variant={user.isActive ? 'success' : 'neutral'}>
                {user.isActive ? 'פעיל' : 'לא פעיל'}
              </Badge>
            }
          />
        </div>
      </DetailsSection>

      <DetailsSection title="עובד מקושר">
        {linkedEmployee ? (
          <div className="userDrawer__detailsGrid">
            <DetailsField
              label="שם מלא"
              value={
                <Link
                  className="userDrawer__inlineLink"
                  to={`/employees?employeeId=${linkedEmployee.employeeId}`}
                >
                  {linkedEmployee.fullName}
                </Link>
              }
            />
            <DetailsField label="תפקיד ראשי" value={linkedEmployee.primaryRole} />
            <DetailsField label="טלפון" value={linkedEmployee.phone} />
            <DetailsField label="אימייל" value={linkedEmployee.email} />
            <DetailsField
              label="סטטוס עובד"
              value={
                <Badge variant={linkedEmployee.isActive ? 'success' : 'neutral'}>
                  {linkedEmployee.isActive ? 'פעיל' : 'לא פעיל'}
                </Badge>
              }
            />
          </div>
        ) : (
          <p className="userDrawer__hint">
            לא נמצא עובד מקושר ברשימת העובדים (עובד #{user.employeeId}).
          </p>
        )}
      </DetailsSection>

      <DetailsSection title="הרשאות ותפקידים">
        <div className="userDrawer__detailsGrid">
          <DetailsField
            label="תפקידים"
            value={
              user.roles.length > 0 ? (
                <span className="userDrawer__badges">
                  {user.roles.map((role) => (
                    <Badge key={role} variant={role === 'Admin' ? 'primary' : 'neutral'}>
                      {getRoleDisplayLabel(role)}
                    </Badge>
                  ))}
                </span>
              ) : undefined
            }
          />
          <DetailsField
            label="מחלקות"
            value={
              user.departments.length > 0 ? (
                <span className="userDrawer__badges">
                  {user.departments.map((department) => (
                    <Badge key={department} variant="neutral">
                      {department}
                    </Badge>
                  ))}
                </span>
              ) : undefined
            }
          />
        </div>
      </DetailsSection>

      <DetailsSection title="מערכת">
        <div className="userDrawer__detailsGrid">
          <DetailsField label="נוצר בתאריך" value={formatUserDate(user.createdAt)} />
          <DetailsField label="כניסה אחרונה" value={formatUserDate(user.lastLoginAt)} />
        </div>
      </DetailsSection>

      <DetailsSection title="הערות">
        <DetailsField label="הערות" value={user.notes} />
      </DetailsSection>
    </div>
  );
}

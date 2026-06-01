import { useState } from 'react';
import { Drawer } from '@shared/components/Drawer';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
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

function buildInitialState(user: User | null | undefined): UserFormState {
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

function getRoleDisplayLabel(role: string): string {
  const labels: Record<string, string> = {
    Admin: 'מנהל',
    DepartmentManager: 'מנהל מחלקה',
    TeamLeader: 'ראש צוות',
  };

  return labels[role] ?? role;
}

function toggleSelection(values: string[], selectedValue: string): string[] {
  return values.includes(selectedValue)
    ? values.filter((value) => value !== selectedValue)
    : [...values, selectedValue];
}

export function UserDrawer({
  isOpen,
  onClose,
  user,
  employees,
  roles,
  departments,
  isLookupLoading,
}: UserDrawerProps) {
  const isEditMode = user != null;
  const { createMutation, updateMutation, deleteMutation } = useUserMutations();
  const [form, setForm] = useState<UserFormState>(() => buildInitialState(user));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function setField<K extends keyof UserFormState>(key: K, value: UserFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    if (!form.employeeId) return 'יש לבחור עובד מקושר.';
    if (!form.username.trim()) return 'שם משתמש הוא שדה חובה.';
    if (!form.email.trim()) return 'אימייל הוא שדה חובה.';
    if (!isEditMode && !form.password.trim()) return 'סיסמה היא שדה חובה למשתמש חדש.';
    if (form.roles.length === 0) return 'יש לבחור לפחות תפקיד אחד.';
    if (form.departments.length === 0) return 'יש לבחור לפחות מחלקה אחת.';
    return null;
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    const request: CreateUserRequest | UpdateUserRequest = {
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

    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({ id: user.userId, request });
      } else {
        await createMutation.mutateAsync(request as CreateUserRequest);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירת המשתמש נכשלה');
    }
  }

  async function handleDelete() {
    if (!isEditMode) return;
    setError(null);

    try {
      await deleteMutation.mutateAsync(user.userId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'מחיקת המשתמש נכשלה');
    }
  }

  const isSaving =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? `עריכת משתמש — ${user.username}` : 'משתמש חדש'}
    >
      <div className="userDrawer">
        {isLookupLoading && (
          <p className="userDrawer__hint">טוען רשימות תפקידים, מחלקות ועובדים...</p>
        )}

        <div className="userDrawer__grid">
          <div className="userDrawer__field">
            <label className="userDrawer__label">עובד מקושר *</label>
            <select
              className="userDrawer__select"
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
            </select>
          </div>

          <Input
            label="שם משתמש *"
            value={form.username}
            onChange={(event) => setField('username', event.target.value)}
            required
          />

          <Input
            label="אימייל *"
            type="email"
            value={form.email}
            onChange={(event) => setField('email', event.target.value)}
            required
          />

          <Input
            label={isEditMode ? 'סיסמה חדשה (אופציונלי)' : 'סיסמה *'}
            type="password"
            value={form.password}
            onChange={(event) => setField('password', event.target.value)}
            required={!isEditMode}
          />

          <Input
            label="טלפון"
            type="tel"
            value={form.phone}
            onChange={(event) => setField('phone', event.target.value)}
          />

          <label className="userDrawer__checkboxRow">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setField('isActive', event.target.checked)}
            />
            <span>משתמש פעיל</span>
          </label>
        </div>

        <div className="userDrawer__selectionGrid">
          <fieldset className="userDrawer__fieldset">
            <legend>תפקידים *</legend>
            {roles.length === 0 ? (
              <p className="userDrawer__hint">לא נמצאו תפקידים זמינים.</p>
            ) : (
              roles.map((role) => (
                <label key={role} className="userDrawer__checkboxRow">
                  <input
                    type="checkbox"
                    checked={form.roles.includes(role)}
                    onChange={() => setField('roles', toggleSelection(form.roles, role))}
                  />
                  <span>
                    {getRoleDisplayLabel(role)}
                    {role === 'Admin' ? ' (Admin)' : ''}
                  </span>
                </label>
              ))
            )}
          </fieldset>

          <fieldset className="userDrawer__fieldset">
            <legend>מחלקות *</legend>
            {departments.length === 0 ? (
              <p className="userDrawer__hint">לא נמצאו מחלקות זמינות.</p>
            ) : (
              departments.map((department) => (
                <label key={department} className="userDrawer__checkboxRow">
                  <input
                    type="checkbox"
                    checked={form.departments.includes(department)}
                    onChange={() =>
                      setField('departments', toggleSelection(form.departments, department))
                    }
                  />
                  <span>{department}</span>
                </label>
              ))
            )}
          </fieldset>
        </div>

        <div className="userDrawer__field">
          <label className="userDrawer__label">הערות</label>
          <textarea
            className="userDrawer__textarea"
            rows={3}
            value={form.notes}
            onChange={(event) => setField('notes', event.target.value)}
          />
        </div>

        {isEditMode && (
          <p className="userDrawer__hint">
            מחיקה היא מחיקה פיזית לפי ה-API הקיים. אם המשתמש מקושר לרשומות אחרות,
            השרת יחזיר שגיאה ולא ימחק אותו.
          </p>
        )}

        {error && <p className="userDrawer__error">{error}</p>}

        <div className="userDrawer__actions">
          <Button onClick={handleSave} disabled={isSaving || isLookupLoading}>
            {isSaving ? 'שומר...' : 'שמור'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            ביטול
          </Button>

          {isEditMode && (
            <>
              {confirmDelete ? (
                <>
                  <span className="userDrawer__confirmText">למחוק את המשתמש לצמיתות?</span>
                  <Button variant="danger" onClick={handleDelete} disabled={isSaving}>
                    אישור מחיקה
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmDelete(false)}
                    disabled={isSaving}
                  >
                    חזור
                  </Button>
                </>
              ) : (
                <Button
                  variant="danger"
                  onClick={() => setConfirmDelete(true)}
                  disabled={isSaving}
                >
                  מחיקה
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}

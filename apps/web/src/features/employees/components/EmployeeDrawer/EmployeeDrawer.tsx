import { useState } from 'react';
import { Drawer } from '@shared/components/Drawer';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { useEmployeeMutations } from '../../hooks/useEmployees';
import type { Employee, UpsertEmployeeRequest } from '../../types';
import './EmployeeDrawer.css';

interface EmployeeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employee?: Employee | null;
  onSaved: (message: string) => void;
}

interface EmployeeFormState {
  fullName: string;
  primaryRole: string;
  phone: string;
  email: string;
  dailyCapacityHours: string;
  isAssignable: boolean;
  isActive: boolean;
}

function buildInitialState(employee: Employee | null | undefined): EmployeeFormState {
  return {
    fullName: employee?.fullName ?? '',
    primaryRole: employee?.primaryRole ?? '',
    phone: employee?.phone ?? '',
    email: employee?.email ?? '',
    dailyCapacityHours:
      employee?.dailyCapacityHours != null ? String(employee.dailyCapacityHours) : '',
    isAssignable: employee?.isAssignable ?? true,
    isActive: employee?.isActive ?? true,
  };
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function trimOptionalValue(value: string): string | undefined {
  const trimmedValue = value.trim();
  return trimmedValue || undefined;
}

export function EmployeeDrawer({ isOpen, onClose, employee, onSaved }: EmployeeDrawerProps) {
  const isEditMode = employee != null;
  const { createMutation, updateMutation, activeStatusMutation } = useEmployeeMutations();
  const [form, setForm] = useState<EmployeeFormState>(() => buildInitialState(employee));
  const [error, setError] = useState<string | null>(null);
  const [confirmStatusChange, setConfirmStatusChange] = useState(false);

  function setField<K extends keyof EmployeeFormState>(key: K, value: EmployeeFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate(): string | null {
    if (!form.fullName.trim()) return 'שם עובד הוא שדה חובה.';
    if (!form.primaryRole.trim()) return 'תפקיד ראשי הוא שדה חובה.';
    if (form.email.trim() && !isValidEmail(form.email)) return 'כתובת האימייל אינה תקינה.';

    if (form.dailyCapacityHours.trim()) {
      const parsedCapacity = Number(form.dailyCapacityHours);
      if (Number.isNaN(parsedCapacity) || parsedCapacity <= 0 || parsedCapacity > 24) {
        return 'קיבולת יומית חייבת להיות מספר גדול מ-0 ועד 24.';
      }
    }

    return null;
  }

  function buildRequest(): UpsertEmployeeRequest {
    return {
      fullName: form.fullName.trim(),
      primaryRole: form.primaryRole.trim(),
      phone: trimOptionalValue(form.phone),
      email: trimOptionalValue(form.email),
      dailyCapacityHours: form.dailyCapacityHours.trim()
        ? Number(Number(form.dailyCapacityHours).toFixed(2))
        : null,
      isAssignable: form.isAssignable,
      isActive: form.isActive,
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
      if (isEditMode) {
        await updateMutation.mutateAsync({ id: employee.employeeId, request: buildRequest() });
        onSaved('העובד עודכן בהצלחה.');
      } else {
        await createMutation.mutateAsync(buildRequest());
        onSaved('העובד נוצר בהצלחה.');
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירת העובד נכשלה');
    }
  }

  async function handleStatusChange() {
    if (!isEditMode) return;

    setError(null);
    try {
      await activeStatusMutation.mutateAsync({
        id: employee.employeeId,
        isActive: !employee.isActive,
      });
      onSaved(employee.isActive ? 'העובד הושבת בהצלחה.' : 'העובד הופעל מחדש בהצלחה.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'עדכון סטטוס העובד נכשל');
    }
  }

  const isSaving =
    createMutation.isPending || updateMutation.isPending || activeStatusMutation.isPending;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? `עריכת עובד — ${employee.fullName}` : 'עובד חדש'}
    >
      <div className="employeeDrawer">
        <div className="employeeDrawer__grid">
          <Input
            label="שם מלא *"
            value={form.fullName}
            onChange={(event) => setField('fullName', event.target.value)}
            required
          />

          <Input
            label="תפקיד ראשי *"
            value={form.primaryRole}
            onChange={(event) => setField('primaryRole', event.target.value)}
            required
          />

          <Input
            label="טלפון"
            type="tel"
            value={form.phone}
            onChange={(event) => setField('phone', event.target.value)}
          />

          <Input
            label="אימייל"
            type="email"
            value={form.email}
            onChange={(event) => setField('email', event.target.value)}
          />

          <Input
            label="קיבולת יומית בשעות"
            type="number"
            min="0"
            max="24"
            step="0.25"
            value={form.dailyCapacityHours}
            onChange={(event) => setField('dailyCapacityHours', event.target.value)}
          />
        </div>

        <div className="employeeDrawer__toggles">
          <label className="employeeDrawer__checkboxRow">
            <input
              type="checkbox"
              checked={form.isAssignable}
              onChange={(event) => setField('isAssignable', event.target.checked)}
            />
            <span>ניתן לשיבוץ</span>
          </label>

          <label className="employeeDrawer__checkboxRow">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setField('isActive', event.target.checked)}
            />
            <span>עובד פעיל</span>
          </label>
        </div>

        {error && <p className="employeeDrawer__error">{error}</p>}

        <div className="employeeDrawer__actions">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'שומר...' : 'שמור'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            ביטול
          </Button>

          {isEditMode && (
            <>
              {confirmStatusChange ? (
                <>
                  <span className="employeeDrawer__confirmText">
                    {employee.isActive ? 'להשבית את העובד?' : 'להפעיל את העובד מחדש?'}
                  </span>
                  <Button
                    variant={employee.isActive ? 'danger' : 'primary'}
                    onClick={handleStatusChange}
                    disabled={isSaving}
                  >
                    אישור
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmStatusChange(false)}
                    disabled={isSaving}
                  >
                    חזור
                  </Button>
                </>
              ) : (
                <Button
                  variant={employee.isActive ? 'danger' : 'primary'}
                  onClick={() => setConfirmStatusChange(true)}
                  disabled={isSaving}
                >
                  {employee.isActive ? 'השבת עובד' : 'הפעל עובד'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}

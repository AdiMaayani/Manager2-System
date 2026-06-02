import { useMemo, useState } from 'react';
import { Drawer } from '@shared/components/Drawer';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { useServiceCallMutations } from '../../hooks/useServiceCalls';
import type {
  ServiceCallCustomerOption,
  ServiceCallDetails,
  ServiceCallEmployeeOption,
  ServiceCallSiteOption,
  UpsertServiceCallRequest,
} from '../../types';
import './ServiceCallDrawer.css';

const STATUS_OPTIONS = [
  { value: 'Open', label: 'פתוחה' },
  { value: 'InProgress', label: 'בטיפול' },
  { value: 'Done', label: 'בוצעה' },
  { value: 'Cancelled', label: 'בוטלה' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'ללא עדיפות' },
  { value: 'Low', label: 'נמוכה' },
  { value: 'Medium', label: 'רגילה' },
  { value: 'High', label: 'גבוהה' },
  { value: 'Urgent', label: 'דחופה' },
];

const BILLING_TYPE_OPTIONS = [
  { value: 'Hourly', label: 'שעתי' },
  { value: 'Fixed', label: 'קבוע' },
  { value: 'Warranty', label: 'אחריות' },
];

interface ServiceCallDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  serviceCall?: ServiceCallDetails | null;
  customers: ServiceCallCustomerOption[];
  sites: ServiceCallSiteOption[];
  employees: ServiceCallEmployeeOption[];
  onSaved: (message: string) => void;
}

interface ServiceCallFormState {
  title: string;
  description: string;
  status: string;
  billingType: string;
  customerId: string;
  siteId: string;
  priority: string;
  plannedStart: string;
  plannedEnd: string;
  estimatedHours: string;
  actualStart: string;
  actualEnd: string;
  actualHours: string;
  requiredRole: string;
  isLocked: boolean;
}

function toDateTimeInputValue(value?: string | null): string {
  if (!value) return '';
  return value.slice(0, 16);
}

function buildInitialState(serviceCall: ServiceCallDetails | null | undefined): ServiceCallFormState {
  return {
    title: serviceCall?.title ?? '',
    description: serviceCall?.description ?? '',
    status: serviceCall?.status ?? 'Open',
    billingType: serviceCall?.billingType ?? 'Hourly',
    customerId: serviceCall?.customerId ? String(serviceCall.customerId) : '',
    siteId: serviceCall?.siteId ? String(serviceCall.siteId) : '',
    priority: serviceCall?.priority ?? '',
    plannedStart: toDateTimeInputValue(serviceCall?.plannedStart),
    plannedEnd: toDateTimeInputValue(serviceCall?.plannedEnd),
    estimatedHours: serviceCall?.estimatedHours != null ? String(serviceCall.estimatedHours) : '',
    actualStart: toDateTimeInputValue(serviceCall?.actualStart),
    actualEnd: toDateTimeInputValue(serviceCall?.actualEnd),
    actualHours: serviceCall?.actualHours != null ? String(serviceCall.actualHours) : '',
    requiredRole: serviceCall?.requiredRole ?? '',
    isLocked: serviceCall?.isLocked ?? false,
  };
}

function nullableString(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue || null;
}

function nullableNumber(value: string): number | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;
  const parsedValue = Number(trimmedValue);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? Number(parsedValue.toFixed(2)) : null;
}

export function ServiceCallDrawer({
  isOpen,
  onClose,
  serviceCall,
  customers,
  sites,
  employees,
  onSaved,
}: ServiceCallDrawerProps) {
  const isEditMode = serviceCall != null;
  const { createMutation, updateMutation, closeMutation, assignEmployeeMutation } =
    useServiceCallMutations();
  const [form, setForm] = useState<ServiceCallFormState>(() => buildInitialState(serviceCall));
  const [error, setError] = useState<string | null>(null);
  const [employeeIdToAssign, setEmployeeIdToAssign] = useState('');
  const [assignmentRole, setAssignmentRole] = useState(serviceCall?.requiredRole ?? '');
  const [isCloseConfirmVisible, setIsCloseConfirmVisible] = useState(false);

  const activeCustomers = useMemo(
    () => customers.filter((customer) => customer.isActive !== false),
    [customers],
  );

  const filteredSites = useMemo(() => {
    const selectedCustomerId = Number(form.customerId);
    if (!selectedCustomerId) return [];
    return sites.filter((site) => site.customerId === selectedCustomerId);
  }, [form.customerId, sites]);

  const assignableEmployees = useMemo(
    () => employees.filter((employee) => employee.isActive !== false && employee.isAssignable !== false),
    [employees],
  );

  function setField<K extends keyof ServiceCallFormState>(key: K, value: ServiceCallFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate(): string | null {
    if (!form.title.trim()) return 'כותרת קריאת שירות היא שדה חובה.';
    if (!form.status.trim()) return 'סטטוס הוא שדה חובה.';
    if (!form.billingType.trim()) return 'סוג חיוב הוא שדה חובה.';
    if (!Number(form.customerId)) return 'יש לבחור לקוח.';
    if (!Number(form.siteId)) return 'יש לבחור אתר.';

    if (form.estimatedHours.trim() && nullableNumber(form.estimatedHours) == null) {
      return 'שעות מתוכננות חייבות להיות מספר תקין.';
    }

    if (form.actualHours.trim() && nullableNumber(form.actualHours) == null) {
      return 'שעות בפועל חייבות להיות מספר תקין.';
    }

    return null;
  }

  function buildRequest(): UpsertServiceCallRequest {
    return {
      title: form.title.trim(),
      description: nullableString(form.description),
      status: form.status,
      billingType: form.billingType,
      customerId: Number(form.customerId),
      siteId: Number(form.siteId),
      priority: nullableString(form.priority),
      plannedStart: nullableString(form.plannedStart),
      plannedEnd: nullableString(form.plannedEnd),
      estimatedHours: nullableNumber(form.estimatedHours),
      actualStart: nullableString(form.actualStart),
      actualEnd: nullableString(form.actualEnd),
      actualHours: nullableNumber(form.actualHours),
      requiredRole: nullableString(form.requiredRole),
      isLocked: form.isLocked,
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
        await updateMutation.mutateAsync({ id: serviceCall.workItemId, request: buildRequest() });
        onSaved('קריאת השירות עודכנה בהצלחה.');
      } else {
        await createMutation.mutateAsync(buildRequest());
        onSaved('קריאת השירות נוצרה בהצלחה.');
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירת קריאת השירות נכשלה');
    }
  }

  async function handleCloseServiceCall() {
    if (!isEditMode) return;

    setError(null);
    try {
      await closeMutation.mutateAsync(serviceCall.workItemId);
      onSaved('קריאת השירות נסגרה בהצלחה.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'סגירת קריאת השירות נכשלה');
    }
  }

  async function handleAssignEmployee() {
    if (!isEditMode) return;

    const employeeId = Number(employeeIdToAssign);
    if (!employeeId || !assignmentRole.trim()) {
      setError('יש לבחור עובד ולהזין תפקיד לשיבוץ.');
      return;
    }

    setError(null);
    try {
      await assignEmployeeMutation.mutateAsync({
        id: serviceCall.workItemId,
        request: { employeeId, assignmentRole: assignmentRole.trim() },
      });
      setEmployeeIdToAssign('');
      onSaved('העובד שויך לקריאת השירות בהצלחה.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שיוך העובד נכשל');
    }
  }

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    closeMutation.isPending ||
    assignEmployeeMutation.isPending;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? `עריכת קריאת שירות — ${serviceCall.title}` : 'קריאת שירות חדשה'}
    >
      <div className="serviceCallDrawer">
        <div className="serviceCallDrawer__grid">
          <Input
            label="כותרת *"
            value={form.title}
            onChange={(event) => setField('title', event.target.value)}
            required
          />

          <label className="serviceCallDrawer__field">
            <span>סטטוס *</span>
            <select
              className="serviceCallDrawer__select"
              value={form.status}
              onChange={(event) => setField('status', event.target.value)}
              required
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="serviceCallDrawer__field">
            <span>לקוח *</span>
            <select
              className="serviceCallDrawer__select"
              value={form.customerId}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  customerId: event.target.value,
                  siteId: '',
                }));
              }}
              required
            >
              <option value="">בחר לקוח</option>
              {activeCustomers.map((customer) => (
                <option key={customer.customerId} value={customer.customerId}>
                  {customer.customerName}
                </option>
              ))}
            </select>
          </label>

          <label className="serviceCallDrawer__field">
            <span>אתר *</span>
            <select
              className="serviceCallDrawer__select"
              value={form.siteId}
              onChange={(event) => setField('siteId', event.target.value)}
              required
              disabled={!form.customerId}
            >
              <option value="">בחר אתר</option>
              {filteredSites.map((site) => (
                <option key={site.siteId} value={site.siteId}>
                  {site.siteName}
                  {site.city ? ` — ${site.city}` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="serviceCallDrawer__field">
            <span>סוג חיוב *</span>
            <select
              className="serviceCallDrawer__select"
              value={form.billingType}
              onChange={(event) => setField('billingType', event.target.value)}
              required
            >
              {BILLING_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="serviceCallDrawer__field">
            <span>עדיפות</span>
            <select
              className="serviceCallDrawer__select"
              value={form.priority}
              onChange={(event) => setField('priority', event.target.value)}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <Input
            label="התחלה מתוכננת"
            type="datetime-local"
            value={form.plannedStart}
            onChange={(event) => setField('plannedStart', event.target.value)}
          />

          <Input
            label="סיום מתוכנן"
            type="datetime-local"
            value={form.plannedEnd}
            onChange={(event) => setField('plannedEnd', event.target.value)}
          />

          <Input
            label="שעות מתוכננות"
            type="number"
            min="0"
            step="0.25"
            value={form.estimatedHours}
            onChange={(event) => setField('estimatedHours', event.target.value)}
          />

          <Input
            label="תפקיד נדרש"
            value={form.requiredRole}
            onChange={(event) => setField('requiredRole', event.target.value)}
          />

          <Input
            label="התחלה בפועל"
            type="datetime-local"
            value={form.actualStart}
            onChange={(event) => setField('actualStart', event.target.value)}
          />

          <Input
            label="סיום בפועל"
            type="datetime-local"
            value={form.actualEnd}
            onChange={(event) => setField('actualEnd', event.target.value)}
          />

          <Input
            label="שעות בפועל"
            type="number"
            min="0"
            step="0.25"
            value={form.actualHours}
            onChange={(event) => setField('actualHours', event.target.value)}
          />
        </div>

        <label className="serviceCallDrawer__field serviceCallDrawer__field--wide">
          <span>תיאור</span>
          <textarea
            className="serviceCallDrawer__textarea"
            value={form.description}
            onChange={(event) => setField('description', event.target.value)}
            rows={4}
          />
        </label>

        <label className="serviceCallDrawer__checkboxRow">
          <input
            type="checkbox"
            checked={form.isLocked}
            onChange={(event) => setField('isLocked', event.target.checked)}
          />
          <span>נעול לעריכה תפעולית</span>
        </label>

        {isEditMode && (
          <section className="serviceCallDrawer__assignment">
            <h3>שיוך עובד</h3>
            <div className="serviceCallDrawer__assignmentGrid">
              <label className="serviceCallDrawer__field">
                <span>עובד</span>
                <select
                  className="serviceCallDrawer__select"
                  value={employeeIdToAssign}
                  onChange={(event) => setEmployeeIdToAssign(event.target.value)}
                >
                  <option value="">בחר עובד</option>
                  {assignableEmployees.map((employee) => (
                    <option key={employee.employeeId} value={employee.employeeId}>
                      {employee.fullName}
                      {employee.primaryRole ? ` — ${employee.primaryRole}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <Input
                label="תפקיד בשיוך"
                value={assignmentRole}
                onChange={(event) => setAssignmentRole(event.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleAssignEmployee}
              disabled={isSaving}
            >
              שייך עובד
            </Button>
          </section>
        )}

        {error && <p className="serviceCallDrawer__error">{error}</p>}

        <div className="serviceCallDrawer__actions">
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'שומר...' : 'שמור'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            ביטול
          </Button>

          {isEditMode && !serviceCall.closedAt && (
            <>
              {isCloseConfirmVisible ? (
                <>
                  <span className="serviceCallDrawer__confirmText">לסגור את קריאת השירות?</span>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={handleCloseServiceCall}
                    disabled={isSaving}
                  >
                    אישור סגירה
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsCloseConfirmVisible(false)}
                    disabled={isSaving}
                  >
                    ביטול סגירה
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setIsCloseConfirmVisible(true)}
                  disabled={isSaving}
                >
                  סגור קריאה
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}

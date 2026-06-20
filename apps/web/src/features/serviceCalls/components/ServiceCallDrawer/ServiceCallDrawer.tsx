import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ValidatedAddressDisplay,
  getSiteAddressProfileOptionalAsync,
} from '@features/geo';
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
import { StatusBadge } from '@shared/components/StatusBadge';
import { PageSpinner } from '@shared/components/PageSpinner';
import { usePermissions } from '@shared/auth/usePermissions';
import { getServiceCallByIdAsync } from '../../api/serviceCallsApiClient';
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
  onSaved: (message: string, savedServiceCall?: ServiceCallDetails) => void;
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

function getBillingTypeLabel(billingType?: string | null): string | undefined {
  if (!billingType) return undefined;
  return BILLING_TYPE_OPTIONS.find((option) => option.value === billingType)?.label ?? billingType;
}

function formatDateTime(value?: string | null): string | undefined {
  if (!value) return undefined;
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return undefined;
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsedDate);
}

function formatHours(value?: number | null): string | undefined {
  return value != null ? `${value} שעות` : undefined;
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
  if (!isOpen) return null;

  // Remount per service call so form/edit state always resets when the drawer
  // opens for a different record (or switches from create to a saved record).
  return (
    <ServiceCallDrawerContent
      key={serviceCall?.workItemId ?? 'new'}
      serviceCall={serviceCall ?? null}
      customers={customers}
      sites={sites}
      employees={employees}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

interface ServiceCallDrawerContentProps {
  serviceCall: ServiceCallDetails | null;
  customers: ServiceCallCustomerOption[];
  sites: ServiceCallSiteOption[];
  employees: ServiceCallEmployeeOption[];
  onClose: () => void;
  onSaved: (message: string, savedServiceCall?: ServiceCallDetails) => void;
}

function ServiceCallDrawerContent({
  serviceCall,
  customers,
  sites,
  employees,
  onClose,
  onSaved,
}: ServiceCallDrawerContentProps) {
  const isExistingServiceCall = serviceCall != null;
  const serviceCallDetailsQuery = useQuery({
    queryKey: ['serviceCalls', 'detail', serviceCall?.workItemId],
    queryFn: () => getServiceCallByIdAsync(serviceCall!.workItemId),
    enabled: isExistingServiceCall,
  });
  const currentServiceCall = serviceCallDetailsQuery.data ?? serviceCall;
  const { can } = usePermissions();
  // Technicians have viewServiceCalls but not manageServiceCalls — they may review a call but must
  // not reach edit/close/assign actions (the edit form, which holds those, stays hidden for them).
  const canManage = can('manageServiceCalls');
  const { createMutation, updateMutation, closeMutation, assignEmployeeMutation } =
    useServiceCallMutations();

  // Existing service calls open in read-only review mode; create opens editable.
  const [isEditing, setIsEditing] = useState(!isExistingServiceCall);
  const [form, setForm] = useState<ServiceCallFormState>(() => buildInitialState(currentServiceCall));
  const [error, setError] = useState<string | null>(null);
  const { isMaximized, toggleMaximize } = useDrawerMaximize(true);
  const [employeeIdToAssign, setEmployeeIdToAssign] = useState('');
  const [assignmentRole, setAssignmentRole] = useState(currentServiceCall?.requiredRole ?? '');

  // Keep the form mirrored to the freshest server data while reviewing, without
  // clobbering in-progress edits when the detail query resolves mid-edit.
  useEffect(() => {
    if (isEditing) return;
    setForm(buildInitialState(currentServiceCall));
    setAssignmentRole(currentServiceCall?.requiredRole ?? '');
  }, [currentServiceCall, isEditing]);

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

  function handleStartEdit() {
    setForm(buildInitialState(currentServiceCall));
    setAssignmentRole(currentServiceCall?.requiredRole ?? '');
    setEmployeeIdToAssign('');
    setError(null);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    if (!isExistingServiceCall) {
      onClose();
      return;
    }

    setForm(buildInitialState(currentServiceCall));
    setAssignmentRole(currentServiceCall?.requiredRole ?? '');
    setEmployeeIdToAssign('');
    setError(null);
    setIsEditing(false);
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

  // The update API returns only a message, so review mode shows the request
  // values merged into the known record until the detail query refreshes.
  function buildUpdatedServiceCallFallback(existing: ServiceCallDetails): ServiceCallDetails {
    const request = buildRequest();
    const selectedCustomer = customers.find(
      (customer) => customer.customerId === request.customerId,
    );
    const selectedSite = sites.find((site) => site.siteId === request.siteId);

    return {
      ...existing,
      ...request,
      customerName: selectedCustomer?.customerName ?? existing.customerName,
      siteName: selectedSite?.siteName ?? existing.siteName,
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
      if (isExistingServiceCall) {
        await updateMutation.mutateAsync({
          id: currentServiceCall!.workItemId,
          request: buildRequest(),
        });
        setIsEditing(false);
        onSaved(
          'קריאת השירות עודכנה בהצלחה.',
          buildUpdatedServiceCallFallback(currentServiceCall!),
        );
      } else {
        // The create API returns only the new id, so the drawer closes instead
        // of inventing a review view from unsaved values.
        await createMutation.mutateAsync(buildRequest());
        onSaved('קריאת השירות נוצרה בהצלחה.');
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירת קריאת השירות נכשלה');
    }
  }

  async function handleCloseServiceCall() {
    if (!isExistingServiceCall || !currentServiceCall) return;

    setError(null);
    try {
      await closeMutation.mutateAsync(currentServiceCall.workItemId);
      onSaved('קריאת השירות נסגרה בהצלחה.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'סגירת קריאת השירות נכשלה');
    }
  }

  async function handleAssignEmployee() {
    if (!isExistingServiceCall || !currentServiceCall) return;

    const employeeId = Number(employeeIdToAssign);
    if (!employeeId || !assignmentRole.trim()) {
      setError('יש לבחור עובד ולהזין תפקיד לשיבוץ.');
      return;
    }

    setError(null);
    try {
      await assignEmployeeMutation.mutateAsync({
        id: currentServiceCall.workItemId,
        request: { employeeId, assignmentRole: assignmentRole.trim() },
      });
      setEmployeeIdToAssign('');
      await serviceCallDetailsQuery.refetch();
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

  const title = !isExistingServiceCall
    ? 'קריאת שירות חדשה'
    : isEditing
      ? `עריכת קריאת שירות — ${currentServiceCall?.title ?? ''}`
      : `פרטי קריאת שירות — ${currentServiceCall?.title ?? ''}`;

  // Edit mode keeps only save/cancel; closing the call lives in the read-only footer.
  const editFooter = (
    <div className="serviceCallDrawer__footerContent">
      {error && <InlineAlert variant="danger">{error}</InlineAlert>}
      <div className="serviceCallDrawer__actions">
        <Button type="button" onClick={handleSave} isLoading={isSaving}>
          שמור
        </Button>
        <Button type="button" variant="secondary" onClick={handleCancelEdit} disabled={isSaving}>
          בטל שינויים
        </Button>
      </div>
    </div>
  );

  const reviewFooter =
    isExistingServiceCall && canManage && !currentServiceCall?.closedAt ? (
      <div className="serviceCallDrawer__footerContent">
        {error && <InlineAlert variant="danger">{error}</InlineAlert>}
        <div className="serviceCallDrawer__dangerActions">
          <ConfirmInline
            triggerLabel="סגירת קריאה"
            message="לסגור את הקריאה?"
            confirmLabel="אישור סגירה"
            onConfirm={handleCloseServiceCall}
            isPending={isSaving}
          />
        </div>
      </div>
    ) : undefined;

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={title}
      isMaximized={isMaximized}
      onToggleMaximize={toggleMaximize}
      headerActions={
        isExistingServiceCall && !isEditing && canManage ? (
          <Button type="button" variant="secondary" onClick={handleStartEdit}>
            ערוך פרטים
          </Button>
        ) : undefined
      }
      footer={isEditing ? editFooter : reviewFooter}
    >
      {serviceCallDetailsQuery.isLoading && <PageSpinner />}
      {serviceCallDetailsQuery.error != null && (
        <InlineAlert variant="warning">
          טעינת פרטי הקריאה נכשלה. מוצגים נתוני הרשימה האחרונים.
        </InlineAlert>
      )}

      {!isEditing && isExistingServiceCall && currentServiceCall ? (
        <ServiceCallReviewDetails
          serviceCall={currentServiceCall}
          customers={customers}
          sites={sites}
        />
      ) : (
        <div className="serviceCallDrawer serviceCallDrawer--edit">
          <DetailsSection title="פרטים כלליים">
            <Input
              label="כותרת"
              value={form.title}
              onChange={(event) => setField('title', event.target.value)}
              required
            />

            <div className="serviceCallDrawer__grid">
              <Select
                label="סטטוס"
                required
                value={form.status}
                onChange={(event) => setField('status', event.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <Select
                label="עדיפות"
                value={form.priority}
                onChange={(event) => setField('priority', event.target.value)}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <Select
                label="סוג חיוב"
                required
                value={form.billingType}
                onChange={(event) => setField('billingType', event.target.value)}
              >
                {BILLING_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <Checkbox
              label="נעול לעריכה תפעולית"
              checked={form.isLocked}
              onChange={(event) => setField('isLocked', event.target.checked)}
            />
          </DetailsSection>

          <DetailsSection title="לקוח ואתר">
            <div className="serviceCallDrawer__grid">
              <Select
                label="לקוח"
                required
                value={form.customerId}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    customerId: event.target.value,
                    siteId: '',
                  }));
                }}
              >
                <option value="">בחר לקוח</option>
                {activeCustomers.map((customer) => (
                  <option key={customer.customerId} value={customer.customerId}>
                    {customer.customerName}
                  </option>
                ))}
              </Select>

              <Select
                label="אתר"
                required
                value={form.siteId}
                onChange={(event) => setField('siteId', event.target.value)}
                disabled={!form.customerId}
              >
                <option value="">בחר אתר</option>
                {filteredSites.map((site) => (
                  <option key={site.siteId} value={site.siteId}>
                    {site.siteName}
                    {site.city ? ` — ${site.city}` : ''}
                  </option>
                ))}
              </Select>
            </div>
          </DetailsSection>

          <DetailsSection title="תזמון ושעות">
            <div className="serviceCallDrawer__grid">
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
                label="שעות מתוכננות"
                type="number"
                min="0"
                step="0.25"
                value={form.estimatedHours}
                onChange={(event) => setField('estimatedHours', event.target.value)}
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
          </DetailsSection>

          <DetailsSection title="שיבוץ ותפקיד">
            <div className="serviceCallDrawer__grid">
              <Input
                label="תפקיד נדרש"
                value={form.requiredRole}
                onChange={(event) => setField('requiredRole', event.target.value)}
              />
            </div>

            {isExistingServiceCall && (
              <div className="serviceCallDrawer__assignAction">
                <p className="serviceCallDrawer__hint">
                  שיוך עובד מתבצע מיידית ואינו תלוי בלחיצה על שמירה.
                </p>
                <div className="serviceCallDrawer__grid">
                  <Select
                    label="עובד"
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
                  </Select>

                  <Input
                    label="תפקיד בשיוך"
                    value={assignmentRole}
                    onChange={(event) => setAssignmentRole(event.target.value)}
                  />
                </div>
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAssignEmployee}
                    disabled={isSaving}
                  >
                    שייך עובד
                  </Button>
                </div>
              </div>
            )}
          </DetailsSection>

          <DetailsSection title="תיאור">
            <Textarea
              label="תיאור"
              value={form.description}
              onChange={(event) => setField('description', event.target.value)}
              rows={4}
            />
          </DetailsSection>
        </div>
      )}
    </Drawer>
  );
}

interface ServiceCallReviewDetailsProps {
  serviceCall: ServiceCallDetails;
  customers: ServiceCallCustomerOption[];
  sites: ServiceCallSiteOption[];
}

function ServiceCallReviewDetails({ serviceCall, customers, sites }: ServiceCallReviewDetailsProps) {
  // The list/detail payload may omit display names, so they fall back to the
  // lookup lists already loaded by the page.
  const customerName =
    serviceCall.customerName ??
    customers.find((customer) => customer.customerId === serviceCall.customerId)?.customerName;
  const site = sites.find((siteOption) => siteOption.siteId === serviceCall.siteId);
  const siteName = serviceCall.siteName ?? site?.siteName;

  const siteProfileQuery = useQuery({
    queryKey: ['sites', serviceCall.siteId, 'address-profile'],
    queryFn: () => getSiteAddressProfileOptionalAsync(serviceCall.siteId),
    retry: false,
  });

  return (
    <div className="serviceCallDrawer serviceCallDrawer--review">
      <DetailsSection title="פרטי קריאה">
        <div className="serviceCallDrawer__detailsGrid">
          <DetailsField label="מספר" value={`SC-${serviceCall.workItemId}`} />
          <DetailsField label="כותרת" value={serviceCall.title} />
          <DetailsField
            label="סטטוס"
            value={<StatusBadge domain="serviceCall" status={serviceCall.status} />}
          />
          <DetailsField
            label="עדיפות"
            value={
              serviceCall.priority ? (
                <StatusBadge domain="serviceCallPriority" status={serviceCall.priority} />
              ) : undefined
            }
          />
          <DetailsField label="סוג חיוב" value={getBillingTypeLabel(serviceCall.billingType)} />
          <DetailsField
            label="נעילה תפעולית"
            value={
              <Badge variant={serviceCall.isLocked ? 'warning' : 'neutral'}>
                {serviceCall.isLocked ? 'נעולה' : 'לא נעולה'}
              </Badge>
            }
          />
        </div>
      </DetailsSection>

      <DetailsSection title="לקוח ואתר">
        <div className="serviceCallDrawer__detailsGrid">
          <DetailsField
            label="לקוח"
            value={
              serviceCall.customerId ? (
                <Link
                  className="serviceCallDrawer__inlineLink"
                  to={`/customers?customerId=${serviceCall.customerId}`}
                >
                  {customerName ?? `לקוח #${serviceCall.customerId}`}
                </Link>
              ) : (
                customerName
              )
            }
          />
          <DetailsField label="אתר" value={siteName} />
          <ValidatedAddressDisplay
            formattedAddress={siteProfileQuery.data?.formattedAddress ?? site?.city ?? undefined}
            validationStatus={siteProfileQuery.data?.validationStatus}
          />
        </div>
      </DetailsSection>

      <DetailsSection title="תזמון ושיבוץ">
        <div className="serviceCallDrawer__detailsGrid">
          <DetailsField label="התחלה מתוכננת" value={formatDateTime(serviceCall.plannedStart)} />
          <DetailsField label="סיום מתוכנן" value={formatDateTime(serviceCall.plannedEnd)} />
          <DetailsField label="התחלה בפועל" value={formatDateTime(serviceCall.actualStart)} />
          <DetailsField label="סיום בפועל" value={formatDateTime(serviceCall.actualEnd)} />
          <DetailsField label="שעות מתוכננות" value={formatHours(serviceCall.estimatedHours)} />
          <DetailsField label="שעות בפועל" value={formatHours(serviceCall.actualHours)} />
          <DetailsField label="תפקיד נדרש" value={serviceCall.requiredRole} />
        </div>
      </DetailsSection>

      <DetailsSection title="תיאור">
        {serviceCall.description?.trim() ? (
          <p className="serviceCallDrawer__multilineValue">{serviceCall.description}</p>
        ) : (
          <p className="serviceCallDrawer__hint">לא הוזן תיאור לקריאה זו.</p>
        )}
      </DetailsSection>

      <DetailsSection title="היסטוריה">
        <div className="serviceCallDrawer__detailsGrid">
          <DetailsField label="נוצרה בתאריך" value={formatDateTime(serviceCall.createdAt)} />
          <DetailsField label="נסגרה בתאריך" value={formatDateTime(serviceCall.closedAt)} />
        </div>
      </DetailsSection>
    </div>
  );
}

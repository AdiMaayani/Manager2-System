import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CustomerDrawer,
  getCustomerByIdAsync,
  resolveCanonicalCustomerQueryId,
  resolveCustomerDrawerIntentAfterCustomerChange,
  shouldFetchCanonicalCustomerDetail,
  type NestedCustomerDrawerIntent,
} from '@features/customers';
import {
  ValidatedAddressDisplay,
  getSiteAddressProfileOptionalAsync,
} from '@features/geo';
import { Drawer, useDrawerMaximize } from '@shared/components/Drawer';
import { Button } from '@shared/components/Button';
import { DetailsField } from '@shared/components/DetailsField';
import { DetailsSection } from '@shared/components/DetailsSection';
import { Input } from '@shared/components/Input';
import { ListSelect } from '@shared/components/ListSelect';
import { Select } from '@shared/components/Select';
import { Textarea } from '@shared/components/Textarea';
import { InlineAlert } from '@shared/components/InlineAlert';
import { ConfirmInline } from '@shared/components/ConfirmInline';
import { StatusBadge } from '@shared/components/StatusBadge';
import { PageSpinner } from '@shared/components/PageSpinner';
import { usePermissions } from '@shared/auth/usePermissions';
import { getServiceCallByIdAsync } from '../../api/serviceCallsApiClient';
import { useServiceCallMutations } from '../../hooks/useServiceCalls';
import { useEmployeePrimaryRoles } from '@features/employees/hooks/useEmployeePrimaryRoles';
import {
  addRequiredProfession,
  isRequiredProfessionSelected,
  legacyRequiredRole,
  removeRequiredProfession,
} from '@features/workplan/lib/requiredProfessions';
import { resolveServiceCallCustomerAccessId } from '../../lib/serviceCallCustomerAccess';
import {
  filterServiceCallSitesByCustomer,
  resolveCompatibleServiceCallSiteId,
  resolveServiceCallHistoricalSiteOption,
} from '../../lib/serviceCallSiteSelection';
import { resolveDefaultAssignmentRole } from '../../lib/serviceCallAssignmentRole';
import { formatServiceCallDateTimeForDisplay } from '../../lib/serviceCallDateTime';
import {
  buildServiceCallFormState,
  type ServiceCallFormState,
} from '../../lib/serviceCallFormState';
import {
  canCancelServiceCall,
  canReopenServiceCall,
  isServiceCallCancelled,
  SERVICE_CALL_CANCELLED_STATUS,
  SERVICE_CALL_EDIT_STATUS_OPTIONS,
} from '../../lib/serviceCallLifecycle';
import { buildServiceCallUpsertRequest } from '../../lib/serviceCallUpsertRequest';
import type {
  ServiceCallCustomerOption,
  ServiceCallDetails,
  ServiceCallEmployeeOption,
  ServiceCallSiteOption,
} from '../../types';
import './ServiceCallDrawer.css';

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

function getBillingTypeLabel(billingType?: string | null): string | undefined {
  if (!billingType) return undefined;
  return BILLING_TYPE_OPTIONS.find((option) => option.value === billingType)?.label ?? billingType;
}

function formatDateTime(value?: string | null): string | undefined {
  return formatServiceCallDateTimeForDisplay(value);
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

function getServiceCallPrimaryRequiredRole(
  serviceCall?: ServiceCallDetails | null,
): string {
  return legacyRequiredRole(serviceCall?.requiredRoles ?? []) ?? serviceCall?.requiredRole ?? '';
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
  const canViewCustomers = can('viewCustomers');
  const canManageSites = can('manageSites');
  const { createMutation, updateMutation, cancelMutation, reopenMutation, assignEmployeeMutation } =
    useServiceCallMutations();

  // Existing service calls open in read-only review mode; create opens editable.
  const [isEditing, setIsEditing] = useState(!isExistingServiceCall);
  const [form, setForm] = useState<ServiceCallFormState>(() =>
    buildServiceCallFormState(currentServiceCall),
  );
  const professionOptionsQuery = useEmployeePrimaryRoles(isEditing);
  const availableProfessionOptions = useMemo(
    () =>
      (professionOptionsQuery.data ?? []).filter(
        (profession) => !isRequiredProfessionSelected(form.requiredRoles, profession),
      ),
    [form.requiredRoles, professionOptionsQuery.data],
  );
  const [error, setError] = useState<string | null>(null);
  const { isMaximized, toggleMaximize } = useDrawerMaximize();
  const [employeeIdToAssign, setEmployeeIdToAssign] = useState('');
  const [assignmentRole, setAssignmentRole] = useState(
    getServiceCallPrimaryRequiredRole(currentServiceCall),
  );
  // Nested CustomerDrawer intents (view record / manage sites) — stays on this page so
  // sessionStorage auth and unsaved service-call form fields are preserved.
  const [customerDrawerIntent, setCustomerDrawerIntent] =
    useState<NestedCustomerDrawerIntent>('closed');
  const customerAccessId = resolveServiceCallCustomerAccessId({
    isEditing,
    formCustomerId: form.customerId,
    persistedCustomerId: currentServiceCall?.customerId,
  });
  const detailCustomerId = resolveCanonicalCustomerQueryId({
    intent: customerDrawerIntent,
    accessCustomerId: customerAccessId,
  });
  const customerDetailQuery = useQuery({
    queryKey: ['customers', 'detail', detailCustomerId],
    queryFn: () => getCustomerByIdAsync(detailCustomerId),
    enabled: shouldFetchCanonicalCustomerDetail({
      intent: customerDrawerIntent,
      customerId: detailCustomerId,
      canViewCustomers,
    }),
    retry: false,
  });
  const isLoadingCustomerDetail =
    (customerDrawerIntent === 'view' || customerDrawerIntent === 'manageSites') &&
    customerDetailQuery.isLoading;
  const customerDetailError =
    customerDrawerIntent === 'view' || customerDrawerIntent === 'manageSites'
      ? customerDetailQuery.error
      : null;

  // The edit form/assignment role are only shown in edit mode, and entering edit mode re-seeds them
  // from the freshest currentServiceCall (see handleStartEdit). Review mode renders directly from
  // currentServiceCall, so no effect is needed to mirror server data into form state.
  const activeCustomers = useMemo(
    () => customers.filter((customer) => customer.isActive !== false),
    [customers],
  );

  const filteredSites = useMemo(() => {
    const selectedCustomerId = Number(form.customerId);
    return filterServiceCallSitesByCustomer(
      sites,
      selectedCustomerId || null,
    );
  }, [form.customerId, sites]);

  // A saved service call may reference a now-inactive site missing from the active lookup. Surface
  // it as a disabled option (edit mode only) while the original customer/site relationship holds.
  const historicalSiteOption = useMemo(
    () =>
      resolveServiceCallHistoricalSiteOption({
        isExistingServiceCall,
        formCustomerId: Number(form.customerId) || 0,
        formSiteId: Number(form.siteId) || 0,
        persistedCustomerId: currentServiceCall?.customerId,
        persistedSiteId: currentServiceCall?.siteId,
        persistedSiteName: currentServiceCall?.siteName,
        activeSiteIds: filteredSites.map((site) => site.siteId),
      }),
    [
      currentServiceCall,
      filteredSites,
      form.customerId,
      form.siteId,
      isExistingServiceCall,
    ],
  );

  const assignableEmployees = useMemo(
    () => employees.filter((employee) => employee.isActive !== false && employee.isAssignable !== false),
    [employees],
  );

  function setField<K extends keyof ServiceCallFormState>(key: K, value: ServiceCallFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addRequiredRole(value: string) {
    setForm((current) => ({
      ...current,
      requiredRoles: addRequiredProfession(current.requiredRoles, value),
    }));
  }

  function removeRequiredRole(value: string) {
    setForm((current) => ({
      ...current,
      requiredRoles: removeRequiredProfession(current.requiredRoles, value),
    }));
  }

  function handleStartEdit() {
    setForm(buildServiceCallFormState(currentServiceCall));
    setAssignmentRole(getServiceCallPrimaryRequiredRole(currentServiceCall));
    setEmployeeIdToAssign('');
    setError(null);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    if (!isExistingServiceCall) {
      onClose();
      return;
    }

    setForm(buildServiceCallFormState(currentServiceCall));
    setAssignmentRole(getServiceCallPrimaryRequiredRole(currentServiceCall));
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

    if (form.estimatedHours.trim()) {
      const estimatedHours = Number(form.estimatedHours.trim());
      if (!Number.isFinite(estimatedHours) || estimatedHours < 0) {
        return 'שעות מתוכננות חייבות להיות מספר תקין.';
      }
    }

    if (form.actualHours.trim()) {
      const actualHours = Number(form.actualHours.trim());
      if (!Number.isFinite(actualHours) || actualHours < 0) {
        return 'שעות בפועל חייבות להיות מספר תקין.';
      }
    }

    try {
      buildServiceCallUpsertRequest(form);
    } catch (err) {
      return err instanceof Error ? err.message : 'תאריך או שעה אינם תקינים.';
    }

    return null;
  }

  // The update API returns only a message, so review mode shows the request
  // values merged into the known record until the detail query refreshes.
  function buildUpdatedServiceCallFallback(existing: ServiceCallDetails): ServiceCallDetails {
    const request = buildServiceCallUpsertRequest(form);
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
      const request = buildServiceCallUpsertRequest(form);
      if (isExistingServiceCall) {
        await updateMutation.mutateAsync({
          id: currentServiceCall!.workItemId,
          request,
        });
        setIsEditing(false);
        onSaved(
          'קריאת השירות עודכנה בהצלחה.',
          buildUpdatedServiceCallFallback(currentServiceCall!),
        );
      } else {
        // The create API returns only the new id, so the drawer closes instead
        // of inventing a review view from unsaved values.
        await createMutation.mutateAsync(request);
        onSaved('קריאת השירות נוצרה בהצלחה.');
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירת קריאת השירות נכשלה');
    }
  }

  async function handleCancelServiceCall() {
    if (!isExistingServiceCall || !currentServiceCall) return;

    setError(null);
    try {
      await cancelMutation.mutateAsync(currentServiceCall.workItemId);
      await serviceCallDetailsQuery.refetch();
      onSaved('קריאת השירות בוטלה בהצלחה.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ביטול קריאת השירות נכשל');
    }
  }

  async function handleReopenServiceCall() {
    if (!isExistingServiceCall || !currentServiceCall) return;

    setError(null);
    try {
      await reopenMutation.mutateAsync(currentServiceCall.workItemId);
      await serviceCallDetailsQuery.refetch();
      onSaved('קריאת השירות נפתחה מחדש בהצלחה.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'פתיחה מחדש של קריאת השירות נכשלה');
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
    cancelMutation.isPending ||
    reopenMutation.isPending ||
    assignEmployeeMutation.isPending;

  const title = !isExistingServiceCall
    ? 'קריאת שירות חדשה'
    : isEditing
      ? `עריכת קריאת שירות — ${currentServiceCall?.title ?? ''}`
      : `פרטי קריאת שירות — ${currentServiceCall?.title ?? ''}`;

  const showCancelAction =
    isExistingServiceCall &&
    canManage &&
    canCancelServiceCall(currentServiceCall?.status, currentServiceCall?.closedAt);
  const showReopenAction =
    isExistingServiceCall &&
    canManage &&
    canReopenServiceCall(currentServiceCall?.status, currentServiceCall?.closedAt);

  // Edit mode keeps only save/cancel; lifecycle actions live in the read-only footer.
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
    showCancelAction || showReopenAction ? (
      <div className="serviceCallDrawer__footerContent">
        {error && <InlineAlert variant="danger">{error}</InlineAlert>}
        <div className="serviceCallDrawer__dangerActions">
          {showCancelAction && (
            <ConfirmInline
              triggerLabel="ביטול קריאה"
              message="לבטל את קריאת השירות? הפעולה תסמן את הקריאה כבוטלה ותשמור חותמת ביטול."
              confirmLabel="אישור ביטול"
              onConfirm={handleCancelServiceCall}
              isPending={isSaving}
            />
          )}
          {showReopenAction && (
            <ConfirmInline
              triggerLabel="פתיחה מחדש"
              message="לפתוח מחדש את קריאת השירות? חותמת הביטול תימחק והסטטוס יחזור לפתוחה."
              confirmLabel="אישור פתיחה מחדש"
              onConfirm={handleReopenServiceCall}
              isPending={isSaving}
            />
          )}
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
          canViewCustomers={canViewCustomers}
          isLoadingCustomerDetail={isLoadingCustomerDetail}
          customerDetailError={customerDetailError}
          onOpenCustomerRecord={() => {
            if (!canViewCustomers || customerAccessId <= 0) return;
            setCustomerDrawerIntent('view');
          }}
          onCancelCustomerLoad={() => setCustomerDrawerIntent('closed')}
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
                disabled={isServiceCallCancelled(form.status)}
              >
                {isServiceCallCancelled(form.status) && (
                  <option value={SERVICE_CALL_CANCELLED_STATUS}>בוטלה</option>
                )}
                {SERVICE_CALL_EDIT_STATUS_OPTIONS.map((option) => (
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
          </DetailsSection>

          <DetailsSection title="לקוח ואתר">
            <div className="serviceCallDrawer__grid">
              <Select
                label="לקוח"
                required
                value={form.customerId}
                onChange={(event) => {
                  const nextCustomerId = event.target.value;
                  setCustomerDrawerIntent(resolveCustomerDrawerIntentAfterCustomerChange());
                  setForm((current) => ({
                    ...current,
                    customerId: nextCustomerId,
                    siteId: resolveCompatibleServiceCallSiteId(
                      Number(current.siteId) || null,
                      sites,
                      Number(nextCustomerId) || null,
                    ),
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
                {historicalSiteOption && (
                  <option value={historicalSiteOption.siteId} disabled>
                    {historicalSiteOption.label}
                  </option>
                )}
              </Select>
            </div>
            {form.customerId && filteredSites.length === 0 && (
              <p className="serviceCallDrawer__hint">
                ללקוח זה אין אתרים פעילים. יש לנהל אתרים מתוך כרטיס הלקוח.
              </p>
            )}
            {canViewCustomers && form.customerId && (
              <div className="serviceCallDrawer__customerAccessActions">
                <div className="serviceCallDrawer__customerAccessButtons">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      if (customerAccessId <= 0) return;
                      setCustomerDrawerIntent('view');
                    }}
                    disabled={isLoadingCustomerDetail}
                  >
                    פתח תיק לקוח
                  </Button>
                  {canManageSites && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        if (customerAccessId <= 0) return;
                        setCustomerDrawerIntent('manageSites');
                      }}
                      disabled={isLoadingCustomerDetail}
                    >
                      ניהול אתרי הלקוח
                    </Button>
                  )}
                </div>
                {isLoadingCustomerDetail && (
                  <p className="serviceCallDrawer__hint">טוען פרטי לקוח…</p>
                )}
                {customerDetailError != null && (
                  <>
                    <InlineAlert variant="danger">
                      {customerDetailError instanceof Error
                        ? customerDetailError.message
                        : 'טעינת פרטי הלקוח נכשלה.'}
                    </InlineAlert>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setCustomerDrawerIntent('closed')}
                    >
                      סגור
                    </Button>
                  </>
                )}
              </div>
            )}
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

          <DetailsSection title="דרישה מקצועית">
            <div className="serviceCallDrawer__professionsField">
              <ListSelect
                label="מקצועות נדרשים"
                value=""
                onChange={addRequiredRole}
                placeholder={
                  professionOptionsQuery.isLoading ? 'טוען מקצועות…' : 'בחר מקצוע להוספה'
                }
                searchable
                searchPlaceholder="חיפוש מקצוע..."
                emptyMessage="אין מקצועות נוספים לבחירה."
                disabled={professionOptionsQuery.isLoading || professionOptionsQuery.isError}
                options={
                  availableProfessionOptions.length === 0
                    ? [
                        {
                          value: '__none__',
                          label: professionOptionsQuery.isLoading
                            ? 'טוען מקצועות…'
                            : 'אין מקצועות נוספים לבחירה',
                          disabled: true,
                        },
                      ]
                    : availableProfessionOptions.map((profession) => ({
                        value: profession,
                        label: profession,
                      }))
                }
              />
              {professionOptionsQuery.isError && (
                <InlineAlert variant="warning">
                  <span>טעינת רשימת המקצועות נכשלה. ניתן עדיין לשמור את המקצועות הקיימים.</span>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => professionOptionsQuery.refetch()}
                  >
                    נסה שוב
                  </Button>
                </InlineAlert>
              )}
              {form.requiredRoles.length > 0 ? (
                <ul className="serviceCallDrawer__professionChips" aria-label="מקצועות נדרשים">
                  {form.requiredRoles.map((profession, index) => (
                    <li key={profession} className="serviceCallDrawer__professionChip">
                      <span>{profession}</span>
                      {index === 0 && (
                        <span className="serviceCallDrawer__legacyProfession">ראשי</span>
                      )}
                      <button
                        type="button"
                        className="serviceCallDrawer__professionRemove"
                        onClick={() => removeRequiredRole(profession)}
                        aria-label={`הסר את המקצוע ${profession}`}
                      >
                        הסר
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="serviceCallDrawer__hint">לא נבחרו מקצועות חובה.</p>
              )}
              <p className="serviceCallDrawer__hint">
                המקצוע הראשון נשמר גם בשדה התפקיד הישן לצורך תאימות.
              </p>
            </div>
          </DetailsSection>

          {isExistingServiceCall && (
            <DetailsSection title="שיבוץ עובד">
              <div
                className="serviceCallDrawer__assignAction"
                role="group"
                aria-labelledby="serviceCallDrawer-assignActionTitle"
              >
                <div className="serviceCallDrawer__assignActionHeader">
                  <h4
                    id="serviceCallDrawer-assignActionTitle"
                    className="serviceCallDrawer__assignActionTitle"
                  >
                    שיוך עובד לקריאה
                  </h4>
                  <span className="serviceCallDrawer__assignActionBadge">פעולה מיידית</span>
                </div>
                <p className="serviceCallDrawer__hint">
                  שיוך עובד נשמר באופן מיידי ואינו תלוי בלחיצה על &quot;שמור&quot; בטופס הראשי.
                </p>
                <div className="serviceCallDrawer__grid">
                  <Select
                    label="עובד"
                    value={employeeIdToAssign}
                    onChange={(event) => {
                      const nextEmployeeId = event.target.value;
                      setEmployeeIdToAssign(nextEmployeeId);
                      const selectedEmployee = assignableEmployees.find(
                        (employee) => String(employee.employeeId) === nextEmployeeId,
                      );
                      setAssignmentRole((current) =>
                        resolveDefaultAssignmentRole({
                          currentAssignmentRole: current,
                          requiredRole: legacyRequiredRole(form.requiredRoles),
                          employeePrimaryRole: selectedEmployee?.primaryRole,
                        }),
                      );
                    }}
                  >
                    <option value="">בחר עובד</option>
                    {assignableEmployees.map((employee) => (
                      <option key={employee.employeeId} value={employee.employeeId}>
                        {employee.fullName}
                        {employee.professions?.length
                          ? ` — ${employee.professions.join(', ')}`
                          : employee.primaryRole
                            ? ` — ${employee.primaryRole}`
                            : ''}
                      </option>
                    ))}
                  </Select>

                  <Input
                    label="תפקיד העובד בקריאה"
                    value={assignmentRole}
                    onChange={(event) => setAssignmentRole(event.target.value)}
                    helpText="התפקיד שהעובד יבצע בקריאה זו, ולא תפקידו הקבוע במערכת."
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
            </DetailsSection>
          )}

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

      {customerDetailQuery.data &&
        (customerDrawerIntent === 'view' || customerDrawerIntent === 'manageSites') && (
        <CustomerDrawer
          isOpen
          customer={customerDetailQuery.data}
          onClose={() => setCustomerDrawerIntent('closed')}
          onSaved={() => setCustomerDrawerIntent('closed')}
        />
      )}
    </Drawer>
  );
}

interface ServiceCallReviewDetailsProps {
  serviceCall: ServiceCallDetails;
  customers: ServiceCallCustomerOption[];
  sites: ServiceCallSiteOption[];
  canViewCustomers: boolean;
  isLoadingCustomerDetail: boolean;
  customerDetailError: Error | null | unknown;
  onOpenCustomerRecord: () => void;
  onCancelCustomerLoad: () => void;
}

function ServiceCallReviewDetails({
  serviceCall,
  customers,
  sites,
  canViewCustomers,
  isLoadingCustomerDetail,
  customerDetailError,
  onOpenCustomerRecord,
  onCancelCustomerLoad,
}: ServiceCallReviewDetailsProps) {
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

  const showOpenCustomerRecord = canViewCustomers && serviceCall.customerId > 0;

  return (
    <div className="serviceCallDrawer serviceCallDrawer--review">
      <div className="serviceCallDrawer__primarySection">
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
          </div>
        </DetailsSection>
      </div>

      <DetailsSection title="לקוח ואתר">
        <div className="serviceCallDrawer__detailsGrid">
          <DetailsField
            label="לקוח"
            value={customerName ?? (serviceCall.customerId ? `לקוח #${serviceCall.customerId}` : undefined)}
          />
          <DetailsField label="אתר" value={siteName} />
          <ValidatedAddressDisplay
            formattedAddress={siteProfileQuery.data?.formattedAddress ?? site?.city ?? undefined}
            validationStatus={siteProfileQuery.data?.validationStatus}
          />
        </div>
        {showOpenCustomerRecord && (
          <div className="serviceCallDrawer__customerAccessActions">
            <div className="serviceCallDrawer__customerAccessButtons">
              <Button
                type="button"
                variant="secondary"
                onClick={onOpenCustomerRecord}
                disabled={isLoadingCustomerDetail}
              >
                פתח תיק לקוח
              </Button>
            </div>
            {isLoadingCustomerDetail && (
              <p className="serviceCallDrawer__hint">טוען פרטי לקוח…</p>
            )}
            {customerDetailError != null && (
              <>
                <InlineAlert variant="danger">
                  {customerDetailError instanceof Error
                    ? customerDetailError.message
                    : 'טעינת פרטי הלקוח נכשלה.'}
                </InlineAlert>
                <Button type="button" variant="ghost" onClick={onCancelCustomerLoad}>
                  סגור
                </Button>
              </>
            )}
          </div>
        )}
      </DetailsSection>

      <DetailsSection title="תזמון ושיבוץ">
        <div className="serviceCallDrawer__detailsGrid">
          <DetailsField label="התחלה מתוכננת" value={formatDateTime(serviceCall.plannedStart)} />
          <DetailsField label="סיום מתוכנן" value={formatDateTime(serviceCall.plannedEnd)} />
          <DetailsField label="התחלה בפועל" value={formatDateTime(serviceCall.actualStart)} />
          <DetailsField label="סיום בפועל" value={formatDateTime(serviceCall.actualEnd)} />
          <DetailsField label="שעות מתוכננות" value={formatHours(serviceCall.estimatedHours)} />
          <DetailsField label="שעות בפועל" value={formatHours(serviceCall.actualHours)} />
          <DetailsField
            label="מקצועות נדרשים"
            value={
              serviceCall.requiredRoles?.length
                ? serviceCall.requiredRoles.join(' · ')
                : serviceCall.requiredRole
            }
          />
        </div>
      </DetailsSection>

      <DetailsSection title="תיאור">
        {serviceCall.description?.trim() ? (
          <p className="serviceCallDrawer__multilineValue">{serviceCall.description}</p>
        ) : (
          <p className="serviceCallDrawer__hint">לא הוזן תיאור לקריאה זו.</p>
        )}
      </DetailsSection>

      <DetailsSection title="מחזור חיים">
        <div className="serviceCallDrawer__detailsGrid">
          <DetailsField label="נוצרה בתאריך" value={formatDateTime(serviceCall.createdAt)} />
          {serviceCall.closedAt ? (
            <DetailsField label="בוטלה בתאריך" value={formatDateTime(serviceCall.closedAt)} />
          ) : null}
        </div>
      </DetailsSection>
    </div>
  );
}

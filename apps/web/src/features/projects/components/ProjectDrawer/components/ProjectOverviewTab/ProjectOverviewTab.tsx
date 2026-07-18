import { memo, useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { Textarea } from '@shared/components/Textarea';
import { InlineAlert } from '@shared/components/InlineAlert';
import { usePermissions } from '@shared/auth/usePermissions';
import {
  CustomerDrawer,
  getCustomerByIdAsync,
  resolveCanonicalCustomerQueryId,
  resolveCustomerDrawerIntentAfterCustomerChange,
  shouldFetchCanonicalCustomerDetail,
  shouldInvokeCustomerCreatedOnSave,
  type Customer,
  type NestedCustomerDrawerIntent,
} from '@features/customers';
import {
  ValidatedAddressDisplay,
  getSiteAddressProfileOptionalAsync,
} from '@features/geo';
import { ProjectReportsCard } from '../ProjectReportsCard';
import type {
  ProjectEmployeeOption,
  ProjectLifecycle,
  ProjectOverviewForm,
  ProjectTeamForm,
  Site,
} from '../../../../types';
import {
  BILLING_TYPE_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  aggregateProjectTeamFromLifecycle,
  formatProjectDate,
  getBillingTypeDisplay,
  getProjectNumber,
  getProjectStatusMeta,
} from '../../../../utils/projectDisplayUtils';
import { resolveProjectCustomerAccessId } from '../../../../utils/projectCustomerAccess';
import {
  applyProjectCustomerChange,
  filterProjectSitesByCustomer,
  resolveProjectHistoricalSiteOption,
} from '../../../../utils/projectSiteSelection';
import './ProjectOverviewTab.css';

interface ProjectOverviewTabProps {
  lifecycle: ProjectLifecycle | null;
  form: ProjectOverviewForm;
  teamForm: ProjectTeamForm;
  isEditMode: boolean;
  isCreateMode: boolean;
  customers: Customer[];
  sites: Site[];
  employees: ProjectEmployeeOption[];
  onChange: (form: ProjectOverviewForm) => void;
  onTeamChange: (form: ProjectTeamForm) => void;
  onCustomerCreated: (customerId: number) => Promise<void>;
}

export const ProjectOverviewTab = memo(function ProjectOverviewTab({
  lifecycle,
  form,
  teamForm,
  isEditMode,
  isCreateMode,
  customers,
  sites,
  employees,
  onChange,
  onTeamChange,
  onCustomerCreated,
}: ProjectOverviewTabProps) {
  // One nested CustomerDrawer: create / view record / manage sites. Closed leaves the project
  // form untouched so unsaved edits survive.
  const [customerDrawerIntent, setCustomerDrawerIntent] =
    useState<NestedCustomerDrawerIntent>('closed');
  const { can } = usePermissions();
  const canViewCustomers = can('viewCustomers');

  const project = lifecycle?.project;
  const projectId = project?.workItemId;
  const filteredSites = useMemo(
    () => filterProjectSitesByCustomer(sites, form.customerId),
    [form.customerId, sites],
  );
  // form.siteId is the single source of truth in edit/create mode (hydrated from the persisted
  // project via overviewFormFromLifecycle). We never fall back to project.siteId at render time, so
  // clearing the site on customer change fully removes the old-site preview and address query.
  const resolvedSiteId = form.siteId;
  // A persisted project may point at a now-inactive site missing from the active lookup. Surface it
  // as a disabled option (and readable preview) only while the original customer/site pairing holds.
  const historicalSiteOption = useMemo(
    () =>
      resolveProjectHistoricalSiteOption({
        isCreateMode,
        formCustomerId: form.customerId,
        formSiteId: form.siteId,
        persistedCustomerId: project?.customerId,
        persistedSiteId: project?.siteId,
        persistedSiteName: project?.siteName,
        activeSiteIds: filteredSites.map((site) => site.siteId),
      }),
    [filteredSites, form.customerId, form.siteId, isCreateMode, project],
  );
  const selectedSite = useMemo<Site | null>(() => {
    const activeMatch = filteredSites.find((site) => site.siteId === resolvedSiteId);
    if (activeMatch) return activeMatch;
    if (historicalSiteOption && project) {
      return {
        siteId: historicalSiteOption.siteId,
        customerId: project.customerId,
        siteName: project.siteName ?? historicalSiteOption.label,
        isPrimary: false,
        createdAt: project.createdAt,
      };
    }
    return null;
  }, [filteredSites, historicalSiteOption, project, resolvedSiteId]);
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.customerId === form.customerId) ?? null,
    [customers, form.customerId],
  );

  const customerAccessId = resolveProjectCustomerAccessId({
    isEditMode,
    formCustomerId: form.customerId,
    persistedCustomerId: project?.customerId,
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

  const selectedSiteProfileQuery = useQuery({
    queryKey: ['sites', selectedSite?.siteId, 'address-profile'],
    queryFn: () => getSiteAddressProfileOptionalAsync(selectedSite!.siteId),
    enabled: Boolean(selectedSite?.siteId),
    retry: false,
  });
  const aggregatedTeam = useMemo(
    () => aggregateProjectTeamFromLifecycle(lifecycle),
    [lifecycle],
  );
  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.isActive !== false),
    [employees],
  );
  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee.employeeId, employee])),
    [employees],
  );
  const selectedTeamEmployeeIds = useMemo(
    () => new Set(teamForm.teamEmployeeIds),
    [teamForm.teamEmployeeIds],
  );
  const selectedProjectManager = teamForm.projectManagerEmployeeId != null
    ? employeesById.get(teamForm.projectManagerEmployeeId)
    : undefined;
  const managerOptions = useMemo(
    () =>
      selectedProjectManager && selectedProjectManager.isActive === false
        ? [selectedProjectManager, ...activeEmployees]
        : activeEmployees,
    [activeEmployees, selectedProjectManager],
  );
  const selectedTeamMembers = useMemo(
    () =>
      teamForm.teamEmployeeIds
        .map((employeeId) => employeesById.get(employeeId))
        .filter((employee): employee is ProjectEmployeeOption => employee != null),
    [employeesById, teamForm.teamEmployeeIds],
  );
  const teamMemberOptions = useMemo(
    () =>
      activeEmployees.filter(
        (employee) =>
          employee.employeeId !== teamForm.projectManagerEmployeeId &&
          !selectedTeamEmployeeIds.has(employee.employeeId),
      ),
    [activeEmployees, selectedTeamEmployeeIds, teamForm.projectManagerEmployeeId],
  );

  const updateField = useCallback(<K extends keyof ProjectOverviewForm>(
    key: K,
    value: ProjectOverviewForm[K],
  ) => {
    onChange({ ...form, [key]: value });
  }, [form, onChange]);

  const handleOpenCustomerRecord = useCallback(() => {
    if (!canViewCustomers || customerAccessId <= 0) return;
    setCustomerDrawerIntent('view');
  }, [canViewCustomers, customerAccessId]);

  const handleManageCustomerSites = useCallback(() => {
    // Sites are managed only from the customer record. Open CustomerDrawer above this project so the
    // authenticated session and unsaved project form state stay intact (no tab / route navigation).
    if (!canViewCustomers || customerAccessId <= 0) return;
    setCustomerDrawerIntent('manageSites');
  }, [canViewCustomers, customerAccessId]);

  const handleProjectManagerChange = useCallback((value: string) => {
    const projectManagerEmployeeId = value ? Number(value) : null;
    onTeamChange({
      ...teamForm,
      projectManagerEmployeeId,
      teamEmployeeIds: teamForm.teamEmployeeIds.filter(
        (employeeId) => employeeId !== projectManagerEmployeeId,
      ),
    });
  }, [onTeamChange, teamForm]);

  const handleCustomerDrawerClose = useCallback(() => {
    setCustomerDrawerIntent('closed');
  }, []);

  const handleCustomerSaved = useCallback(
    async (customer: Customer) => {
      // Only a newly created customer updates the project selection. Viewing/managing an
      // existing customer must not clear or replace the project's customer/site fields.
      if (shouldInvokeCustomerCreatedOnSave(customerDrawerIntent)) {
        await onCustomerCreated(customer.customerId);
      }
      setCustomerDrawerIntent('closed');
    },
    [customerDrawerIntent, onCustomerCreated],
  );

  const handleAddTeamMember = useCallback((value: string) => {
    const employeeId = Number(value);
    if (!Number.isInteger(employeeId) || employeeId <= 0) return;
    if (employeeId === teamForm.projectManagerEmployeeId) return;
    if (selectedTeamEmployeeIds.has(employeeId)) return;

    onTeamChange({
      ...teamForm,
      teamEmployeeIds: [...teamForm.teamEmployeeIds, employeeId],
    });
  }, [onTeamChange, selectedTeamEmployeeIds, teamForm]);

  const handleRemoveTeamMember = useCallback((employeeId: number) => {
    onTeamChange({
      ...teamForm,
      teamEmployeeIds: teamForm.teamEmployeeIds.filter(
        (selectedEmployeeId) => selectedEmployeeId !== employeeId,
      ),
    });
  }, [onTeamChange, teamForm]);

  const statusMeta = useMemo(
    () => getProjectStatusMeta(isEditMode ? form.status : project?.status),
    [form.status, isEditMode, project?.status],
  );

  const showOpenCustomerRecord =
    canViewCustomers && customerAccessId > 0;
  const showManageCustomerSites =
    isEditMode && canViewCustomers && form.customerId > 0;

  const customerLoadStatus = (
    <>
      {isLoadingCustomerDetail && (
        <p className="projectOverviewTab__fieldNote">טוען פרטי לקוח…</p>
      )}
      {customerDetailError != null && (
        <div className="projectOverviewTab__customerLoadError">
          <InlineAlert variant="danger">
            {customerDetailError instanceof Error
              ? customerDetailError.message
              : 'טעינת פרטי הלקוח נכשלה.'}
          </InlineAlert>
          <Button type="button" variant="ghost" onClick={handleCustomerDrawerClose}>
            סגור
          </Button>
        </div>
      )}
    </>
  );

  return (
    <div className="projectOverviewTab">
      <div className="projectOverviewTab__grid">
        <section className="projectOverviewTab__card">
          <h3 className="projectOverviewTab__cardTitle">פרטים כלליים</h3>
          <div className="projectOverviewTab__field">
            <span className="projectOverviewTab__label">שם הפרויקט</span>
            {isEditMode ? (
              <Input
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
              />
            ) : (
              <span>{project?.title || '-'}</span>
            )}
          </div>
          <div className="projectOverviewTab__field">
            <span className="projectOverviewTab__label">
              שם הלקוח <span className="projectOverviewTab__required">*</span>
            </span>
            {isEditMode ? (
              <div className="projectOverviewTab__fieldWithAction">
                <Select
                  value={form.customerId || ''}
                  onChange={(event) => {
                    const customerId = Number(event.target.value);
                    setCustomerDrawerIntent(resolveCustomerDrawerIntentAfterCustomerChange());
                    onChange(applyProjectCustomerChange(form, customerId));
                  }}
                  required
                >
                  <option value="">בחר לקוח קיים</option>
                  {customers.map((customer) => (
                    <option key={customer.customerId} value={customer.customerId}>
                      {customer.customerName}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCustomerDrawerIntent('create')}
                >
                  לקוח חדש
                </Button>
              </div>
            ) : (
              <span>{project?.customerName || '-'}</span>
            )}
            {isEditMode && selectedCustomer && (
              <span className="projectOverviewTab__fieldNote">
                נבחר: {selectedCustomer.customerName}
              </span>
            )}
            {showOpenCustomerRecord && (
              <div className="projectOverviewTab__customerAccessActions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleOpenCustomerRecord}
                  disabled={isLoadingCustomerDetail}
                >
                  פתח תיק לקוח
                </Button>
              </div>
            )}
            {customerDrawerIntent !== 'manageSites' && customerLoadStatus}
          </div>
          <div className="projectOverviewTab__field">
            <span className="projectOverviewTab__label">סטטוס</span>
            {isEditMode ? (
              <Select
                value={form.status}
                onChange={(event) => updateField('status', event.target.value)}
              >
                {PROJECT_STATUS_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.display}
                  </option>
                ))}
              </Select>
            ) : (
              <span>{statusMeta.display}</span>
            )}
          </div>
          <div className="projectOverviewTab__field">
            <span className="projectOverviewTab__label">סוג חיוב</span>
            {isEditMode ? (
              <Select
                value={form.billingType}
                onChange={(event) => updateField('billingType', event.target.value)}
              >
                {BILLING_TYPE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.display}
                  </option>
                ))}
              </Select>
            ) : (
              <span>{getBillingTypeDisplay(project?.billingType)}</span>
            )}
          </div>
        </section>

        <section className="projectOverviewTab__card">
          <h3 className="projectOverviewTab__cardTitle">תאריכים</h3>
          <div className="projectOverviewTab__field">
            <span className="projectOverviewTab__label">תאריך פתיחה</span>
            {isEditMode && !isCreateMode ? (
              <Input
                type="date"
                value={form.createdAt}
                onChange={(event) => updateField('createdAt', event.target.value)}
              />
            ) : (
              <span>{isCreateMode ? 'ייקבע בעת יצירה' : formatProjectDate(project?.createdAt)}</span>
            )}
          </div>
          <div className="projectOverviewTab__field">
            <span className="projectOverviewTab__label">תאריך סגירת העסקה</span>
            {isEditMode ? (
              <Input
                type="date"
                value={form.dealCloseDate}
                onChange={(event) => updateField('dealCloseDate', event.target.value)}
              />
            ) : (
              <span>{formatProjectDate(project?.dealCloseDate)}</span>
            )}
          </div>
        </section>

        <section className="projectOverviewTab__card">
          <h3 className="projectOverviewTab__cardTitle">מזהים</h3>
          <div className="projectOverviewTab__field">
            <span className="projectOverviewTab__label">מספר פרויקט</span>
            <span>{projectId ? getProjectNumber(projectId) : 'חדש'}</span>
          </div>
          <div className="projectOverviewTab__field">
            <span className="projectOverviewTab__label">מספר פרויקט בהנהלת חשבונות</span>
            {isEditMode ? (
              <Input
                value={form.financeProjectNumber}
                onChange={(event) =>
                  updateField('financeProjectNumber', event.target.value)
                }
              />
            ) : (
              <span>{project?.financeProjectNumber || '-'}</span>
            )}
          </div>
          <div className="projectOverviewTab__field">
            <span className="projectOverviewTab__label">מספר חשבונית</span>
            {isEditMode ? (
              <Input
                value={form.invoiceNumber}
                onChange={(event) => updateField('invoiceNumber', event.target.value)}
              />
            ) : (
              <span>{project?.invoiceNumber || '-'}</span>
            )}
          </div>
        </section>

        <section className="projectOverviewTab__card">
          <div className="projectOverviewTab__cardHeader">
            <h3 className="projectOverviewTab__cardTitle">אתר ותיאור</h3>
          </div>
          <div className="projectOverviewTab__field">
            <span className="projectOverviewTab__label">אתר</span>
            {isEditMode ? (
              <>
                <Select
                  value={form.siteId || ''}
                  onChange={(event) => updateField('siteId', Number(event.target.value))}
                  disabled={!form.customerId}
                >
                  <option value="">בחר אתר</option>
                  {filteredSites.map((site) => (
                    <option key={site.siteId} value={site.siteId}>
                      {[site.siteName, site.city, site.addressLine].filter(Boolean).join(' · ')}
                    </option>
                  ))}
                  {historicalSiteOption && (
                    <option value={historicalSiteOption.siteId} disabled>
                      {historicalSiteOption.label}
                    </option>
                  )}
                </Select>
                {!form.customerId ? (
                  <span className="projectOverviewTab__fieldNote">
                    יש לבחור לקוח כדי לבחור אתר.
                  </span>
                ) : filteredSites.length > 0 ? (
                  <span className="projectOverviewTab__fieldNote">
                    נמצאו {filteredSites.length} אתרים ללקוח זה. בחר אתר מהרשימה.
                  </span>
                ) : (
                  <span className="projectOverviewTab__fieldNote">
                    ללקוח הנבחר אין עדיין אתרים פעילים. יש לנהל אתרים מתוך כרטיס הלקוח.
                  </span>
                )}
                {showManageCustomerSites && (
                  <div className="projectOverviewTab__siteManageAction">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleManageCustomerSites}
                      disabled={isLoadingCustomerDetail}
                    >
                      ניהול אתרי הלקוח
                    </Button>
                    {customerDrawerIntent === 'manageSites' && customerLoadStatus}
                  </div>
                )}
              </>
            ) : (
              <span>{project?.siteName || '-'}</span>
            )}
          </div>
          {selectedSite && (
            <div className="projectOverviewTab__sitePreview">
              <strong>{selectedSite.siteName}</strong>
              <ValidatedAddressDisplay
                formattedAddress={
                  selectedSiteProfileQuery.data?.formattedAddress
                  ?? [selectedSite.city, selectedSite.addressLine].filter(Boolean).join(' · ')
                }
                validationStatus={selectedSiteProfileQuery.data?.validationStatus}
              />
              {selectedSite.notes && <span>{selectedSite.notes}</span>}
            </div>
          )}
          <div className="projectOverviewTab__field">
            <span className="projectOverviewTab__label">תיאור</span>
            {isEditMode ? (
              <Textarea
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                rows={4}
              />
            ) : (
              <span>{project?.description || '-'}</span>
            )}
          </div>
        </section>

        <section className="projectOverviewTab__card projectOverviewTab__card--wide">
          <h3 className="projectOverviewTab__cardTitle">צוות הפרויקט</h3>
          <div className="projectOverviewTab__field">
            <span className="projectOverviewTab__label">מנהל פרויקט</span>
            {isEditMode ? (
              <Select
                value={teamForm.projectManagerEmployeeId != null ? String(teamForm.projectManagerEmployeeId) : ''}
                onChange={(event) => handleProjectManagerChange(event.target.value)}
              >
                <option value="">בחר מנהל פרויקט</option>
                {managerOptions.map((employee) => (
                  <option key={employee.employeeId} value={String(employee.employeeId)}>
                    {employee.fullName}
                  </option>
                ))}
              </Select>
            ) : (
              <span>
                {aggregatedTeam.managerNames.length > 0
                  ? aggregatedTeam.managerNames.join(', ')
                  : '-'}
              </span>
            )}
          </div>
          <div className="projectOverviewTab__field">
            <span className="projectOverviewTab__label">עובדים משויכים</span>
            {isEditMode ? (
              <div className="projectOverviewTab__teamEditor">
                <div className="projectOverviewTab__teamAdd">
                  <Select
                    value=""
                    onChange={(event) => handleAddTeamMember(event.target.value)}
                    aria-label="בחר עובד להוספה לצוות"
                  >
                    <option value="">בחר עובד להוספה</option>
                    {teamMemberOptions.map((employee) => (
                      <option key={employee.employeeId} value={String(employee.employeeId)}>
                        {employee.fullName}
                        {employee.primaryRole ? ` · ${employee.primaryRole}` : ''}
                      </option>
                    ))}
                  </Select>
                </div>

                {selectedTeamMembers.length > 0 ? (
                  <div className="projectOverviewTab__teamChips">
                    {selectedTeamMembers.map((employee) => (
                      <span key={employee.employeeId} className="projectOverviewTab__teamChip">
                        <span>
                          {employee.fullName}
                          {employee.primaryRole ? ` · ${employee.primaryRole}` : ''}
                        </span>
                        <button
                          type="button"
                          className="projectOverviewTab__teamChipRemove"
                          onClick={() => handleRemoveTeamMember(employee.employeeId)}
                          aria-label={`הסר ${employee.fullName}`}
                        >
                          הסר
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="projectOverviewTab__hint">
                    לא נוספו חברי צוות. מנהל הפרויקט נשמר בנפרד.
                  </p>
                )}
              </div>
            ) : (
              <span>
                {aggregatedTeam.teamMemberNames.length > 0
                  ? aggregatedTeam.teamMemberNames.join(', ')
                  : '-'}
              </span>
            )}
          </div>
          {isEditMode && (
            <p className="projectOverviewTab__hint">
              מנהל הפרויקט וחברי הצוות הם שיוכים נפרדים. בחירת חבר צוות מוסיפה
              אותו מיד לרשימה, ושמירת הפרויקט שולחת את שני סוגי השיוך ללא כפילויות.
              שיוכי משימות וקבלנים אינם משתנים.
            </p>
          )}
        </section>

        {!isCreateMode && lifecycle && (
          <ProjectReportsCard reports={lifecycle.reports ?? []} />
        )}
      </div>
      <CustomerDrawer
        isOpen={
          customerDrawerIntent === 'create' ||
          ((customerDrawerIntent === 'view' || customerDrawerIntent === 'manageSites') &&
            customerDetailQuery.data != null)
        }
        customer={
          customerDrawerIntent === 'create' ? null : (customerDetailQuery.data ?? null)
        }
        onClose={handleCustomerDrawerClose}
        onSaved={handleCustomerSaved}
      />
    </div>
  );
});

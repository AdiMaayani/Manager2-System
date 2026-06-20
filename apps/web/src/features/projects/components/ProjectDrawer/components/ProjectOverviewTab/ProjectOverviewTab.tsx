import { memo, useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { Textarea } from '@shared/components/Textarea';
import { InlineAlert } from '@shared/components/InlineAlert';
import { ConfirmInline } from '@shared/components/ConfirmInline';
import { CustomerDrawer, type Customer } from '@features/customers';
import {
  ValidatedAddressField,
  ValidatedAddressDisplay,
  buildAddressProfilePayload,
  getSiteAddressProfileOptionalAsync,
  mapAddressProfileToFieldState,
  type ValidatedAddressFieldState,
  type UpsertAddressProfileRequest,
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
  onCreateSite: (payload: {
    customerId: number;
    siteName: string;
    notes?: string;
    isPrimary?: boolean;
    addressProfile?: UpsertAddressProfileRequest;
  }) => Promise<void>;
  onUpdateSite: (
    siteId: number,
    payload: {
      customerId: number;
      siteName: string;
      notes?: string;
      isPrimary?: boolean;
      addressProfile?: UpsertAddressProfileRequest;
    },
  ) => Promise<void>;
  onDeactivateSite: (siteId: number) => Promise<void>;
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
  onCreateSite,
  onUpdateSite,
  onDeactivateSite,
}: ProjectOverviewTabProps) {
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [showEditSiteForm, setShowEditSiteForm] = useState(false);
  const [showCustomerDrawer, setShowCustomerDrawer] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteAddressState, setNewSiteAddressState] = useState<ValidatedAddressFieldState>({
    inputAddress: '',
    validationStatus: null,
  });
  const [newSiteNotes, setNewSiteNotes] = useState('');
  const [editSiteName, setEditSiteName] = useState('');
  const [editSiteAddressState, setEditSiteAddressState] = useState<ValidatedAddressFieldState>({
    inputAddress: '',
    validationStatus: null,
  });
  const [editSiteNotes, setEditSiteNotes] = useState('');
  const [siteError, setSiteError] = useState<string | null>(null);
  const [employeeToAddId, setEmployeeToAddId] = useState('');

  const project = lifecycle?.project;
  const projectId = project?.workItemId;
  const filteredSites = useMemo(
    () => sites.filter((site) => site.customerId === form.customerId),
    [form.customerId, sites],
  );
  const selectedSite = useMemo(
    () => filteredSites.find((site) => site.siteId === form.siteId) ?? null,
    [filteredSites, form.siteId],
  );
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.customerId === form.customerId) ?? null,
    [customers, form.customerId],
  );

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

  const handleCreateSite = useCallback(async () => {
    setSiteError(null);

    if (!form.customerId) {
      setSiteError('יש לבחור לקוח לפני יצירת אתר.');
      return;
    }

    if (!newSiteName.trim()) {
      setSiteError('יש להזין שם אתר.');
      return;
    }

    try {
      await onCreateSite({
        customerId: form.customerId,
        siteName: newSiteName.trim(),
        notes: newSiteNotes.trim() || undefined,
        addressProfile: buildAddressProfilePayload(newSiteAddressState) ?? undefined,
      });

      setSiteError(null);
      setShowSiteForm(false);
      setNewSiteName('');
      setNewSiteAddressState({ inputAddress: '', validationStatus: null });
      setNewSiteNotes('');
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'יצירת האתר נכשלה. נסה שוב.';
      setSiteError(message);
    }
  }, [form.customerId, newSiteAddressState, newSiteName, newSiteNotes, onCreateSite]);

  const openEditSiteForm = useCallback(async () => {
    if (!selectedSite) return;

    setSiteError(null);
    setShowSiteForm(false);
    setShowEditSiteForm(true);
    setEditSiteName(selectedSite.siteName);
    setEditSiteNotes(selectedSite.notes ?? '');

    try {
      const profile = await getSiteAddressProfileOptionalAsync(selectedSite.siteId);
      setEditSiteAddressState(
        profile
          ? mapAddressProfileToFieldState(profile)
          : {
              inputAddress: [selectedSite.addressLine, selectedSite.city].filter(Boolean).join(', '),
              validationStatus: null,
            },
      );
    } catch {
      setEditSiteAddressState({
        inputAddress: [selectedSite.addressLine, selectedSite.city].filter(Boolean).join(', '),
        validationStatus: null,
      });
    }
  }, [selectedSite]);

  const handleUpdateSite = useCallback(async () => {
    setSiteError(null);

    if (!selectedSite) {
      setSiteError('יש לבחור אתר לעריכה.');
      return;
    }

    if (!editSiteName.trim()) {
      setSiteError('יש להזין שם אתר.');
      return;
    }

    try {
      await onUpdateSite(selectedSite.siteId, {
        customerId: selectedSite.customerId,
        siteName: editSiteName.trim(),
        notes: editSiteNotes.trim() || undefined,
        isPrimary: selectedSite.isPrimary,
        addressProfile: buildAddressProfilePayload(editSiteAddressState) ?? undefined,
      });

      setSiteError(null);
      setShowEditSiteForm(false);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'עדכון האתר נכשל. נסה שוב.';
      setSiteError(message);
    }
  }, [
    editSiteAddressState,
    editSiteName,
    editSiteNotes,
    onUpdateSite,
    selectedSite,
  ]);

  const handleDeactivateSite = useCallback(async () => {
    setSiteError(null);

    if (!selectedSite) {
      setSiteError('יש לבחור אתר למחיקה.');
      return;
    }

    try {
      await onDeactivateSite(selectedSite.siteId);
      setSiteError(null);
      setShowEditSiteForm(false);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'מחיקת האתר נכשלה. ודא שאין עבודות פתוחות באתר.';
      setSiteError(message);
    }
  }, [onDeactivateSite, selectedSite]);

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

  const handleCustomerSaved = useCallback(
    async (customer: Customer) => {
      await onCustomerCreated(customer.customerId);
      setShowCustomerDrawer(false);
    },
    [onCustomerCreated],
  );

  const handleAddTeamMember = useCallback(() => {
    const employeeId = Number(employeeToAddId);
    if (!Number.isInteger(employeeId) || employeeId <= 0) return;
    if (employeeId === teamForm.projectManagerEmployeeId) return;
    if (selectedTeamEmployeeIds.has(employeeId)) return;

    onTeamChange({
      ...teamForm,
      teamEmployeeIds: [...teamForm.teamEmployeeIds, employeeId],
    });
    setEmployeeToAddId('');
  }, [employeeToAddId, onTeamChange, selectedTeamEmployeeIds, teamForm]);

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
                    onChange({ ...form, customerId, siteId: 0 });
                    setShowSiteForm(false);
                    setShowEditSiteForm(false);
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
                  onClick={() => setShowCustomerDrawer(true)}
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
            {isEditMode && (
              <div className="projectOverviewTab__cardActions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowEditSiteForm(false);
                    setShowSiteForm((value) => !value);
                  }}
                  disabled={!form.customerId}
                >
                  {showSiteForm ? 'ביטול הוספת אתר' : 'הוסף אתר'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={openEditSiteForm}
                  disabled={!selectedSite}
                >
                  ערוך אתר נבחר
                </Button>
              </div>
            )}
          </div>
          <div className="projectOverviewTab__field">
            <span className="projectOverviewTab__label">אתר</span>
            {isEditMode ? (
              <>
                <Select
                  value={form.siteId || ''}
                  onChange={(event) => updateField('siteId', Number(event.target.value))}
                >
                  <option value="">בחר אתר</option>
                  {filteredSites.map((site) => (
                    <option key={site.siteId} value={site.siteId}>
                      {[site.siteName, site.city, site.addressLine].filter(Boolean).join(' · ')}
                    </option>
                  ))}
                </Select>
                {filteredSites.length > 0 ? (
                  <span className="projectOverviewTab__fieldNote">
                    נמצאו {filteredSites.length} אתרים ללקוח זה. בחר אתר מהרשימה.
                  </span>
                ) : (
                  <span className="projectOverviewTab__fieldNote">
                    אין עדיין אתרים ללקוח הנבחר.
                  </span>
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
              <div className="projectOverviewTab__siteDangerAction">
                <ConfirmInline
                  triggerLabel="מחיקה"
                  message="למחוק את האתר?"
                  confirmLabel="אישור מחיקה"
                  onConfirm={handleDeactivateSite}
                  isPending={false}
                />
              </div>
            </div>
          )}
          {isEditMode && siteError && !showSiteForm && !showEditSiteForm && (
            <InlineAlert variant="danger">{siteError}</InlineAlert>
          )}
          {isEditMode && showSiteForm && (
            <div className="projectOverviewTab__siteForm">
              <Input
                label="שם אתר"
                value={newSiteName}
                onChange={(event) => setNewSiteName(event.target.value)}
              />
              <ValidatedAddressField
                label="כתובת אתר"
                value={newSiteAddressState}
                onChange={setNewSiteAddressState}
              />
              <Input
                label="הערות"
                value={newSiteNotes}
                onChange={(event) => setNewSiteNotes(event.target.value)}
              />
              {siteError && (
                <InlineAlert variant="danger">{siteError}</InlineAlert>
              )}
              <Button type="button" variant="secondary" onClick={handleCreateSite}>
                שמור אתר
              </Button>
            </div>
          )}
          {isEditMode && showEditSiteForm && selectedSite && (
            <div className="projectOverviewTab__siteForm">
              <Input
                label="שם אתר"
                value={editSiteName}
                onChange={(event) => setEditSiteName(event.target.value)}
              />
              <ValidatedAddressField
                label="כתובת אתר"
                value={editSiteAddressState}
                onChange={setEditSiteAddressState}
              />
              <Input
                label="הערות"
                value={editSiteNotes}
                onChange={(event) => setEditSiteNotes(event.target.value)}
              />
              {siteError && (
                <InlineAlert variant="danger">{siteError}</InlineAlert>
              )}
              <div className="projectOverviewTab__siteActions">
                <Button type="button" variant="secondary" onClick={handleUpdateSite}>
                  שמור אתר
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowEditSiteForm(false);
                    setSiteError(null);
                  }}
                >
                  ביטול
                </Button>
              </div>
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
                    value={employeeToAddId}
                    onChange={(event) => setEmployeeToAddId(event.target.value)}
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
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddTeamMember}
                    disabled={!employeeToAddId}
                  >
                    הוסף עובד
                  </Button>
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
                  <p className="projectOverviewTab__hint">לא נבחרו עובדים לצוות.</p>
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
          {isEditMode && !isCreateMode && (
            <p className="projectOverviewTab__hint">
              שיוך צוות נשמר עם הפרויקט ומחליף את שיוכי העובדים ברמת הפרויקט בלבד.
              שיוכי משימות וקבלנים אינם משתנים.
            </p>
          )}
        </section>

        {!isCreateMode && lifecycle && (
          <ProjectReportsCard reports={lifecycle.reports ?? []} />
        )}
      </div>
      <CustomerDrawer
        isOpen={showCustomerDrawer}
        onClose={() => setShowCustomerDrawer(false)}
        onSaved={handleCustomerSaved}
      />
    </div>
  );
});

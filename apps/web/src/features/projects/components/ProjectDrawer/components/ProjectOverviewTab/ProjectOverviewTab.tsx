import { memo, useCallback, useMemo, useState } from 'react';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import type { Customer } from '@features/customers/types';
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
  onCreateSite: (payload: {
    customerId: number;
    siteName: string;
    addressLine?: string;
    city?: string;
    notes?: string;
    isPrimary?: boolean;
  }) => Promise<void>;
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
  onCreateSite,
}: ProjectOverviewTabProps) {
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteCity, setNewSiteCity] = useState('');
  const [newSiteAddress, setNewSiteAddress] = useState('');
  const [newSiteNotes, setNewSiteNotes] = useState('');
  const [siteError, setSiteError] = useState<string | null>(null);
  const [employeeToAddId, setEmployeeToAddId] = useState('');

  const project = lifecycle?.project;
  const projectId = project?.workItemId;
  const filteredSites = useMemo(
    () => sites.filter((site) => site.customerId === form.customerId),
    [form.customerId, sites],
  );
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
        addressLine: newSiteAddress.trim() || undefined,
        city: newSiteCity.trim() || undefined,
        notes: newSiteNotes.trim() || undefined,
      });

      setSiteError(null);
      setShowSiteForm(false);
      setNewSiteName('');
      setNewSiteCity('');
      setNewSiteAddress('');
      setNewSiteNotes('');
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'יצירת האתר נכשלה. נסה שוב.';
      setSiteError(message);
    }
  }, [form.customerId, newSiteAddress, newSiteCity, newSiteName, newSiteNotes, onCreateSite]);

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
            <span className="projectOverviewTab__label">שם הלקוח</span>
            {isEditMode ? (
              <select
                className="projectOverviewTab__select"
                value={form.customerId || ''}
                onChange={(event) => {
                  const customerId = Number(event.target.value);
                  onChange({ ...form, customerId, siteId: 0 });
                }}
              >
                <option value="">בחר לקוח</option>
                {customers.map((customer) => (
                  <option key={customer.customerId} value={customer.customerId}>
                    {customer.customerName}
                  </option>
                ))}
              </select>
            ) : (
              <span>{project?.customerName || '-'}</span>
            )}
          </div>
          <div className="projectOverviewTab__field">
            <span className="projectOverviewTab__label">סטטוס</span>
            {isEditMode ? (
              <select
                className="projectOverviewTab__select"
                value={form.status}
                onChange={(event) => updateField('status', event.target.value)}
              >
                {PROJECT_STATUS_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.display}
                  </option>
                ))}
              </select>
            ) : (
              <span>{statusMeta.display}</span>
            )}
          </div>
          <div className="projectOverviewTab__field">
            <span className="projectOverviewTab__label">סוג חיוב</span>
            {isEditMode ? (
              <select
                className="projectOverviewTab__select"
                value={form.billingType}
                onChange={(event) => updateField('billingType', event.target.value)}
              >
                {BILLING_TYPE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.display}
                  </option>
                ))}
              </select>
            ) : (
              <span>{getBillingTypeDisplay(project?.billingType)}</span>
            )}
          </div>
        </section>

        <section className="projectOverviewTab__card">
          <h3 className="projectOverviewTab__cardTitle">תאריכים</h3>
          <div className="projectOverviewTab__field">
            <span className="projectOverviewTab__label">תאריך פתיחה</span>
            <span>{formatProjectDate(project?.createdAt)}</span>
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
          <h3 className="projectOverviewTab__cardTitle">אתר ותיאור</h3>
          <div className="projectOverviewTab__field">
            <span className="projectOverviewTab__label">אתר</span>
            {isEditMode ? (
              <>
                <select
                  className="projectOverviewTab__select"
                  value={form.siteId || ''}
                  onChange={(event) => updateField('siteId', Number(event.target.value))}
                >
                  <option value="">בחר אתר</option>
                  {filteredSites.map((site) => (
                    <option key={site.siteId} value={site.siteId}>
                      {site.siteName}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowSiteForm((value) => !value)}
                >
                  {showSiteForm ? 'ביטול הוספת אתר' : 'הוסף אתר'}
                </Button>
              </>
            ) : (
              <span>{project?.siteName || '-'}</span>
            )}
          </div>
          {isEditMode && showSiteForm && (
            <div className="projectOverviewTab__siteForm">
              <Input
                label="שם אתר"
                value={newSiteName}
                onChange={(event) => setNewSiteName(event.target.value)}
              />
              <Input
                label="עיר"
                value={newSiteCity}
                onChange={(event) => setNewSiteCity(event.target.value)}
              />
              <Input
                label="כתובת"
                value={newSiteAddress}
                onChange={(event) => setNewSiteAddress(event.target.value)}
              />
              <Input
                label="הערות"
                value={newSiteNotes}
                onChange={(event) => setNewSiteNotes(event.target.value)}
              />
              {siteError && (
                <p className="projectOverviewTab__siteError">{siteError}</p>
              )}
              <Button type="button" variant="secondary" onClick={handleCreateSite}>
                שמור אתר
              </Button>
            </div>
          )}
          <div className="projectOverviewTab__field">
            <span className="projectOverviewTab__label">תיאור</span>
            {isEditMode ? (
              <textarea
                className="projectOverviewTab__textarea"
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
              <select
                className="projectOverviewTab__select"
                value={teamForm.projectManagerEmployeeId != null ? String(teamForm.projectManagerEmployeeId) : ''}
                onChange={(event) => handleProjectManagerChange(event.target.value)}
              >
                <option value="">בחר מנהל פרויקט</option>
                {managerOptions.map((employee) => (
                  <option key={employee.employeeId} value={String(employee.employeeId)}>
                    {employee.fullName}
                  </option>
                ))}
              </select>
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
                  <select
                    className="projectOverviewTab__select"
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
                  </select>
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
      </div>
    </div>
  );
});


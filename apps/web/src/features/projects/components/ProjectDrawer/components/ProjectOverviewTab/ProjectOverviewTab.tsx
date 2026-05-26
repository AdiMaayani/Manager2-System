import { useState } from 'react';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import type { Customer } from '@features/customers/types';
import type {
  ProjectLifecycle,
  ProjectOverviewForm,
  Site,
} from '../../../../types';
import {
  BILLING_TYPE_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  formatProjectDate,
  getBillingTypeDisplay,
  getProjectNumber,
  getProjectStatusMeta,
  toDateInputValue,
} from '../../../../utils/projectDisplayUtils';
import './ProjectOverviewTab.css';

interface ProjectOverviewTabProps {
  lifecycle: ProjectLifecycle | null;
  form: ProjectOverviewForm;
  isEditMode: boolean;
  isCreateMode: boolean;
  customers: Customer[];
  sites: Site[];
  onChange: (form: ProjectOverviewForm) => void;
  onCreateSite: (payload: {
    customerId: number;
    siteName: string;
    addressLine?: string;
    city?: string;
    notes?: string;
    isPrimary?: boolean;
  }) => Promise<void>;
}

export function ProjectOverviewTab({
  lifecycle,
  form,
  isEditMode,
  isCreateMode,
  customers,
  sites,
  onChange,
  onCreateSite,
}: ProjectOverviewTabProps) {
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteCity, setNewSiteCity] = useState('');
  const [newSiteAddress, setNewSiteAddress] = useState('');
  const [newSiteNotes, setNewSiteNotes] = useState('');

  const project = lifecycle?.project;
  const projectId = project?.workItemId;
  const filteredSites = sites.filter((site) => site.customerId === form.customerId);

  const projectManager = lifecycle?.assignments.find(
    (assignment) =>
      assignment.assignmentRole?.toLowerCase() === 'project manager' &&
      assignment.workItemId === projectId,
  );

  const teamMembers = lifecycle?.assignments.filter(
    (assignment) =>
      assignment.workItemId === projectId &&
      assignment.assignmentRole?.toLowerCase() !== 'project manager' &&
      assignment.employeeName,
  ) ?? [];

  const updateField = <K extends keyof ProjectOverviewForm>(
    key: K,
    value: ProjectOverviewForm[K],
  ) => {
    onChange({ ...form, [key]: value });
  };

  const handleCreateSite = async () => {
    if (!form.customerId || !newSiteName.trim()) return;

    await onCreateSite({
      customerId: form.customerId,
      siteName: newSiteName.trim(),
      addressLine: newSiteAddress.trim() || undefined,
      city: newSiteCity.trim() || undefined,
      notes: newSiteNotes.trim() || undefined,
    });

    setShowSiteForm(false);
    setNewSiteName('');
    setNewSiteCity('');
    setNewSiteAddress('');
    setNewSiteNotes('');
  };

  const statusMeta = getProjectStatusMeta(isEditMode ? form.status : project?.status);

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
                  updateField('customerId', customerId);
                  updateField('siteId', 0);
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

        {!isCreateMode && (
          <section className="projectOverviewTab__card">
            <h3 className="projectOverviewTab__cardTitle">צוות הפרויקט</h3>
            <div className="projectOverviewTab__field">
              <span className="projectOverviewTab__label">מנהל פרויקט</span>
              <span>{projectManager?.employeeName || '-'}</span>
            </div>
            <div className="projectOverviewTab__field">
              <span className="projectOverviewTab__label">עובדים משויכים</span>
              <span>
                {teamMembers.length > 0
                  ? teamMembers.map((member) => member.employeeName).join(', ')
                  : '-'}
              </span>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export function overviewFormFromLifecycle(
  lifecycle: ProjectLifecycle | null,
): ProjectOverviewForm {
  if (!lifecycle) {
    return {
      title: '',
      description: '',
      status: 'Open',
      billingType: 'Fixed',
      customerId: 0,
      siteId: 0,
      dealCloseDate: '',
      financeProjectNumber: '',
      invoiceNumber: '',
    };
  }

  const { project } = lifecycle;
  return {
    title: project.title,
    description: project.description ?? '',
    status: project.status,
    billingType: project.billingType ?? 'Fixed',
    customerId: project.customerId,
    siteId: project.siteId ?? 0,
    dealCloseDate: toDateInputValue(project.dealCloseDate),
    financeProjectNumber: project.financeProjectNumber ?? '',
    invoiceNumber: project.invoiceNumber ?? '',
  };
}

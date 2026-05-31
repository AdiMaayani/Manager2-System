import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { EmptyState } from '@shared/components/EmptyState';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { Modal } from '@shared/components/Modal';
import { Input } from '@shared/components/Input';
import {
  createWorkReportAsync,
  getReportEmployeesAsync,
  getReportProjectsAsync,
} from '../../api/reportsApiClient';
import { ReportDetailModal } from '../../components/ReportDetailModal';
import { useReports } from '../../hooks/useReports';
import type { CreateWorkReportRequest } from '../../types';
import './ReportsPage.css';

const QUICK_REPORT_KEY = 'manager2_quick_report_prefill';
const SYSTEM_OPTIONS = ['חשמל חכם', 'בקרה', 'תקשורת', 'מולטימדיה', 'מצלמות ואבטחה'];

interface QuickReportPrefill {
  date?: string;
  projectId?: number | string | null;
  projectName?: string;
  customerName?: string;
  site?: string;
  start?: string;
  end?: string;
  reporterId?: number | string | null;
  reporterName?: string;
  reporterRole?: string;
  serviceCallId?: number | string | null;
}

interface ReportFormState {
  reportType: 'project' | 'service_call';
  date: string;
  projectId: string;
  customerName: string;
  serviceCallId: string;
  serviceCallTitle: string;
  site: string;
  start: string;
  end: string;
  reporterId: string;
  role: string;
  summary: string;
  notes: string;
  followup: boolean;
  followupReason: string;
  systems: string[];
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function createInitialFormState(prefill?: QuickReportPrefill | null): ReportFormState {
  return {
    reportType: prefill?.serviceCallId ? 'service_call' : 'project',
    date: prefill?.date || todayYmd(),
    projectId: prefill?.projectId != null ? String(prefill.projectId) : '',
    customerName: prefill?.customerName || '',
    serviceCallId: prefill?.serviceCallId != null ? String(prefill.serviceCallId) : '',
    serviceCallTitle: '',
    site: prefill?.site || '',
    start: prefill?.start || '',
    end: prefill?.end || '',
    reporterId: prefill?.reporterId != null ? String(prefill.reporterId) : '',
    role: prefill?.reporterRole || '',
    summary: '',
    notes: '',
    followup: false,
    followupReason: '',
    systems: [],
  };
}

function parseNullableInt(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function formatReportDate(value?: string) {
  if (!value) return '';
  return value.split('T')[0];
}

export function ReportsPage() {
  const { data: reports, isLoading, error, refetch } = useReports();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [form, setForm] = useState<ReportFormState>(() => createInitialFormState());
  const [formError, setFormError] = useState<string | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ['reports', 'projects'],
    queryFn: getReportProjectsAsync,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['reports', 'employees'],
    queryFn: getReportEmployeesAsync,
  });

  const selectedProject = useMemo(
    () => projects.find((project) => String(project.workItemId) === form.projectId) ?? null,
    [form.projectId, projects],
  );

  const selectedReporter = useMemo(
    () => employees.find((employee) => String(employee.employeeId) === form.reporterId) ?? null,
    [employees, form.reporterId],
  );

  useEffect(() => {
    if (searchParams.get('quick') !== '1') return;

    const rawPrefill = sessionStorage.getItem(QUICK_REPORT_KEY);
    if (!rawPrefill) return;

    try {
      const prefill = JSON.parse(rawPrefill) as QuickReportPrefill;
      setForm(createInitialFormState(prefill));
      setIsCreateOpen(true);
      sessionStorage.removeItem(QUICK_REPORT_KEY);
      navigate('/reports', { replace: true });
    } catch {
      sessionStorage.removeItem(QUICK_REPORT_KEY);
    }
  }, [navigate, searchParams]);

  function openCreateModal() {
    setForm(createInitialFormState());
    setFormError(null);
    setIsCreateOpen(true);
  }

  function closeCreateModal() {
    setFormError(null);
    setIsCreateOpen(false);
  }

  function updateForm(patch: Partial<ReportFormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function handleProjectChange(projectId: string) {
    const project = projects.find((row) => String(row.workItemId) === projectId);
    updateForm({
      projectId,
      customerName: project?.customerName || '',
      site: project?.siteName || form.site,
    });
  }

  function toggleSystem(system: string) {
    setForm((current) => ({
      ...current,
      systems: current.systems.includes(system)
        ? current.systems.filter((item) => item !== system)
        : [...current.systems, system],
    }));
  }

  const createReport = useMutation({
    mutationFn: async () => {
      if (!form.date) throw new Error('יש להזין תאריך דיווח');
      if (form.reportType === 'project' && !form.projectId) throw new Error('יש לבחור פרויקט');
      if (!form.reporterId) throw new Error('יש לבחור מדווח');
      if (!form.start || !form.end) throw new Error('יש להזין שעות עבודה');
      if (!form.summary.trim()) throw new Error('יש להזין סיכום עבודה');

      const payload: CreateWorkReportRequest = {
        reportType: form.reportType,
        date: form.date,
        projectId: parseNullableInt(form.projectId),
        projectName: selectedProject?.title || null,
        customerName: form.customerName || selectedProject?.customerName || null,
        serviceCallId: parseNullableInt(form.serviceCallId),
        serviceCallTitle: form.serviceCallTitle || null,
        site: form.site || null,
        start: form.start || null,
        end: form.end || null,
        summary: form.summary.trim(),
        notes: form.notes || null,
        reporterId: parseNullableInt(form.reporterId),
        reporterName: selectedReporter?.fullName || null,
        role: form.role || selectedReporter?.primaryRole || null,
        status: 'הוגש',
        systems: form.systems,
        relatedWorkers: [],
        followup: form.followup,
        followupReason: form.followup ? form.followupReason || null : null,
      };

      return createWorkReportAsync(payload);
    },
    onSuccess: async () => {
      setIsCreateOpen(false);
      setForm(createInitialFormState());
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : 'יצירת הדיווח נכשלה');
    },
  });

  if (isLoading) return <PageShell title="דיווחים"><PageSpinner /></PageShell>;
  if (error) {
    return (
      <PageShell title="דיווחים">
        <ErrorState message={error.message} onRetry={() => refetch()} />
      </PageShell>
    );
  }

  return (
    <PageShell title="דיווחים">
      <div className="reportsPage__toolbar">
        <Button type="button" onClick={openCreateModal}>
          דיווח חדש
        </Button>
      </div>

      {!reports?.length ? (
        <EmptyState title="אין דיווחים" />
      ) : (
        <div className="reportsPage__list">
          {reports.map((r) => (
            <button
              key={r.reportId}
              type="button"
              className="reportsPage__item reportsPage__item--clickable"
              onClick={() => setSelectedReportId(r.reportId)}
            >
              <div>
                <strong>{r.projectTitle ?? `דיווח #${r.reportId}`}</strong>
                <p>{formatReportDate(r.reportDate)}</p>
                {r.reportedByName && <span>{r.reportedByName}</span>}
              </div>
              <Badge variant="primary">{r.status ?? '—'}</Badge>
            </button>
          ))}
        </div>
      )}

      <Modal isOpen={isCreateOpen} onClose={closeCreateModal} title="דיווח חדש">
        <form
          className="reportsPage__form"
          onSubmit={(event) => {
            event.preventDefault();
            createReport.mutate();
          }}
        >
          <section className="reportsPage__formSection">
            <h3>פרטי דיווח</h3>
            <div className="reportsPage__typeOptions" role="group" aria-label="סוג דיווח">
              <label>
                <input
                  type="radio"
                  name="report-type"
                  checked={form.reportType === 'project'}
                  onChange={() => updateForm({ reportType: 'project' })}
                />
                <span>פרויקט</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="report-type"
                  checked={form.reportType === 'service_call'}
                  onChange={() => updateForm({ reportType: 'service_call' })}
                />
                <span>קריאת שירות</span>
              </label>
            </div>

            <div className="reportsPage__grid">
              <Input
                label="תאריך"
                type="date"
                value={form.date}
                onChange={(event) => updateForm({ date: event.target.value })}
                required
              />

              {form.reportType === 'project' ? (
                <label className="reportsPage__field">
                  <span>פרויקט</span>
                  <select
                    className="reportsPage__select"
                    value={form.projectId}
                    onChange={(event) => handleProjectChange(event.target.value)}
                    required
                  >
                    <option value="">בחר פרויקט</option>
                    {projects.map((project) => (
                      <option key={project.workItemId} value={project.workItemId}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <Input
                    label="מספר קריאת שירות"
                    type="number"
                    value={form.serviceCallId}
                    onChange={(event) => updateForm({ serviceCallId: event.target.value })}
                  />
                  <Input
                    label="כותרת קריאת שירות"
                    value={form.serviceCallTitle}
                    onChange={(event) => updateForm({ serviceCallTitle: event.target.value })}
                  />
                </>
              )}

              <Input
                label="לקוח"
                value={form.customerName}
                onChange={(event) => updateForm({ customerName: event.target.value })}
              />
              <Input
                label="אתר / מיקום עבודה"
                value={form.site}
                onChange={(event) => updateForm({ site: event.target.value })}
              />
              <Input
                label="שעת התחלה"
                type="time"
                value={form.start}
                onChange={(event) => updateForm({ start: event.target.value })}
                required
              />
              <Input
                label="שעת סיום"
                type="time"
                value={form.end}
                onChange={(event) => updateForm({ end: event.target.value })}
                required
              />
              <label className="reportsPage__field">
                <span>מדווח</span>
                <select
                  className="reportsPage__select"
                  value={form.reporterId}
                  onChange={(event) => {
                    const employee = employees.find((row) => String(row.employeeId) === event.target.value);
                    updateForm({
                      reporterId: event.target.value,
                      role: employee?.primaryRole || form.role,
                    });
                  }}
                  required
                >
                  <option value="">בחר מדווח</option>
                  {employees
                    .filter((employee) => employee.isActive !== false)
                    .map((employee) => (
                      <option key={employee.employeeId} value={employee.employeeId}>
                        {employee.fullName}
                      </option>
                    ))}
                </select>
              </label>
              <Input
                label="תפקיד"
                value={form.role}
                onChange={(event) => updateForm({ role: event.target.value })}
              />
            </div>
          </section>

          <section className="reportsPage__formSection">
            <h3>סיכום עבודה</h3>
            <label className="reportsPage__field">
              <span>סיכום</span>
              <textarea
                className="reportsPage__textarea"
                rows={4}
                value={form.summary}
                onChange={(event) => updateForm({ summary: event.target.value })}
                required
              />
            </label>
          </section>

          <section className="reportsPage__formSection">
            <h3>מערכות שבוצעו</h3>
            <div className="reportsPage__chips">
              {SYSTEM_OPTIONS.map((system) => (
                <button
                  key={system}
                  type="button"
                  className={`reportsPage__chip ${form.systems.includes(system) ? 'reportsPage__chip--selected' : ''}`}
                  onClick={() => toggleSystem(system)}
                >
                  {system}
                </button>
              ))}
            </div>
          </section>

          <section className="reportsPage__formSection">
            <h3>הערות</h3>
            <label className="reportsPage__field">
              <span>הערות נוספות</span>
              <textarea
                className="reportsPage__textarea"
                rows={3}
                value={form.notes}
                onChange={(event) => updateForm({ notes: event.target.value })}
              />
            </label>
            <label className="reportsPage__checkbox">
              <input
                type="checkbox"
                checked={form.followup}
                onChange={(event) => updateForm({ followup: event.target.checked })}
              />
              <span>דורש ביקור חוזר</span>
            </label>
            {form.followup && (
              <Input
                label="סיבת ביקור חוזר"
                value={form.followupReason}
                onChange={(event) => updateForm({ followupReason: event.target.value })}
              />
            )}
          </section>

          {formError && <p className="reportsPage__error">{formError}</p>}

          <div className="reportsPage__actions">
            <Button type="submit" disabled={createReport.isPending}>
              {createReport.isPending ? 'שולח...' : 'שלח דיווח'}
            </Button>
            <Button type="button" variant="secondary" onClick={closeCreateModal}>
              ביטול
            </Button>
          </div>
        </form>
      </Modal>

      <ReportDetailModal
        reportId={selectedReportId}
        isOpen={selectedReportId != null}
        onClose={() => setSelectedReportId(null)}
      />
    </PageShell>
  );
}

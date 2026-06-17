import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { StatusBadge } from '@shared/components/StatusBadge';
import { Button } from '@shared/components/Button';
import { Modal } from '@shared/components/Modal';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { Textarea } from '@shared/components/Textarea';
import { Checkbox } from '@shared/components/Checkbox';
import { InlineAlert } from '@shared/components/InlineAlert';
import { FilterBar, FilterField } from '@shared/components/FilterBar';
import { DataTable, type DataTableColumn } from '@shared/components/DataTable';
import {
  createWorkReportAsync,
  getReportEmployeesAsync,
  getReportProjectsAsync,
  getReportServiceCallsAsync,
  updateWorkReportAsync,
} from '../../api/reportsApiClient';
import { ReportDetailModal } from '../../components/ReportDetailModal';
import { useReports } from '../../hooks/useReports';
import type {
  CreateWorkReportRequest,
  ReportProjectOption,
  WorkReportDetails,
  WorkReportListItem,
} from '../../types';
import './ReportsPage.css';

const QUICK_REPORT_KEY = 'manager2_quick_report_prefill';
const SYSTEM_OPTIONS = ['חשמל חכם', 'בקרה', 'תקשורת', 'מולטימדיה', 'מצלמות ואבטחה'];
const ROLE_OPTIONS = ['מתקין', 'מנהל פרויקט', 'טכנאי'];
const LIST_STATUS_OPTIONS = ['הוגש', 'טיוטה'];

type SubmitStatus = 'הוגש' | 'טיוטה';
type ReportFormMode = 'create' | 'edit';

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
  serviceCallTitle?: string;
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
  relatedWorkerIds: string[];
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
    serviceCallTitle: prefill?.serviceCallTitle || '',
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
    relatedWorkerIds: [],
  };
}

function createFormStateFromReport(report: WorkReportDetails): ReportFormState {
  return {
    reportType: report.reportType === 'service_call' ? 'service_call' : 'project',
    date: formatReportDate(report.reportDate) || todayYmd(),
    projectId: report.projectId != null ? String(report.projectId) : '',
    customerName: report.customerName || '',
    serviceCallId: report.serviceCallId != null ? String(report.serviceCallId) : '',
    serviceCallTitle: report.serviceCallTitle || '',
    site: report.site || '',
    start: report.start || '',
    end: report.end || '',
    reporterId: report.reporterId != null ? String(report.reporterId) : '',
    role: report.role || '',
    summary: report.summary || '',
    notes: report.notes || '',
    followup: report.followUpRequired ?? false,
    followupReason: report.followUpReason || '',
    systems: report.systems,
    relatedWorkerIds: report.relatedWorkers
      .map((worker) => (worker.id != null ? String(worker.id) : ''))
      .filter(Boolean),
  };
}

function parseNullableInt(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function enrichQuickReportPrefill(
  prefill: QuickReportPrefill,
  projects: ReportProjectOption[],
): QuickReportPrefill {
  if (prefill.projectId == null) return prefill;

  const project = projects.find(
    (row) => String(row.workItemId) === String(prefill.projectId),
  );

  if (!project) return prefill;

  return {
    ...prefill,
    projectName: prefill.projectName || project.title,
    customerName: project.customerName || prefill.customerName || '',
    site: project.siteName || prefill.site || '',
  };
}

function formatReportDate(value?: string | null) {
  if (!value) return '';
  return value.split('T')[0];
}

export function ReportsPage() {
  const { data: reports, isLoading, error, refetch } = useReports();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFormMaximized, setIsFormMaximized] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [formMode, setFormMode] = useState<ReportFormMode>('create');
  const [editingReportId, setEditingReportId] = useState<number | null>(null);
  const [form, setForm] = useState<ReportFormState>(() => createInitialFormState());
  const [formError, setFormError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [workerToAddId, setWorkerToAddId] = useState('');

  // List filter state
  const [filterSearch, setFilterSearch] = useState('');
  const [filterProjectId, setFilterProjectId] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const { data: projects = [] } = useQuery({
    queryKey: ['reports', 'projects'],
    queryFn: getReportProjectsAsync,
  });

  const { data: serviceCalls = [] } = useQuery({
    queryKey: ['reports', 'serviceCalls'],
    queryFn: getReportServiceCallsAsync,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['reports', 'employees'],
    queryFn: getReportEmployeesAsync,
  });

  const selectedProject = useMemo(
    () => projects.find((project) => String(project.workItemId) === form.projectId) ?? null,
    [form.projectId, projects],
  );

  const selectedServiceCall = useMemo(
    () =>
      serviceCalls.find((serviceCall) => String(serviceCall.workItemId) === form.serviceCallId) ??
      null,
    [form.serviceCallId, serviceCalls],
  );

  const selectedReporter = useMemo(
    () => employees.find((employee) => String(employee.employeeId) === form.reporterId) ?? null,
    [employees, form.reporterId],
  );

  // Available workers for "related workers" section = active employees excluding the reporter
  const availableRelatedWorkers = useMemo(
    () =>
      employees.filter(
        (e) => e.isActive !== false && String(e.employeeId) !== form.reporterId,
      ),
    [employees, form.reporterId],
  );

  const selectedRelatedWorkers = useMemo(
    () =>
      form.relatedWorkerIds
        .map((id) => employees.find((e) => String(e.employeeId) === id))
        .filter((e): e is NonNullable<typeof e> => e != null),
    [form.relatedWorkerIds, employees],
  );

  // Distinct customer names present in the loaded reports (client-side filter source)
  const customerOptions = useMemo(() => {
    if (!reports) return [];
    const names = new Set<string>();
    reports.forEach((r) => {
      if (r.customerName) names.add(r.customerName);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'he'));
  }, [reports]);

  // Filtered reports list — all filters are client-side, no new API calls
  const filteredReports = useMemo(() => {
    if (!reports) return [];
    return reports.filter((r) => {
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        const matchesSearch =
          (r.projectTitle ?? '').toLowerCase().includes(q) ||
          (r.reportedByName ?? '').toLowerCase().includes(q) ||
          (r.customerName ?? '').toLowerCase().includes(q) ||
          String(r.reportId).includes(q);
        if (!matchesSearch) return false;
      }
      if (filterProjectId) {
        const selectedTitle =
          projects.find((p) => String(p.workItemId) === filterProjectId)?.title ?? '';
        if (r.projectTitle !== selectedTitle) return false;
      }
      if (filterCustomer && (r.customerName ?? '') !== filterCustomer) return false;
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterDateFrom && r.reportDate) {
        if (formatReportDate(r.reportDate) < filterDateFrom) return false;
      }
      if (filterDateTo && r.reportDate) {
        if (formatReportDate(r.reportDate) > filterDateTo) return false;
      }
      return true;
    });
  }, [
    reports,
    filterSearch,
    filterProjectId,
    filterCustomer,
    filterStatus,
    filterDateFrom,
    filterDateTo,
    projects,
  ]);

  useEffect(() => {
    if (searchParams.get('quick') !== '1') return;

    const rawPrefill = sessionStorage.getItem(QUICK_REPORT_KEY);
    if (!rawPrefill) return;

    try {
      const prefill = JSON.parse(rawPrefill) as QuickReportPrefill;
      if (prefill.projectId != null && projects.length === 0) return;
      const enrichedPrefill = enrichQuickReportPrefill(prefill, projects);

      window.setTimeout(() => {
        setForm(createInitialFormState(enrichedPrefill));
        setFormMode('create');
        setEditingReportId(null);
        setIsCreateOpen(true);
        sessionStorage.removeItem(QUICK_REPORT_KEY);
        navigate('/reports', { replace: true });
      }, 0);
    } catch {
      sessionStorage.removeItem(QUICK_REPORT_KEY);
    }
  }, [navigate, projects, searchParams]);

  function openCreateModal() {
    setForm(createInitialFormState());
    setFormMode('create');
    setEditingReportId(null);
    setWorkerToAddId('');
    setFormError(null);
    setPageMessage(null);
    setIsCreateOpen(true);
  }

  function closeCreateModal() {
    setFormError(null);
    setIsFormMaximized(false);
    setIsCreateOpen(false);
  }

  function openEditModal(report: WorkReportDetails) {
    setSelectedReportId(null);
    setForm(createFormStateFromReport(report));
    setFormMode('edit');
    setEditingReportId(report.reportId);
    setWorkerToAddId('');
    setFormError(null);
    setPageMessage(null);
    setIsCreateOpen(true);
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

  function handleServiceCallChange(serviceCallId: string) {
    const serviceCall = serviceCalls.find((row) => String(row.workItemId) === serviceCallId);
    updateForm({
      serviceCallId,
      serviceCallTitle: serviceCall?.title || '',
      projectId: serviceCallId,
      customerName: serviceCall?.customerName || '',
      site: serviceCall?.siteName || '',
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

  function handleAddRelatedWorker() {
    if (!workerToAddId || form.relatedWorkerIds.includes(workerToAddId)) return;
    updateForm({ relatedWorkerIds: [...form.relatedWorkerIds, workerToAddId] });
    setWorkerToAddId('');
  }

  function handleRemoveRelatedWorker(employeeId: string) {
    updateForm({
      relatedWorkerIds: form.relatedWorkerIds.filter((id) => id !== employeeId),
    });
  }

  const saveReport = useMutation({
    mutationFn: async (submitStatus: SubmitStatus) => {
      const isDraft = submitStatus === 'טיוטה';

      if (!form.date) throw new Error('יש להזין תאריך דיווח');
      if (!isDraft) {
        if (form.reportType === 'project' && !form.projectId) throw new Error('יש לבחור פרויקט');
        if (form.reportType === 'service_call' && !form.serviceCallId) {
          throw new Error('יש לבחור קריאת שירות');
        }
        if (!form.reporterId) throw new Error('יש לבחור מדווח');
        if (!form.start || !form.end) throw new Error('יש להזין שעות עבודה');
        if (!form.summary.trim()) throw new Error('יש להזין סיכום עבודה');
      }

      const linkedWorkItemId =
        form.reportType === 'service_call'
          ? parseNullableInt(form.serviceCallId)
          : parseNullableInt(form.projectId);

      const payload: CreateWorkReportRequest = {
        reportType: form.reportType,
        date: form.date,
        // Backend currently names this ProjectId, but it is the WorkReports.WorkItemId link.
        projectId: linkedWorkItemId,
        projectName:
          form.reportType === 'service_call'
            ? selectedServiceCall?.title || form.serviceCallTitle || null
            : selectedProject?.title || null,
        customerName:
          form.customerName ||
          selectedServiceCall?.customerName ||
          selectedProject?.customerName ||
          null,
        serviceCallId: form.reportType === 'service_call' ? linkedWorkItemId : null,
        serviceCallTitle:
          form.reportType === 'service_call'
            ? selectedServiceCall?.title || form.serviceCallTitle || null
            : null,
        site: form.site || null,
        start: form.start || null,
        end: form.end || null,
        summary: form.summary.trim() || null,
        notes: form.notes || null,
        reporterId: parseNullableInt(form.reporterId),
        reporterName: selectedReporter?.fullName || null,
        role: form.role || selectedReporter?.primaryRole || null,
        status: submitStatus,
        systems: form.systems,
        relatedWorkers: form.relatedWorkerIds.map((id) => {
          const emp = employees.find((e) => String(e.employeeId) === id);
          return { id: emp?.employeeId ?? null, name: emp?.fullName ?? null };
        }),
        followup: form.followup,
        followupReason: form.followup ? form.followupReason || null : null,
      };

      if (formMode === 'edit') {
        if (editingReportId == null) throw new Error('לא נבחר דיווח לעריכה');
        return updateWorkReportAsync(editingReportId, payload);
      }

      return createWorkReportAsync(payload);
    },
    onSuccess: async () => {
      setIsCreateOpen(false);
      setIsFormMaximized(false);
      setForm(createInitialFormState());
      setFormMode('create');
      setEditingReportId(null);
      setWorkerToAddId('');
      setFormError(null);
      setPageMessage(formMode === 'edit' ? 'הדיווח עודכן בהצלחה.' : 'הדיווח נשמר בהצלחה.');
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : 'שמירת הדיווח נכשלה');
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

  const reportColumns: DataTableColumn<WorkReportListItem>[] = [
    { id: 'date', header: 'תאריך', cell: (r) => formatReportDate(r.reportDate) || '—' },
    { id: 'number', header: 'מס׳ דיווח', cell: (r) => `#${r.reportId}` },
    { id: 'project', header: 'פרויקט', cell: (r) => r.projectTitle ?? '—' },
    { id: 'customer', header: 'לקוח', cell: (r) => r.customerName ?? '—' },
    { id: 'reporter', header: 'מדווח', cell: (r) => r.reportedByName ?? '—' },
    {
      id: 'status',
      header: 'סטטוס',
      cell: (r) => <StatusBadge domain="report" status={r.status} />,
    },
  ];

  return (
    <PageShell title="דיווחים">
      {pageMessage && (
        <InlineAlert variant="success" onDismiss={() => setPageMessage(null)}>
          {pageMessage}
        </InlineAlert>
      )}

      <FilterBar
        actions={
          <Button type="button" iconStart={<Plus size={18} />} onClick={openCreateModal}>
            דיווח חדש
          </Button>
        }
      >
        <FilterField label="חיפוש" grow>
          <Input
            type="search"
            placeholder="פרויקט, לקוח, מדווח או מס׳ דיווח"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
          />
        </FilterField>
        <FilterField label="פרויקט">
          <Select value={filterProjectId} onChange={(e) => setFilterProjectId(e.target.value)}>
            <option value="">הכל</option>
            {projects.map((p) => (
              <option key={p.workItemId} value={String(p.workItemId)}>
                {p.title}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="לקוח">
          <Select value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)}>
            <option value="">הכל</option>
            {customerOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="סטטוס">
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">הכל</option>
            {LIST_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="מתאריך">
          <Input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
          />
        </FilterField>
        <FilterField label="עד תאריך">
          <Input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
          />
        </FilterField>
      </FilterBar>

      <DataTable
        columns={reportColumns}
        rows={filteredReports}
        getRowId={(r) => r.reportId}
        onRowClick={(r) => setSelectedReportId(r.reportId)}
        selectedRowId={selectedReportId}
        emptyTitle={reports?.length ? 'לא נמצאו דיווחים לפי הסינון הנוכחי' : 'אין דיווחים'}
      />

      <Modal
        isOpen={isCreateOpen}
        onClose={closeCreateModal}
        title={formMode === 'edit' ? `עריכת דיווח #${editingReportId}` : 'דיווח חדש'}
        isMaximized={isFormMaximized}
        onToggleMaximize={() => setIsFormMaximized((value) => !value)}
      >
        <form
          className="reportsPage__form"
          onSubmit={(event) => {
            event.preventDefault();
            saveReport.mutate('הוגש');
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
                  onChange={() =>
                    updateForm({
                      reportType: 'project',
                      serviceCallId: '',
                      serviceCallTitle: '',
                      customerName: selectedProject?.customerName || '',
                      site: selectedProject?.siteName || '',
                    })
                  }
                />
                <span>פרויקט</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="report-type"
                  checked={form.reportType === 'service_call'}
                  onChange={() =>
                    updateForm({
                      reportType: 'service_call',
                      projectId: '',
                      customerName: '',
                      site: '',
                    })
                  }
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
                <Select
                  label="פרויקט"
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
                </Select>
              ) : (
                <Select
                  label="קריאת שירות"
                  value={form.serviceCallId}
                  onChange={(event) => handleServiceCallChange(event.target.value)}
                  required
                >
                  <option value="">בחר קריאת שירות</option>
                  {serviceCalls.map((serviceCall) => (
                    <option key={serviceCall.workItemId} value={serviceCall.workItemId}>
                      {serviceCall.title}
                    </option>
                  ))}
                </Select>
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
              <Select
                label="מדווח"
                value={form.reporterId}
                onChange={(event) => {
                  const employee = employees.find(
                    (row) => String(row.employeeId) === event.target.value,
                  );
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
              </Select>
              <Select
                label="תפקיד"
                value={form.role}
                onChange={(event) => updateForm({ role: event.target.value })}
              >
                <option value="">בחר תפקיד</option>
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </Select>
            </div>
          </section>

          <section className="reportsPage__formSection">
            <h3>סיכום עבודה</h3>
            <Textarea
              label="סיכום"
              rows={4}
              value={form.summary}
              onChange={(event) => updateForm({ summary: event.target.value })}
              required
            />
          </section>

          <section className="reportsPage__formSection">
            <h3>מערכות שבוצעו</h3>
            <div className="reportsPage__chips">
              {SYSTEM_OPTIONS.map((system) => (
                <button
                  key={system}
                  type="button"
                  className={`reportsPage__chip ${
                    form.systems.includes(system) ? 'reportsPage__chip--selected' : ''
                  }`}
                  onClick={() => toggleSystem(system)}
                >
                  {system}
                </button>
              ))}
            </div>
          </section>

          <section className="reportsPage__formSection">
            <h3>עובדים קשורים</h3>
            <div className="reportsPage__workerAdd">
              <Select
                className="reportsPage__workerSelect"
                value={workerToAddId}
                onChange={(e) => setWorkerToAddId(e.target.value)}
                aria-label="בחר עובד להוספה"
              >
                <option value="">בחר עובד</option>
                {availableRelatedWorkers
                  .filter((e) => !form.relatedWorkerIds.includes(String(e.employeeId)))
                  .map((e) => (
                    <option key={e.employeeId} value={String(e.employeeId)}>
                      {e.fullName}
                    </option>
                  ))}
              </Select>
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddRelatedWorker}
                disabled={!workerToAddId}
              >
                הוסף
              </Button>
            </div>
            {selectedRelatedWorkers.length > 0 && (
              <div className="reportsPage__workerChips">
                {selectedRelatedWorkers.map((emp) => (
                  <span key={emp.employeeId} className="reportsPage__workerChip">
                    {emp.fullName}
                    <button
                      type="button"
                      className="reportsPage__workerChipRemove"
                      onClick={() => handleRemoveRelatedWorker(String(emp.employeeId))}
                      aria-label={`הסר ${emp.fullName}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="reportsPage__formSection">
            <h3>הערות</h3>
            <Textarea
              label="הערות נוספות"
              rows={3}
              value={form.notes}
              onChange={(event) => updateForm({ notes: event.target.value })}
            />
            <Checkbox
              label="דורש ביקור חוזר"
              checked={form.followup}
              onChange={(event) => updateForm({ followup: event.target.checked })}
            />
            {form.followup && (
              <Input
                label="סיבת ביקור חוזר"
                value={form.followupReason}
                onChange={(event) => updateForm({ followupReason: event.target.value })}
              />
            )}
          </section>

          <div className="reportsPage__formFooter">
            {formError && <InlineAlert variant="danger">{formError}</InlineAlert>}
            <div className="reportsPage__actions">
              <Button type="submit" isLoading={saveReport.isPending}>
                {formMode === 'edit' ? 'שמור שינויים' : 'שלח דיווח'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => saveReport.mutate('טיוטה')}
                disabled={saveReport.isPending}
              >
                שמור טיוטה
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={closeCreateModal}
                disabled={saveReport.isPending}
              >
                ביטול
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      <ReportDetailModal
        reportId={selectedReportId}
        isOpen={selectedReportId != null}
        onClose={() => setSelectedReportId(null)}
        onEdit={openEditModal}
        onDeleted={async () => {
          setSelectedReportId(null);
          setPageMessage('הדיווח נמחק בהצלחה.');
          await queryClient.invalidateQueries({ queryKey: ['reports'] });
        }}
      />
    </PageShell>
  );
}

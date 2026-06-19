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
import { SegmentedControl, type SegmentItem } from '@shared/components/SegmentedControl';
import { DataTable, type DataTableColumn } from '@shared/components/DataTable';
import {
  canEditReportAttachments,
  canEditReportInventory,
} from '@shared/constants/reportLifecycle';
import { useEmployeePrimaryRoles } from '@features/employees/hooks/useEmployeePrimaryRoles';
import {
  addReportInventoryLineAsync,
  createWorkReportAsync,
  filterReportTargetsByType,
  formatReportTargetLabel,
  getReportEmployeesAsync,
  getReportTargetsAsync,
  REPORT_TARGETS_QUERY_KEY,
  REPORTS_INVALIDATION,
  updateWorkReportAsync,
  uploadReportAttachmentAsync,
} from '../../api/reportsApiClient';
import { ReportDetailModal } from '../../components/ReportDetailModal';
import {
  ReportFormAttachmentsSection,
  type PendingAttachment,
} from '../../components/ReportFormAttachmentsSection';
import {
  ReportFormInventorySection,
  type PendingInventoryLine,
} from '../../components/ReportFormInventorySection';
import { useReportDetail, useReports } from '../../hooks/useReports';
import type {
  CreateWorkReportRequest,
  WorkItemReportTarget,
  WorkReportDetails,
  WorkReportListItem,
} from '../../types';
import './ReportsPage.css';

const QUICK_REPORT_KEY = 'manager2_quick_report_prefill';
const LIST_STATUS_OPTIONS = ['הוגש', 'טיוטה'];
const STATUS_FILTER_ITEMS: SegmentItem<string>[] = [
  { id: '', label: 'הכול' },
  ...LIST_STATUS_OPTIONS.map((status) => ({ id: status, label: status })),
];

const REPORT_TARGET_TYPE_ITEMS: SegmentItem<ReportTypeValue>[] = [
  { id: 'regular', label: 'דיווח למשימה רגילה' },
  { id: 'project', label: 'דיווח למשימת פרויקט' },
  { id: 'service_call', label: 'דיווח לקריאת שירות' },
];

const REPORT_TARGET_EMPTY_MESSAGES: Record<ReportTypeValue, string> = {
  regular: 'אין משימות רגילות זמינות לדיווח.',
  project: 'אין משימות פרויקט זמינות לדיווח.',
  service_call: 'אין קריאות שירות זמינות לדיווח.',
};

type SubmitStatus = 'הוגש' | 'טיוטה';
type ReportFormMode = 'create' | 'edit';
type ReportTypeValue = 'regular' | 'project' | 'service_call';

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
  reportTargetType: ReportTypeValue;
  reportType: ReportTypeValue;
  workItemId: string;
  date: string;
  projectId: string;
  customerName: string;
  site: string;
  start: string;
  end: string;
  reporterId: string;
  role: string;
  summary: string;
  notes: string;
  followup: boolean;
  followupReason: string;
  relatedWorkerIds: string[];
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function taskCategoryToReportType(taskCategory: string): ReportTypeValue {
  if (taskCategory === 'ServiceCall') return 'service_call';
  if (taskCategory === 'Project') return 'project';
  return 'regular';
}

function reportTypeFromDetails(report: WorkReportDetails): ReportTypeValue {
  if (report.reportType === 'service_call') return 'service_call';
  if (report.reportType === 'regular') return 'regular';
  return 'project';
}

function resolveWorkItemIdFromReport(report: WorkReportDetails): string {
  if (report.serviceCallId != null) return String(report.serviceCallId);
  if (report.projectId != null) return String(report.projectId);
  return '';
}

function createInitialFormState(prefill?: QuickReportPrefill | null): ReportFormState {
  const workItemId =
    prefill?.serviceCallId != null
      ? String(prefill.serviceCallId)
      : prefill?.projectId != null
        ? String(prefill.projectId)
        : '';

  const reportTargetType: ReportTypeValue = prefill?.serviceCallId
    ? 'service_call'
    : prefill?.projectId
      ? 'project'
      : 'regular';

  return {
    reportTargetType,
    reportType: reportTargetType,
    workItemId,
    date: prefill?.date || todayYmd(),
    projectId: '',
    customerName: prefill?.customerName || '',
    site: prefill?.site || '',
    start: prefill?.start || '',
    end: prefill?.end || '',
    reporterId: prefill?.reporterId != null ? String(prefill.reporterId) : '',
    role: prefill?.reporterRole || '',
    summary: '',
    notes: '',
    followup: false,
    followupReason: '',
    relatedWorkerIds: [],
  };
}

function createFormStateFromReport(report: WorkReportDetails): ReportFormState {
  const reportType = reportTypeFromDetails(report);
  return {
    reportTargetType: reportType,
    reportType,
    workItemId: resolveWorkItemIdFromReport(report),
    date: formatReportDate(report.reportDate) || todayYmd(),
    projectId: '',
    customerName: report.customerName || '',
    site: report.site || '',
    start: report.start || '',
    end: report.end || '',
    reporterId: report.reporterId != null ? String(report.reporterId) : '',
    role: report.role || '',
    summary: report.summary || '',
    notes: report.notes || '',
    followup: report.followUpRequired ?? false,
    followupReason: report.followUpReason || '',
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
  targets: WorkItemReportTarget[],
): QuickReportPrefill {
  const workItemId = prefill.serviceCallId ?? prefill.projectId;
  if (workItemId == null) return prefill;

  const target = targets.find((row) => String(row.workItemId) === String(workItemId));
  if (!target) return prefill;

  return {
    ...prefill,
    projectName: prefill.projectName || target.title,
  };
}

function formatReportDate(value?: string | null) {
  if (!value) return '';
  return value.split('T')[0];
}

function applyTargetToForm(
  target: WorkItemReportTarget | null,
  reportTargetType: ReportTypeValue,
): Partial<ReportFormState> {
  if (!target) {
    return {
      workItemId: '',
      reportType: reportTargetType,
      projectId: '',
    };
  }

  const reportType = taskCategoryToReportType(target.taskCategory);
  return {
    workItemId: String(target.workItemId),
    reportType,
    projectId:
      reportType === 'project' && target.projectId != null ? String(target.projectId) : '',
  };
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
  const [pendingInventoryLines, setPendingInventoryLines] = useState<PendingInventoryLine[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [workerToAddId, setWorkerToAddId] = useState('');
  const [targetSearchQuery, setTargetSearchQuery] = useState('');

  const [filterSearch, setFilterSearch] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const reportTargetsQuery = useQuery({
    queryKey: REPORT_TARGETS_QUERY_KEY,
    queryFn: getReportTargetsAsync,
    enabled: isCreateOpen,
    retry: false,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['reports', 'employees'],
    queryFn: getReportEmployeesAsync,
    enabled: isCreateOpen,
  });

  const primaryRolesQuery = useEmployeePrimaryRoles(isCreateOpen);

  const editReportQuery = useReportDetail(
    editingReportId,
    isCreateOpen && formMode === 'edit',
  );

  const editingReport = editReportQuery.data;
  const reportTargets = reportTargetsQuery.data;
  const primaryRoles = primaryRolesQuery.data ?? [];

  const targetsForSelectedType = useMemo(() => {
    if (!reportTargets) return [];
    return filterReportTargetsByType(reportTargets, form.reportTargetType);
  }, [form.reportTargetType, reportTargets]);

  const visibleTargets = useMemo(() => {
    const query = targetSearchQuery.trim().toLowerCase();
    if (!query) return targetsForSelectedType;
    return targetsForSelectedType.filter((target) =>
      formatReportTargetLabel(target).toLowerCase().includes(query),
    );
  }, [targetSearchQuery, targetsForSelectedType]);

  const selectedTarget = useMemo(() => {
    if (!reportTargets || !form.workItemId) return null;
    return (
      reportTargets.find((target) => String(target.workItemId) === form.workItemId) ?? null
    );
  }, [form.workItemId, reportTargets]);

  const selectedReporter = useMemo(
    () => employees.find((employee) => String(employee.employeeId) === form.reporterId) ?? null,
    [employees, form.reporterId],
  );

  const availableRelatedWorkers = useMemo(
    () =>
      employees.filter(
        (employee) => employee.isActive !== false && String(employee.employeeId) !== form.reporterId,
      ),
    [employees, form.reporterId],
  );

  const selectedRelatedWorkers = useMemo(
    () =>
      form.relatedWorkerIds
        .map((id) => employees.find((employee) => String(employee.employeeId) === id))
        .filter((employee): employee is NonNullable<typeof employee> => employee != null),
    [form.relatedWorkerIds, employees],
  );

  const canEditInventory = formMode === 'create'
    ? true
    : canEditReportInventory(editingReport?.lifecycleStatus);

  const canEditAttachments = formMode === 'create'
    ? true
    : canEditReportAttachments(editingReport?.lifecycleStatus);

  const customerOptions = useMemo(() => {
    if (!reports) return [];
    const names = new Set<string>();
    reports.forEach((report) => {
      if (report.customerName) names.add(report.customerName);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'he'));
  }, [reports]);

  const filteredReports = useMemo(() => {
    if (!reports) return [];
    return reports.filter((report) => {
      if (filterSearch) {
        const query = filterSearch.toLowerCase();
        const matchesSearch =
          (report.projectTitle ?? '').toLowerCase().includes(query) ||
          (report.reportedByName ?? '').toLowerCase().includes(query) ||
          (report.customerName ?? '').toLowerCase().includes(query) ||
          String(report.reportId).includes(query);
        if (!matchesSearch) return false;
      }
      if (filterCustomer && (report.customerName ?? '') !== filterCustomer) return false;
      if (filterStatus && report.status !== filterStatus) return false;
      return true;
    });
  }, [reports, filterSearch, filterCustomer, filterStatus]);

  const hasActiveFilters =
    Boolean(filterSearch.trim()) || Boolean(filterCustomer) || Boolean(filterStatus);

  const resetFilters = () => {
    setFilterSearch('');
    setFilterCustomer('');
    setFilterStatus('');
  };

  useEffect(() => {
    if (searchParams.get('quick') !== '1') return;

    const rawPrefill = sessionStorage.getItem(QUICK_REPORT_KEY);
    if (!rawPrefill) return;

    try {
      const prefill = JSON.parse(rawPrefill) as QuickReportPrefill;
      const workItemId = prefill.serviceCallId ?? prefill.projectId;
      if (workItemId != null && reportTargets == null) return;

      const enrichedPrefill = enrichQuickReportPrefill(prefill, reportTargets ?? []);
      const initial = createInitialFormState(enrichedPrefill);
      const target =
        reportTargets?.find((row) => String(row.workItemId) === initial.workItemId) ?? null;

      window.setTimeout(() => {
        setForm({
          ...initial,
          ...applyTargetToForm(target, initial.reportTargetType),
        });
        setTargetSearchQuery('');
        setPendingInventoryLines([]);
        setPendingAttachments([]);
        setFormMode('create');
        setEditingReportId(null);
        setIsCreateOpen(true);
        sessionStorage.removeItem(QUICK_REPORT_KEY);
        navigate('/reports', { replace: true });
      }, 0);
    } catch {
      sessionStorage.removeItem(QUICK_REPORT_KEY);
    }
  }, [navigate, reportTargets, searchParams]);

  function resetFormState() {
    setForm(createInitialFormState());
    setTargetSearchQuery('');
    setPendingInventoryLines([]);
    setPendingAttachments([]);
    setFormMode('create');
    setEditingReportId(null);
    setWorkerToAddId('');
    setFormError(null);
  }

  function openCreateModal() {
    resetFormState();
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
    setTargetSearchQuery('');
    setPendingInventoryLines([]);
    setPendingAttachments([]);
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

  function handleReportTargetTypeChange(reportTargetType: ReportTypeValue) {
    setTargetSearchQuery('');
    updateForm({
      reportTargetType,
      reportType: reportTargetType,
      workItemId: '',
      projectId: '',
      customerName: '',
      site: '',
    });
  }

  function handleTargetChange(workItemId: string) {
    const target =
      reportTargets?.find((row) => String(row.workItemId) === workItemId) ?? null;
    updateForm(applyTargetToForm(target, form.reportTargetType));
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

  async function invalidateEditingReportDetail() {
    if (editingReportId == null) return;
    await queryClient.invalidateQueries({
      queryKey: REPORTS_INVALIDATION.detail(editingReportId),
    });
  }

  const saveReport = useMutation({
    mutationFn: async (submitStatus: SubmitStatus) => {
      const isDraft = submitStatus === 'טיוטה';
      const workItemId = parseNullableInt(form.workItemId);

      if (!form.date) throw new Error('יש להזין תאריך דיווח');
      if (!isDraft) {
        if (!workItemId) throw new Error('יש לבחור משימה או קריאת שירות');
        if (!form.reporterId) throw new Error('יש לבחור מדווח');
        if (!form.start || !form.end) throw new Error('יש להזין שעות עבודה');
        if (!form.summary.trim()) throw new Error('יש להזין סיכום עבודה');
      }

      const parentProjectId =
        form.reportType === 'project'
          ? parseNullableInt(form.projectId) ?? selectedTarget?.projectId ?? null
          : null;

      const payload: CreateWorkReportRequest = {
        reportType: form.reportType,
        date: form.date,
        workItemId,
        projectId: form.reportType === 'regular' ? null : parentProjectId,
        projectName:
          form.reportType === 'service_call'
            ? null
            : selectedTarget?.title || null,
        customerName: form.customerName || null,
        serviceCallId: form.reportType === 'service_call' ? workItemId : null,
        serviceCallTitle:
          form.reportType === 'service_call' ? selectedTarget?.title || null : null,
        site: form.site || null,
        start: form.start || null,
        end: form.end || null,
        summary: form.summary.trim() || null,
        notes: form.notes || null,
        reporterId: parseNullableInt(form.reporterId),
        reporterName: selectedReporter?.fullName || null,
        role: form.role || selectedReporter?.primaryRole || null,
        status: submitStatus,
        systems: [],
        relatedWorkers: form.relatedWorkerIds.map((id) => {
          const employee = employees.find((row) => String(row.employeeId) === id);
          return { id: employee?.employeeId ?? null, name: employee?.fullName ?? null };
        }),
        followup: form.followup,
        followupReason: form.followup ? form.followupReason || null : null,
      };

      if (formMode === 'edit') {
        if (editingReportId == null) throw new Error('לא נבחר דיווח לעריכה');
        return updateWorkReportAsync(editingReportId, payload);
      }

      const created = await createWorkReportAsync(payload);

      for (const line of pendingInventoryLines) {
        await addReportInventoryLineAsync(created.workReportId, {
          inventoryItemId: line.inventoryItemId,
          quantity: line.quantity,
          usageType: line.usageType,
        });
      }

      for (const attachment of pendingAttachments) {
        await uploadReportAttachmentAsync(created.workReportId, attachment.file);
      }

      return created;
    },
    onSuccess: async () => {
      setIsCreateOpen(false);
      setIsFormMaximized(false);
      resetFormState();
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
    { id: 'date', header: 'תאריך', cell: (report) => formatReportDate(report.reportDate) || '—' },
    { id: 'number', header: 'מס׳ דיווח', cell: (report) => `#${report.reportId}` },
    { id: 'project', header: 'פרויקט', cell: (report) => report.projectTitle ?? '—' },
    { id: 'customer', header: 'לקוח', cell: (report) => report.customerName ?? '—' },
    { id: 'reporter', header: 'מדווח', cell: (report) => report.reportedByName ?? '—' },
    {
      id: 'status',
      header: 'סטטוס',
      cell: (report) => <StatusBadge domain="report" status={report.status} />,
    },
  ];

  const legacySystems = editingReport?.systems ?? [];

  return (
    <PageShell title="דיווחים">
      {pageMessage && (
        <InlineAlert variant="success" onDismiss={() => setPageMessage(null)}>
          {pageMessage}
        </InlineAlert>
      )}

      <FilterBar
        actions={
          <>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" onClick={resetFilters}>
                נקה סינון
              </Button>
            )}
            <Button type="button" iconStart={<Plus size={18} />} onClick={openCreateModal}>
              דיווח חדש
            </Button>
          </>
        }
      >
        <FilterField label="חיפוש" grow>
          <Input
            type="search"
            placeholder="פרויקט, לקוח, מדווח או מס׳ דיווח"
            value={filterSearch}
            onChange={(event) => setFilterSearch(event.target.value)}
          />
        </FilterField>
        <FilterField label="סטטוס">
          <SegmentedControl
            items={STATUS_FILTER_ITEMS}
            value={filterStatus}
            onChange={setFilterStatus}
            ariaLabel="סינון לפי סטטוס"
            size="sm"
          />
        </FilterField>
        <FilterField label="לקוח">
          <Select value={filterCustomer} onChange={(event) => setFilterCustomer(event.target.value)}>
            <option value="">הכל</option>
            {customerOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      <DataTable
        columns={reportColumns}
        rows={filteredReports}
        getRowId={(report) => report.reportId}
        onRowClick={(report) => setSelectedReportId(report.reportId)}
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
        {formMode === 'edit' && editReportQuery.isLoading && <PageSpinner />}
        {formMode === 'edit' && editReportQuery.error && (
          <ErrorState
            message={
              editReportQuery.error instanceof Error
                ? editReportQuery.error.message
                : 'טעינת הדיווח נכשלה'
            }
            onRetry={() => void editReportQuery.refetch()}
          />
        )}

        {(formMode === 'create' || (!editReportQuery.isLoading && !editReportQuery.error)) && (
          <form
            className="reportsPage__form"
            onSubmit={(event) => {
              event.preventDefault();
              saveReport.mutate('הוגש');
            }}
          >
            <section className="reportsPage__formSection">
              <h3>פרטי דיווח</h3>

              {reportTargetsQuery.isLoading && <PageSpinner />}
              {reportTargetsQuery.error && (
                <ErrorState
                  message={
                    reportTargetsQuery.error instanceof Error
                      ? reportTargetsQuery.error.message
                      : 'טעינת יעדי דיווח נכשלה'
                  }
                  onRetry={() => void reportTargetsQuery.refetch()}
                />
              )}

              {!reportTargetsQuery.isLoading && !reportTargetsQuery.error && (
                <div className="reportsPage__targetSelection">
                  <div className="reportsPage__targetType">
                    <span className="reportsPage__targetTypeLabel">סוג דיווח</span>
                    <SegmentedControl
                      items={REPORT_TARGET_TYPE_ITEMS}
                      value={form.reportTargetType}
                      onChange={handleReportTargetTypeChange}
                      ariaLabel="סוג יעד דיווח"
                    />
                  </div>

                  {targetsForSelectedType.length === 0 ? (
                    <InlineAlert variant="warning">
                      {REPORT_TARGET_EMPTY_MESSAGES[form.reportTargetType]}
                    </InlineAlert>
                  ) : (
                    <div className="reportsPage__targetSelect">
                      <Input
                        type="search"
                        label="חיפוש יעד"
                        placeholder="חפש לפי שם משימה או הקשר"
                        value={targetSearchQuery}
                        onChange={(event) => setTargetSearchQuery(event.target.value)}
                      />
                      <Select
                        label={
                          form.reportTargetType === 'regular'
                            ? 'משימה רגילה'
                            : form.reportTargetType === 'project'
                              ? 'משימת פרויקט'
                              : 'קריאת שירות'
                        }
                        value={form.workItemId}
                        onChange={(event) => handleTargetChange(event.target.value)}
                        required
                      >
                        <option value="">בחר יעד דיווח</option>
                        {visibleTargets.map((target) => (
                          <option key={target.workItemId} value={target.workItemId}>
                            {formatReportTargetLabel(target)}
                          </option>
                        ))}
                      </Select>
                      {targetSearchQuery.trim() && visibleTargets.length === 0 && (
                        <InlineAlert variant="warning">
                          לא נמצאו יעדים התואמים לחיפוש הנוכחי.
                        </InlineAlert>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="reportsPage__grid">
                <Input
                  label="תאריך"
                  type="date"
                  value={form.date}
                  onChange={(event) => updateForm({ date: event.target.value })}
                  required
                />
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
                  disabled={primaryRolesQuery.isLoading || primaryRolesQuery.isError}
                >
                  <option value="">
                    {primaryRolesQuery.isLoading
                      ? 'טוען תפקידים…'
                      : primaryRolesQuery.isError
                        ? 'טעינת תפקידים נכשלה'
                        : 'בחר תפקיד'}
                  </option>
                  {primaryRolesQuery.isError && (
                    <option value="" disabled>
                      יש לפרוס את sp_Employees_GetDistinctPrimaryRoles
                    </option>
                  )}
                  {primaryRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </Select>
                {primaryRolesQuery.isError && (
                  <InlineAlert variant="danger">
                    {primaryRolesQuery.error instanceof Error
                      ? primaryRolesQuery.error.message
                      : 'טעינת תפקידים נכשלה. יש לפרוס את sp_Employees_GetDistinctPrimaryRoles בבסיס הנתונים.'}
                  </InlineAlert>
                )}
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

            <ReportFormInventorySection
              canEdit={canEditInventory}
              reportId={formMode === 'edit' ? editingReportId : null}
              pendingLines={pendingInventoryLines}
              onPendingLinesChange={setPendingInventoryLines}
              savedLines={editingReport?.inventoryLines}
              onSavedLinesChange={() => void invalidateEditingReportDetail()}
            />

            {formMode === 'edit' && legacySystems.length > 0 && (
              <section className="reportsPage__formSection">
                <h3>מערכות (legacy)</h3>
                <div className="reportsPage__chips">
                  {legacySystems.map((system) => (
                    <span key={system} className="reportsPage__chip reportsPage__chip--selected">
                      {system}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <ReportFormAttachmentsSection
              canEdit={canEditAttachments}
              reportId={formMode === 'edit' ? editingReportId : null}
              pendingAttachments={pendingAttachments}
              onPendingAttachmentsChange={setPendingAttachments}
              savedAttachments={editingReport?.attachments}
              onSavedAttachmentsChange={() => void invalidateEditingReportDetail()}
            />

            <section className="reportsPage__formSection">
              <h3>עובדים קשורים</h3>
              <div className="reportsPage__workerAdd">
                <Select
                  className="reportsPage__workerSelect"
                  value={workerToAddId}
                  onChange={(event) => setWorkerToAddId(event.target.value)}
                  aria-label="בחר עובד להוספה"
                >
                  <option value="">בחר עובד</option>
                  {availableRelatedWorkers
                    .filter((employee) => !form.relatedWorkerIds.includes(String(employee.employeeId)))
                    .map((employee) => (
                      <option key={employee.employeeId} value={String(employee.employeeId)}>
                        {employee.fullName}
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
                  {selectedRelatedWorkers.map((employee) => (
                    <span key={employee.employeeId} className="reportsPage__workerChip">
                      {employee.fullName}
                      <button
                        type="button"
                        className="reportsPage__workerChipRemove"
                        onClick={() => handleRemoveRelatedWorker(String(employee.employeeId))}
                        aria-label={`הסר ${employee.fullName}`}
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
        )}
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

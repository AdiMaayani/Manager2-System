import { useMemo, useState } from 'react';
import { Badge } from '@shared/components/Badge';
import { StatusBadge } from '@shared/components/StatusBadge';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { Textarea } from '@shared/components/Textarea';
import { ConfirmInline } from '@shared/components/ConfirmInline';
import { InlineAlert } from '@shared/components/InlineAlert';
import { PageSpinner } from '@shared/components/PageSpinner';
import { useProjectMilestones } from '../../../../hooks/useProjectLifecycle';
import type {
  CreateMilestoneRequest,
  ProjectEmployeeOption,
  ProjectLifecycle,
  ProjectMilestone,
  ProjectMilestoneForm,
  UpdateMilestoneRequest,
} from '../../../../types';
import {
  MILESTONE_STATUS_OPTIONS,
  createEmptyMilestoneForm,
  formatProjectDate,
  toDateInputValue,
} from '../../../../utils/projectDisplayUtils';
import './ProjectMilestonesTab.css';

interface ProjectMilestonesTabProps {
  projectId: number | null;
  lifecycle: ProjectLifecycle | null;
  employees: ProjectEmployeeOption[];
  onCreateMilestone: (body: CreateMilestoneRequest) => Promise<void>;
  onUpdateMilestone: (milestoneId: number, body: UpdateMilestoneRequest) => Promise<void>;
  onCancelMilestone: (milestoneId: number) => Promise<void>;
  onReorderMilestones: (items: { projectMilestoneId: number; sortOrder: number }[]) => Promise<void>;
  isSaving: boolean;
  isReordering: boolean;
}

function milestoneIdOf(milestone: ProjectMilestone): number {
  return milestone.projectMilestoneId ?? milestone.milestoneId ?? milestone.workItemId ?? 0;
}

function milestoneFormFromDetail(milestone: ProjectMilestone): ProjectMilestoneForm {
  return {
    title: milestone.title,
    description: milestone.description ?? '',
    status: milestone.status,
    managerEmployeeId: milestone.managerEmployeeId ?? null,
    plannedStart: toDateInputValue(milestone.plannedStart),
    plannedEnd: toDateInputValue(milestone.plannedEnd),
    actualStart: toDateInputValue(milestone.actualStart),
    actualEnd: toDateInputValue(milestone.actualEnd),
    progressPercent:
      milestone.progressPercent != null ? String(milestone.progressPercent) : '',
    sortOrder: milestone.sortOrder ?? null,
  };
}

function parseProgressPercent(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const numeric = Number(trimmed);
  if (Number.isNaN(numeric)) return undefined;

  return Math.min(100, Math.max(0, Math.round(numeric)));
}

function buildCreateMilestoneRequest(form: ProjectMilestoneForm): CreateMilestoneRequest {
  return {
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    status: form.status,
    managerEmployeeId: form.managerEmployeeId!,
    plannedStart: form.plannedStart || undefined,
    plannedEnd: form.plannedEnd || undefined,
    sortOrder: form.sortOrder ?? undefined,
  };
}

function buildUpdateMilestoneRequest(form: ProjectMilestoneForm): UpdateMilestoneRequest {
  return {
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    status: form.status,
    managerEmployeeId: form.managerEmployeeId ?? undefined,
    plannedStart: form.plannedStart || undefined,
    plannedEnd: form.plannedEnd || undefined,
    actualStart: form.actualStart || undefined,
    actualEnd: form.actualEnd || undefined,
    progressPercent: parseProgressPercent(form.progressPercent),
    sortOrder: form.sortOrder ?? 0,
  };
}

function validateDateRange(start: string, end: string): string | undefined {
  if (!start || !end) return undefined;
  if (end < start) {
    return 'תאריך הסיום חייב להיות אחרי או שווה לתאריך ההתחלה.';
  }
  return undefined;
}

export function ProjectMilestonesTab({
  projectId,
  lifecycle,
  employees,
  onCreateMilestone,
  onUpdateMilestone,
  onCancelMilestone,
  onReorderMilestones,
  isSaving,
  isReordering,
}: ProjectMilestonesTabProps) {
  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProjectMilestoneForm>(createEmptyMilestoneForm());
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [managerError, setManagerError] = useState<string | null>(null);

  const milestonesQuery = useProjectMilestones(projectId, true);

  const employeeNameById = useMemo(() => {
    const map = new Map<number, string>();
    employees.forEach((employee) => map.set(employee.employeeId, employee.fullName));
    return map;
  }, [employees]);

  const findMilestoneDetail = (milestoneId: number) =>
    milestonesQuery.data?.find((milestone) => milestoneIdOf(milestone) === milestoneId);

  const sortedMilestones = useMemo(() => {
    const milestones = milestonesQuery.data ?? lifecycle?.milestones ?? [];
    return [...milestones].sort((left, right) => {
      const leftOrder = left.sortOrder ?? 0;
      const rightOrder = right.sortOrder ?? 0;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return milestoneIdOf(left) - milestoneIdOf(right);
    });
  }, [lifecycle?.milestones, milestonesQuery.data]);

  const plannedDateError = validateDateRange(form.plannedStart, form.plannedEnd);
  const actualDateError = validateDateRange(form.actualStart, form.actualEnd);
  const hasDateValidationError = Boolean(plannedDateError || actualDateError);

  const handleMoveMilestone = async (milestoneId: number, direction: 'up' | 'down') => {
    if (isReordering || isSaving) return;

    const orderedIds = sortedMilestones.map((milestone) => milestoneIdOf(milestone));
    const currentIndex = orderedIds.indexOf(milestoneId);
    if (currentIndex < 0) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= orderedIds.length) return;

    const nextOrder = [...orderedIds];
    [nextOrder[currentIndex], nextOrder[targetIndex]] = [
      nextOrder[targetIndex],
      nextOrder[currentIndex],
    ];

    const items = nextOrder.map((id, sortOrder) => ({ projectMilestoneId: id, sortOrder }));

    setReorderError(null);
    try {
      await onReorderMilestones(items);
    } catch (error) {
      setReorderError(error instanceof Error ? error.message : 'סידור אבני הדרך נכשל.');
    }
  };

  const resetForm = () => {
    setEditingMilestoneId(null);
    setShowForm(false);
    setForm(createEmptyMilestoneForm());
    setManagerError(null);
  };

  const updateField = <K extends keyof ProjectMilestoneForm>(
    key: K,
    value: ProjectMilestoneForm[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === 'managerEmployeeId') {
      setManagerError(null);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;

    if (hasDateValidationError) return;

    if (editingMilestoneId == null) {
      if (form.managerEmployeeId == null || form.managerEmployeeId <= 0) {
        setManagerError('יש לבחור מנהל שלב.');
        return;
      }

      await onCreateMilestone(buildCreateMilestoneRequest(form));
    } else {
      await onUpdateMilestone(editingMilestoneId, buildUpdateMilestoneRequest(form));
    }

    resetForm();
  };

  const handleEdit = (milestoneId: number) => {
    const milestone = findMilestoneDetail(milestoneId);
    if (milestone) {
      setForm(milestoneFormFromDetail(milestone));
    }
    setEditingMilestoneId(milestoneId);
    setShowForm(true);
    setManagerError(null);
  };

  const handleCancelMilestone = async (milestoneId: number) => {
    await onCancelMilestone(milestoneId);
  };

  const resolveManagerName = (milestone: ProjectMilestone): string | undefined => {
    if (milestone.managerEmployeeName) return milestone.managerEmployeeName;
    if (milestone.managerEmployeeId == null) return undefined;
    return employeeNameById.get(milestone.managerEmployeeId);
  };

  return (
    <div className="projectMilestonesTab">
      <div className="projectMilestonesTab__toolbar">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setEditingMilestoneId(null);
            setForm(createEmptyMilestoneForm());
            setManagerError(null);
            setShowForm(true);
          }}
        >
          הוסף אבן דרך
        </Button>
      </div>

      {showForm && (
        <div className="projectMilestonesTab__formCard">
          <div className="projectMilestonesTab__formHeader">
            <div>
              <span className="projectMilestonesTab__formKicker">
                {editingMilestoneId ? 'עדכון אבן דרך קיימת' : 'אבן דרך חדשה'}
              </span>
              <h3>{editingMilestoneId ? 'עריכת אבן דרך' : 'אבן דרך חדשה'}</h3>
            </div>
          </div>
          {editingMilestoneId != null && milestonesQuery.isLoading ? (
            <PageSpinner />
          ) : (
            <>
              <section className="projectMilestonesTab__formSection">
                <h4 className="projectMilestonesTab__sectionTitle">פרטי אבן הדרך</h4>
                <div className="projectMilestonesTab__formGrid">
                  <Input
                    label="שם אבן הדרך"
                    value={form.title}
                    onChange={(event) => updateField('title', event.target.value)}
                  />
                  <Select
                    label="מנהל השלב"
                    value={form.managerEmployeeId ?? ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      updateField(
                        'managerEmployeeId',
                        value ? Number(value) : null,
                      );
                    }}
                    error={managerError ?? undefined}
                  >
                    <option value="">בחר עובד</option>
                    {employees.map((employee) => (
                      <option key={employee.employeeId} value={employee.employeeId}>
                        {employee.fullName}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="סטטוס"
                    value={form.status}
                    onChange={(event) => updateField('status', event.target.value)}
                  >
                    {MILESTONE_STATUS_OPTIONS.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.display}
                      </option>
                    ))}
                  </Select>
                  {editingMilestoneId != null && (
                    <Input
                      label="אחוז התקדמות"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={form.progressPercent}
                      onChange={(event) => updateField('progressPercent', event.target.value)}
                    />
                  )}
                </div>
                <Textarea
                  label="תיאור"
                  value={form.description}
                  onChange={(event) => updateField('description', event.target.value)}
                  placeholder="תיאור"
                  rows={3}
                />
              </section>

              <section className="projectMilestonesTab__formSection">
                <h4 className="projectMilestonesTab__sectionTitle">תכנון</h4>
                <div className="projectMilestonesTab__formGrid">
                  <Input
                    label="תחילה מתוכננת"
                    type="date"
                    value={form.plannedStart}
                    onChange={(event) => updateField('plannedStart', event.target.value)}
                  />
                  <Input
                    label="סיום מתוכנן"
                    type="date"
                    value={form.plannedEnd}
                    onChange={(event) => updateField('plannedEnd', event.target.value)}
                    error={plannedDateError}
                  />
                </div>
              </section>

              {editingMilestoneId != null && (
                <section className="projectMilestonesTab__formSection">
                  <h4 className="projectMilestonesTab__sectionTitle">ביצוע בפועל</h4>
                  <div className="projectMilestonesTab__formGrid">
                    <Input
                      label="תחילה בפועל"
                      type="date"
                      value={form.actualStart}
                      onChange={(event) => updateField('actualStart', event.target.value)}
                    />
                    <Input
                      label="סיום בפועל"
                      type="date"
                      value={form.actualEnd}
                      onChange={(event) => updateField('actualEnd', event.target.value)}
                      error={actualDateError}
                    />
                  </div>
                </section>
              )}

              <div className="projectMilestonesTab__formActions">
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || hasDateValidationError || !form.title.trim()}
                >
                  שמור
                </Button>
                <Button type="button" variant="ghost" onClick={resetForm}>
                  ביטול
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="projectMilestonesTab__list">
        {reorderError && <p className="projectMilestonesTab__error">{reorderError}</p>}
        {milestonesQuery.isError ? (
          <InlineAlert variant="danger">
            {milestonesQuery.error instanceof Error
              ? milestonesQuery.error.message
              : 'טעינת אבני הדרך נכשלה.'}
          </InlineAlert>
        ) : milestonesQuery.isLoading && sortedMilestones.length === 0 ? (
          <PageSpinner />
        ) : sortedMilestones.length === 0 ? (
          <div className="projectMilestonesTab__emptyState">
            <p className="projectMilestonesTab__empty">לא נמצאו אבני דרך בטבלה הייעודית לפרויקט זה.</p>
            <p className="projectMilestonesTab__legacyHint">
              משימות ילד legacy בפרויקט אינן מסווגות אוטומטית כאבני דרך; סיווג מחייב מיפוי מפורש
              ב־_MilestoneMigrationMap על ידי מפעיל.
            </p>
          </div>
        ) : (
          sortedMilestones.map((milestone, index) => {
            const id = milestoneIdOf(milestone);
            const isCancelled =
              milestone.status === 'Cancelled' ||
              milestone.status === 'Closed' ||
              ('isActive' in milestone && milestone.isActive === false);
            const managerName = resolveManagerName(milestone);

            return (
              <article key={id} className="projectMilestonesTab__card">
                <div className="projectMilestonesTab__cardHeader">
                  <h4>{milestone.title}</h4>
                  <div className="projectMilestonesTab__badges">
                    {milestone.sortOrder != null && (
                      <Badge variant="neutral">#{milestone.sortOrder + 1}</Badge>
                    )}
                    <StatusBadge domain="milestone" status={milestone.status} />
                    {milestone.progressPercent != null && (
                      <Badge variant="primary">{milestone.progressPercent}%</Badge>
                    )}
                  </div>
                </div>
                <p>{milestone.description || '-'}</p>
                <div className="projectMilestonesTab__meta">
                  {managerName && <span>מנהל שלב: {managerName}</span>}
                  <span>
                    מתוכנן: {formatProjectDate(milestone.plannedStart)}
                  </span>
                  <span>עד: {formatProjectDate(milestone.plannedEnd)}</span>
                </div>
                <div className="projectMilestonesTab__cardActions">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isReordering || isSaving || index === 0}
                    onClick={() => void handleMoveMilestone(id, 'up')}
                  >
                    למעלה
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={
                      isReordering || isSaving || index === sortedMilestones.length - 1
                    }
                    onClick={() => void handleMoveMilestone(id, 'down')}
                  >
                    למטה
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => handleEdit(id)}>
                    ערוך
                  </Button>
                  {!isCancelled && (
                    <ConfirmInline
                      triggerLabel="השבת אבן דרך"
                      message="להשבית את אבן הדרך?"
                      confirmLabel="אישור"
                      onConfirm={() => handleCancelMilestone(id)}
                      isPending={isSaving}
                    />
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

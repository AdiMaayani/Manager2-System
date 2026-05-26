import { useEffect, useState } from 'react';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { PageSpinner } from '@shared/components/PageSpinner';
import { useProjectMilestones } from '../../../../hooks/useProjectLifecycle';
import type {
  ProjectLifecycle,
  ProjectLifecycleMilestone,
  ProjectMilestone,
  ProjectMilestoneForm,
} from '../../../../types';
import {
  BILLING_TYPE_OPTIONS,
  MILESTONE_PRIORITY_OPTIONS,
  MILESTONE_STATUS_OPTIONS,
  calculateHoursBetween,
  formatDecimalHoursToTime,
  formatProjectDate,
  toDateTimeLocalValue,
} from '../../../../utils/projectDisplayUtils';
import './ProjectMilestonesTab.css';

interface ProjectMilestonesTabProps {
  projectId: number | null;
  lifecycle: ProjectLifecycle | null;
  customerId: number;
  siteId: number;
  onCreateMilestone: (body: ReturnType<typeof buildMilestoneRequest>) => Promise<void>;
  onUpdateMilestone: (
    milestoneId: number,
    body: ReturnType<typeof buildMilestoneRequest>,
  ) => Promise<void>;
  onCancelMilestone: (milestoneId: number) => Promise<void>;
  isSaving: boolean;
}

function milestoneFormFromDetail(milestone: ProjectMilestone): ProjectMilestoneForm {
  return {
    title: milestone.title,
    description: milestone.description ?? '',
    status: milestone.status,
    billingType: milestone.billingType ?? 'Internal',
    plannedStart: toDateTimeLocalValue(milestone.plannedStart),
    plannedEnd: toDateTimeLocalValue(milestone.plannedEnd),
    estimatedHours: formatDecimalHoursToTime(milestone.estimatedHours),
    actualStart: toDateTimeLocalValue(milestone.actualStart),
    actualEnd: toDateTimeLocalValue(milestone.actualEnd),
    actualHours: formatDecimalHoursToTime(milestone.actualHours),
    priority: milestone.priority ?? 'Medium',
    requiredRole: milestone.requiredRole ?? '',
    isLocked: milestone.isLocked,
  };
}

function buildMilestoneRequest(
  form: ProjectMilestoneForm,
  customerId: number,
  siteId: number,
) {
  const estimated = calculateHoursBetween(form.plannedStart, form.plannedEnd);
  const actual = calculateHoursBetween(form.actualStart, form.actualEnd);

  return {
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    status: form.status,
    billingType: form.billingType,
    customerId,
    siteId,
    plannedStart: form.plannedStart || undefined,
    plannedEnd: form.plannedEnd || undefined,
    estimatedHours: estimated.value ?? undefined,
    actualStart: form.actualStart || undefined,
    actualEnd: form.actualEnd || undefined,
    actualHours: actual.value ?? undefined,
    priority: form.priority || undefined,
    requiredRole: form.requiredRole.trim() || undefined,
    isLocked: form.isLocked,
    employees: [],
    contractors: [],
  };
}

export function ProjectMilestonesTab({
  projectId,
  lifecycle,
  customerId,
  siteId,
  onCreateMilestone,
  onUpdateMilestone,
  onCancelMilestone,
  isSaving,
}: ProjectMilestonesTabProps) {
  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProjectMilestoneForm>({
    title: '',
    description: '',
    status: 'Planned',
    billingType: 'Internal',
    plannedStart: '',
    plannedEnd: '',
    estimatedHours: '',
    actualStart: '',
    actualEnd: '',
    actualHours: '',
    priority: 'Medium',
    requiredRole: '',
    isLocked: false,
  });

  const milestonesQuery = useProjectMilestones(
    projectId,
    editingMilestoneId != null && editingMilestoneId > 0,
  );

  useEffect(() => {
    if (milestonesQuery.data && editingMilestoneId != null) {
      const milestone = milestonesQuery.data.find(
        (item) => item.workItemId === editingMilestoneId,
      );
      if (milestone) {
        setForm(milestoneFormFromDetail(milestone));
      }
    }
  }, [milestonesQuery.data, editingMilestoneId]);

  const milestones = lifecycle?.milestones ?? [];

  const resetForm = () => {
    setEditingMilestoneId(null);
    setShowForm(false);
    setForm({
      title: '',
      description: '',
      status: 'Planned',
      billingType: 'Internal',
      plannedStart: '',
      plannedEnd: '',
      estimatedHours: '',
      actualStart: '',
      actualEnd: '',
      actualHours: '',
      priority: 'Medium',
      requiredRole: '',
      isLocked: false,
    });
  };

  const updateField = <K extends keyof ProjectMilestoneForm>(
    key: K,
    value: ProjectMilestoneForm[K],
  ) => {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (key === 'plannedStart' || key === 'plannedEnd') {
        const estimated = calculateHoursBetween(next.plannedStart, next.plannedEnd);
        next.estimatedHours = estimated.display;
      }

      if (key === 'actualStart' || key === 'actualEnd') {
        const actual = calculateHoursBetween(next.actualStart, next.actualEnd);
        next.actualHours = actual.display;
      }

      return next;
    });
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;

    const body = buildMilestoneRequest(form, customerId, siteId);

    if (editingMilestoneId != null) {
      await onUpdateMilestone(editingMilestoneId, body);
    } else {
      await onCreateMilestone(body);
    }

    resetForm();
  };

  const handleEdit = (milestone: ProjectLifecycleMilestone) => {
    setEditingMilestoneId(milestone.workItemId);
    setShowForm(true);
    setForm({
      title: milestone.title,
      description: milestone.description ?? '',
      status: milestone.status,
      billingType: milestone.billingType ?? 'Internal',
      plannedStart: toDateTimeLocalValue(milestone.plannedStart),
      plannedEnd: toDateTimeLocalValue(milestone.plannedEnd),
      estimatedHours: formatDecimalHoursToTime(milestone.estimatedHours),
      actualStart: '',
      actualEnd: '',
      actualHours: '',
      priority: milestone.priority ?? 'Medium',
      requiredRole: milestone.requiredRole ?? '',
      isLocked: milestone.isLocked,
    });
  };

  const handleCancelMilestone = async (milestoneId: number) => {
    await onCancelMilestone(milestoneId);
  };

  return (
    <div className="projectMilestonesTab">
      <div className="projectMilestonesTab__toolbar">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setEditingMilestoneId(null);
            setShowForm(true);
          }}
        >
          הוסף אבן דרך
        </Button>
      </div>

      {showForm && (
        <div className="projectMilestonesTab__formCard">
          <h3>{editingMilestoneId ? 'עריכת אבן דרך' : 'אבן דרך חדשה'}</h3>
          {editingMilestoneId != null && milestonesQuery.isLoading ? (
            <PageSpinner />
          ) : (
            <>
              <div className="projectMilestonesTab__formGrid">
                <Input
                  label="שם אבן הדרך"
                  value={form.title}
                  onChange={(event) => updateField('title', event.target.value)}
                />
                <label className="projectMilestonesTab__field">
                  <span>סטטוס</span>
                  <select
                    className="projectMilestonesTab__select"
                    value={form.status}
                    onChange={(event) => updateField('status', event.target.value)}
                  >
                    {MILESTONE_STATUS_OPTIONS.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.display}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="projectMilestonesTab__field">
                  <span>סוג חיוב</span>
                  <select
                    className="projectMilestonesTab__select"
                    value={form.billingType}
                    onChange={(event) => updateField('billingType', event.target.value)}
                  >
                    {BILLING_TYPE_OPTIONS.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.display}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="projectMilestonesTab__field">
                  <span>עדיפות</span>
                  <select
                    className="projectMilestonesTab__select"
                    value={form.priority}
                    onChange={(event) => updateField('priority', event.target.value)}
                  >
                    {MILESTONE_PRIORITY_OPTIONS.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.display}
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  label="תחילה מתוכננת"
                  type="datetime-local"
                  value={form.plannedStart}
                  onChange={(event) => updateField('plannedStart', event.target.value)}
                />
                <Input
                  label="סיום מתוכנן"
                  type="datetime-local"
                  value={form.plannedEnd}
                  onChange={(event) => updateField('plannedEnd', event.target.value)}
                />
                <Input
                  label="שעות משוערות"
                  value={form.estimatedHours}
                  readOnly
                />
                <Input
                  label="תפקיד נדרש"
                  value={form.requiredRole}
                  onChange={(event) => updateField('requiredRole', event.target.value)}
                />
                <Input
                  label="תחילה בפועל"
                  type="datetime-local"
                  value={form.actualStart}
                  onChange={(event) => updateField('actualStart', event.target.value)}
                />
                <Input
                  label="סיום בפועל"
                  type="datetime-local"
                  value={form.actualEnd}
                  onChange={(event) => updateField('actualEnd', event.target.value)}
                />
                <Input label="שעות בפועל" value={form.actualHours} readOnly />
              </div>
              <label className="projectMilestonesTab__checkbox">
                <input
                  type="checkbox"
                  checked={form.isLocked}
                  onChange={(event) => updateField('isLocked', event.target.checked)}
                />
                נעול לתכנון
              </label>
              <textarea
                className="projectMilestonesTab__textarea"
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                placeholder="תיאור"
                rows={3}
              />
              <div className="projectMilestonesTab__formActions">
                <Button type="button" onClick={handleSave} disabled={isSaving}>
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
        {milestones.length === 0 ? (
          <p className="projectMilestonesTab__empty">לא נמצאו אבני דרך לפרויקט זה.</p>
        ) : (
          milestones.map((milestone) => {
            const isCancelled =
              milestone.status === 'Cancelled' || milestone.status === 'Closed';

            return (
              <article key={milestone.workItemId} className="projectMilestonesTab__card">
                <div className="projectMilestonesTab__cardHeader">
                  <h4>{milestone.title}</h4>
                  <div className="projectMilestonesTab__badges">
                    <Badge variant="primary">{milestone.status}</Badge>
                    {milestone.isLocked && <Badge variant="warning">נעול</Badge>}
                  </div>
                </div>
                <p>{milestone.description || '-'}</p>
                <div className="projectMilestonesTab__meta">
                  <span>מתוכנן: {formatProjectDate(milestone.plannedStart, { includeTime: true })}</span>
                  <span>עד: {formatProjectDate(milestone.plannedEnd, { includeTime: true })}</span>
                  <span>שעות: {formatDecimalHoursToTime(milestone.estimatedHours)}</span>
                </div>
                <div className="projectMilestonesTab__cardActions">
                  <Button type="button" variant="ghost" onClick={() => handleEdit(milestone)}>
                    ערוך
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={isCancelled || isSaving}
                    onClick={() => handleCancelMilestone(milestone.workItemId)}
                  >
                    בטל
                  </Button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

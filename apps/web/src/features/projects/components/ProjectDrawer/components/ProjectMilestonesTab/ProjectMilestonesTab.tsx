import { useEffect, useState } from 'react';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { PageSpinner } from '@shared/components/PageSpinner';
import { useProjectMilestones } from '../../../../hooks/useProjectLifecycle';
import type {
  CreateMilestoneEmployeeAssignment,
  ProjectEmployeeOption,
  ProjectLifecycle,
  ProjectMilestone,
  ProjectMilestoneForm,
} from '../../../../types';
import {
  BILLING_TYPE_OPTIONS,
  MILESTONE_PRIORITY_OPTIONS,
  MILESTONE_STATUS_OPTIONS,
  PROJECT_ASSIGNMENT_ROLE_OPTIONS,
  calculateHoursBetween,
  createEmptyMilestoneForm,
  formatDecimalHoursToTime,
  formatProjectDate,
  parseOptionalMilestoneEstimatedHours,
  toDateTimeLocalValue,
} from '../../../../utils/projectDisplayUtils';
import './ProjectMilestonesTab.css';

interface ProjectMilestonesTabProps {
  projectId: number | null;
  lifecycle: ProjectLifecycle | null;
  customerId: number;
  siteId: number;
  employees: ProjectEmployeeOption[];
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
    estimatedHours:
      milestone.estimatedHours != null ? String(milestone.estimatedHours) : '',
    actualStart: toDateTimeLocalValue(milestone.actualStart),
    actualEnd: toDateTimeLocalValue(milestone.actualEnd),
    actualHours: formatDecimalHoursToTime(milestone.actualHours),
    priority: milestone.priority ?? 'Medium',
    requiredRole: milestone.requiredRole ?? '',
    isLocked: milestone.isLocked,
    employees: milestone.employees.map((employee) => ({
      employeeId: employee.employeeId,
      assignmentRole: employee.assignmentRole ?? 'מתקין',
    })),
    contractors: milestone.contractors.map((contractor) => ({
      contractorId: contractor.contractorId,
      assignmentRole: contractor.assignmentRole ?? 'קבלן',
    })),
  };
}

function buildMilestoneRequest(
  form: ProjectMilestoneForm,
  customerId: number,
  siteId: number,
  estimatedHours: number | undefined,
) {
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
    estimatedHours,
    actualStart: form.actualStart || undefined,
    actualEnd: form.actualEnd || undefined,
    actualHours: actual.value ?? undefined,
    priority: form.priority || undefined,
    requiredRole: form.requiredRole.trim() || undefined,
    isLocked: form.isLocked,
    employees: form.employees.filter((employee) => employee.employeeId > 0),
    contractors: form.contractors.filter((contractor) => contractor.contractorId > 0),
  };
}

export function ProjectMilestonesTab({
  projectId,
  lifecycle,
  customerId,
  siteId,
  employees,
  onCreateMilestone,
  onUpdateMilestone,
  onCancelMilestone,
  isSaving,
}: ProjectMilestonesTabProps) {
  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProjectMilestoneForm>(createEmptyMilestoneForm());

  const milestonesQuery = useProjectMilestones(projectId, true);
  const activeEmployees = employees.filter((employee) => employee.isActive !== false);

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

  const milestones = milestonesQuery.data ?? lifecycle?.milestones ?? [];

  const resetForm = () => {
    setEditingMilestoneId(null);
    setShowForm(false);
    setForm(createEmptyMilestoneForm());
  };

  const updateField = <K extends keyof ProjectMilestoneForm>(
    key: K,
    value: ProjectMilestoneForm[K],
  ) => {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (key === 'actualStart' || key === 'actualEnd') {
        const actual = calculateHoursBetween(next.actualStart, next.actualEnd);
        next.actualHours = actual.display;
      }

      return next;
    });
  };

  const addEmployeeAssignment = () => {
    updateField('employees', [
      ...form.employees,
      { employeeId: 0, assignmentRole: 'מתקין' },
    ]);
  };

  const updateEmployeeAssignment = (
    index: number,
    patch: Partial<CreateMilestoneEmployeeAssignment>,
  ) => {
    updateField(
      'employees',
      form.employees.map((employee, employeeIndex) =>
        employeeIndex === index ? { ...employee, ...patch } : employee,
      ),
    );
  };

  const removeEmployeeAssignment = (index: number) => {
    updateField(
      'employees',
      form.employees.filter((_, employeeIndex) => employeeIndex !== index),
    );
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;

    const parsedEstimatedHours = parseOptionalMilestoneEstimatedHours(form.estimatedHours);
    if (parsedEstimatedHours.error) {
      window.alert(parsedEstimatedHours.error);
      return;
    }

    const body = buildMilestoneRequest(
      form,
      customerId,
      siteId,
      parsedEstimatedHours.value,
    );

    if (editingMilestoneId != null) {
      await onUpdateMilestone(editingMilestoneId, body);
    } else {
      await onCreateMilestone(body);
    }

    resetForm();
  };

  const handleEdit = (milestoneId: number) => {
    setEditingMilestoneId(milestoneId);
    setShowForm(true);
  };

  const handleCancelMilestone = async (milestoneId: number) => {
    await onCancelMilestone(milestoneId);
  };

  const findMilestoneDetail = (milestoneId: number) =>
    milestonesQuery.data?.find((milestone) => milestone.workItemId === milestoneId);

  return (
    <div className="projectMilestonesTab">
      <div className="projectMilestonesTab__toolbar">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setEditingMilestoneId(null);
            setForm(createEmptyMilestoneForm());
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
                {editingMilestoneId ? 'עדכון משימה קיימת' : 'תכנון משימה חדשה'}
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
                    label="תפקיד נדרש"
                    value={form.requiredRole}
                    onChange={(event) => updateField('requiredRole', event.target.value)}
                  />
                </div>
              </section>

              <section className="projectMilestonesTab__formSection">
                <h4 className="projectMilestonesTab__sectionTitle">תכנון</h4>
                <div className="projectMilestonesTab__formGrid">
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
                    label="הערכת שעות (מאמץ)"
                    type="number"
                    min={0}
                    max={999.99}
                    step={0.5}
                    value={form.estimatedHours}
                    onChange={(event) => updateField('estimatedHours', event.target.value)}
                  />
                </div>
              </section>

              <section className="projectMilestonesTab__formSection">
                <h4 className="projectMilestonesTab__sectionTitle">ביצוע בפועל</h4>
                <div className="projectMilestonesTab__formGrid">
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
              </section>

              <section className="projectMilestonesTab__assignments">
                <div className="projectMilestonesTab__assignmentsHeader">
                  <h4>עובדים משויכים</h4>
                  <Button type="button" variant="ghost" onClick={addEmployeeAssignment}>
                    הוסף עובד
                  </Button>
                </div>
                {form.employees.length === 0 ? (
                  <p className="projectMilestonesTab__emptyAssignments">אין עובדים משויכים.</p>
                ) : (
                  form.employees.map((employee, index) => (
                    <div key={`employee-${index}`} className="projectMilestonesTab__assignmentRow">
                      <select
                        className="projectMilestonesTab__select"
                        value={employee.employeeId || ''}
                        onChange={(event) =>
                          updateEmployeeAssignment(index, {
                            employeeId: Number(event.target.value),
                          })
                        }
                      >
                        <option value="">בחר עובד</option>
                        {activeEmployees.map((option) => (
                          <option key={option.employeeId} value={option.employeeId}>
                            {option.fullName}
                          </option>
                        ))}
                      </select>
                      <select
                        className="projectMilestonesTab__select"
                        value={employee.assignmentRole}
                        onChange={(event) =>
                          updateEmployeeAssignment(index, {
                            assignmentRole: event.target.value,
                          })
                        }
                      >
                        {PROJECT_ASSIGNMENT_ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeEmployeeAssignment(index)}
                      >
                        הסר
                      </Button>
                    </div>
                  ))
                )}
              </section>

              <section className="projectMilestonesTab__formSection">
                <h4 className="projectMilestonesTab__sectionTitle">הערות ונעילה</h4>
                <label className="projectMilestonesTab__checkbox">
                  <input
                    type="checkbox"
                    checked={form.isLocked}
                    onChange={(event) => updateField('isLocked', event.target.checked)}
                  />
                  <span>נעול לתכנון</span>
                </label>
                <textarea
                  className="projectMilestonesTab__textarea"
                  value={form.description}
                  onChange={(event) => updateField('description', event.target.value)}
                  placeholder="תיאור"
                  rows={3}
                />
              </section>
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
        {milestonesQuery.isLoading && milestones.length === 0 ? (
          <PageSpinner />
        ) : milestones.length === 0 ? (
          <p className="projectMilestonesTab__empty">לא נמצאו אבני דרך לפרויקט זה.</p>
        ) : (
          milestones.map((milestone) => {
            const isCancelled =
              milestone.status === 'Cancelled' || milestone.status === 'Closed';
            const milestoneDetail = findMilestoneDetail(milestone.workItemId);
            const employeeNames =
              milestoneDetail?.employees
                .map((employee) => employee.employeeName)
                .filter(Boolean) ?? [];
            const contractorNames =
              milestoneDetail?.contractors
                .map((contractor) => contractor.contractorName)
                .filter(Boolean) ?? [];

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
                  <span>
                    מתוכנן: {formatProjectDate(milestone.plannedStart, { includeTime: true })}
                  </span>
                  <span>עד: {formatProjectDate(milestone.plannedEnd, { includeTime: true })}</span>
                  <span>שעות: {formatDecimalHoursToTime(milestone.estimatedHours)}</span>
                </div>
                <div className="projectMilestonesTab__assignmentsView">
                  <span>
                    עובדים משויכים:{' '}
                    {employeeNames.length > 0 ? employeeNames.join(', ') : '-'}
                  </span>
                  <span>
                    קבלנים משויכים:{' '}
                    {contractorNames.length > 0 ? contractorNames.join(', ') : '-'}
                  </span>
                </div>
                <div className="projectMilestonesTab__cardActions">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleEdit(milestone.workItemId)}
                  >
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

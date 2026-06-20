import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Drawer, useDrawerMaximize } from '@shared/components/Drawer';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { DetailsField } from '@shared/components/DetailsField';
import { DetailsSection } from '@shared/components/DetailsSection';
import { RelatedSection } from '@shared/components/RelatedSection';
import { Input } from '@shared/components/Input';
import { Checkbox } from '@shared/components/Checkbox';
import { InlineAlert } from '@shared/components/InlineAlert';
import { ConfirmInline } from '@shared/components/ConfirmInline';
import { getUsersAsync } from '@features/users/api/usersApiClient';
import { getWorkPlanScheduleAsync } from '@features/workplan/api/workplanApiClient';
import { periodToUtcBounds } from '@features/workplan/lib/workPlanPeriod';
import { useEmployeeMutations } from '../../hooks/useEmployees';
import type { Employee, UpsertEmployeeRequest } from '../../types';
import './EmployeeDrawer.css';

const MAX_RELATED_ITEMS = 5;

interface EmployeeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employee?: Employee | null;
  /** Admin-only: gates edit/create/status actions. Review mode is open to all. */
  canEdit: boolean;
  onSaved: (employee: Employee, message: string) => void;
}

interface EmployeeFormState {
  fullName: string;
  primaryRole: string;
  phone: string;
  email: string;
  dailyCapacityHours: string;
  isAssignable: boolean;
  isActive: boolean;
}

function buildInitialState(employee: Employee | null): EmployeeFormState {
  return {
    fullName: employee?.fullName ?? '',
    primaryRole: employee?.primaryRole ?? '',
    phone: employee?.phone ?? '',
    email: employee?.email ?? '',
    dailyCapacityHours:
      employee?.dailyCapacityHours != null ? String(employee.dailyCapacityHours) : '',
    isAssignable: employee?.isAssignable ?? true,
    isActive: employee?.isActive ?? true,
  };
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function trimOptionalValue(value: string): string | undefined {
  const trimmedValue = value.trim();
  return trimmedValue || undefined;
}

function formatEmployeeDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate.toLocaleDateString('he-IL');
}

export function EmployeeDrawer({ isOpen, onClose, employee, canEdit, onSaved }: EmployeeDrawerProps) {
  if (!isOpen) return null;

  // Remount per employee so form/edit state always resets when the drawer
  // opens for a different record (or switches from create to a saved record).
  return (
    <EmployeeDrawerContent
      key={employee?.employeeId ?? 'new'}
      employee={employee ?? null}
      canEdit={canEdit}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

interface EmployeeDrawerContentProps {
  employee: Employee | null;
  canEdit: boolean;
  onClose: () => void;
  onSaved: (employee: Employee, message: string) => void;
}

function EmployeeDrawerContent({ employee, canEdit, onClose, onSaved }: EmployeeDrawerContentProps) {
  const isExistingEmployee = employee != null;
  const { createMutation, updateMutation, activeStatusMutation } = useEmployeeMutations();

  // Existing employees open in read-only review mode; create opens editable
  // (create is only reachable for users with manage permission).
  const [isEditing, setIsEditing] = useState(!isExistingEmployee && canEdit);
  const [form, setForm] = useState<EmployeeFormState>(() => buildInitialState(employee));
  const [error, setError] = useState<string | null>(null);
  const { isMaximized, toggleMaximize } = useDrawerMaximize(true);

  function setField<K extends keyof EmployeeFormState>(key: K, value: EmployeeFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleStartEdit() {
    if (!canEdit) return;
    setForm(buildInitialState(employee));
    setError(null);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    if (!isExistingEmployee) {
      onClose();
      return;
    }

    setForm(buildInitialState(employee));
    setError(null);
    setIsEditing(false);
  }

  function validate(): string | null {
    if (!form.fullName.trim()) return 'שם עובד הוא שדה חובה.';
    if (!form.primaryRole.trim()) return 'תפקיד ראשי הוא שדה חובה.';
    if (form.email.trim() && !isValidEmail(form.email)) return 'כתובת האימייל אינה תקינה.';

    if (form.dailyCapacityHours.trim()) {
      const parsedCapacity = Number(form.dailyCapacityHours);
      if (Number.isNaN(parsedCapacity) || parsedCapacity <= 0 || parsedCapacity > 24) {
        return 'קיבולת יומית חייבת להיות מספר גדול מ-0 ועד 24.';
      }
    }

    return null;
  }

  function buildRequest(): UpsertEmployeeRequest {
    return {
      fullName: form.fullName.trim(),
      primaryRole: form.primaryRole.trim(),
      phone: trimOptionalValue(form.phone),
      email: trimOptionalValue(form.email),
      dailyCapacityHours: form.dailyCapacityHours.trim()
        ? Number(Number(form.dailyCapacityHours).toFixed(2))
        : null,
      isAssignable: form.isAssignable,
      isActive: form.isActive,
    };
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    try {
      let savedEmployee: Employee;
      let message: string;
      if (isExistingEmployee) {
        const updatedEmployee = await updateMutation.mutateAsync({
          id: employee.employeeId,
          request: buildRequest(),
        });
        savedEmployee = updatedEmployee ?? { ...employee, ...buildRequest() };
        message = 'העובד עודכן בהצלחה.';
      } else {
        savedEmployee = await createMutation.mutateAsync(buildRequest());
        message = 'העובד נוצר בהצלחה.';
      }

      setIsEditing(false);
      onSaved(savedEmployee, message);
    } catch (err) {
      setIsEditing(true);
      setError(err instanceof Error ? err.message : 'שמירת העובד נכשלה');
    }
  }

  async function handleStatusChange() {
    if (!isExistingEmployee) return;

    setError(null);
    try {
      const updatedEmployee = await activeStatusMutation.mutateAsync({
        id: employee.employeeId,
        isActive: !employee.isActive,
      });
      onSaved(
        updatedEmployee ?? { ...employee, isActive: !employee.isActive },
        employee.isActive ? 'העובד הושבת בהצלחה.' : 'העובד הופעל מחדש בהצלחה.',
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'עדכון סטטוס העובד נכשל');
    }
  }

  const isSaving =
    createMutation.isPending || updateMutation.isPending || activeStatusMutation.isPending;

  const title = !isExistingEmployee
    ? 'עובד חדש'
    : isEditing
      ? `עריכת עובד — ${employee.fullName}`
      : `פרטי עובד — ${employee.fullName}`;

  // Edit mode keeps only save/cancel; archive/restore lives in the read-only footer.
  const editFooter = (
    <div className="employeeDrawer__footerContent">
      {error && <InlineAlert variant="danger">{error}</InlineAlert>}
      <div className="employeeDrawer__actions">
        <Button onClick={handleSave} isLoading={isSaving}>
          שמור
        </Button>
        <Button variant="secondary" onClick={handleCancelEdit} disabled={isSaving}>
          בטל שינויים
        </Button>
      </div>
    </div>
  );

  const reviewFooter =
    isExistingEmployee && canEdit ? (
      <div className="employeeDrawer__footerContent">
        {error && <InlineAlert variant="danger">{error}</InlineAlert>}
        <div className="employeeDrawer__dangerActions">
          <ConfirmInline
            triggerLabel={employee.isActive ? 'העברה לארכיון' : 'החזרה לפעילות'}
            message={
              employee.isActive ? 'להעביר את העובד לארכיון?' : 'להחזיר את העובד לפעילות?'
            }
            confirmLabel="אישור"
            variant={employee.isActive ? 'danger' : 'primary'}
            onConfirm={handleStatusChange}
            isPending={isSaving}
          />
        </div>
      </div>
    ) : undefined;

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={title}
      isMaximized={isMaximized}
      onToggleMaximize={toggleMaximize}
      headerActions={
        isExistingEmployee && !isEditing && canEdit ? (
          <Button type="button" variant="secondary" onClick={handleStartEdit}>
            ערוך פרטים
          </Button>
        ) : undefined
      }
      footer={isEditing ? editFooter : reviewFooter}
    >
      {!isEditing && isExistingEmployee ? (
        <EmployeeReviewDetails employee={employee} canViewLinkedUser={canEdit} />
      ) : (
        <div className="employeeDrawer employeeDrawer--edit">
          <DetailsSection title="פרטים כלליים">
            <Input
              label="שם מלא"
              value={form.fullName}
              onChange={(event) => setField('fullName', event.target.value)}
              required
            />
            <div className="employeeDrawer__grid">
              <Input
                label="תפקיד ראשי"
                value={form.primaryRole}
                onChange={(event) => setField('primaryRole', event.target.value)}
                required
              />
            </div>

            <Checkbox
              label="עובד פעיל"
              checked={form.isActive}
              onChange={(event) => setField('isActive', event.target.checked)}
            />
          </DetailsSection>

          <DetailsSection title="פרטי התקשרות">
            <div className="employeeDrawer__grid">
              <Input
                label="טלפון"
                type="tel"
                value={form.phone}
                onChange={(event) => setField('phone', event.target.value)}
              />

              <Input
                label="אימייל"
                type="email"
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
              />
            </div>
          </DetailsSection>

          <DetailsSection title="זמינות ושיבוץ">
            <div className="employeeDrawer__grid">
              <Input
                label="קיבולת יומית בשעות"
                type="number"
                min="0"
                max="24"
                step="0.25"
                value={form.dailyCapacityHours}
                onChange={(event) => setField('dailyCapacityHours', event.target.value)}
              />
            </div>

            <Checkbox
              label="ניתן לשיבוץ"
              checked={form.isAssignable}
              onChange={(event) => setField('isAssignable', event.target.checked)}
            />
          </DetailsSection>
        </div>
      )}
    </Drawer>
  );
}

interface EmployeeReviewDetailsProps {
  employee: Employee;
  /** The /Users endpoint is admin-only, so the linked-user section is gated. */
  canViewLinkedUser: boolean;
}

interface AssignedTaskContext {
  workItemId: number;
  taskTitle: string;
  taskStatus?: string;
  projectId: number;
  projectTitle: string;
  assignmentRole?: string | null;
  assignedHours?: number | null;
}

function EmployeeReviewDetails({ employee, canViewLinkedUser }: EmployeeReviewDetailsProps) {
  const areRelatedQueriesEnabled = true;

  const usersQuery = useQuery({
    queryKey: ['employees', 'related', 'users'],
    queryFn: getUsersAsync,
    enabled: areRelatedQueriesEnabled && canViewLinkedUser,
    staleTime: 60_000,
  });

  const workPlansQuery = useQuery({
    queryKey: ['employees', 'related', 'workPlans'],
    queryFn: async () => {
      const anchor = new Date();
      const { fromUtc, toUtc } = periodToUtcBounds(anchor, 'yearly');
      return getWorkPlanScheduleAsync({
        scope: 'company',
        fromUtc,
        toUtc,
        includeUnscheduled: true,
        taskCategory: 'all',
      });
    },
    enabled: areRelatedQueriesEnabled,
  });

  const schedule = workPlansQuery.data;

  const linkedUser = (usersQuery.data ?? []).find(
    (user) => user.employeeId === employee.employeeId,
  );

  const assignedTasks: AssignedTaskContext[] = (schedule?.assignments ?? [])
    .filter((assignment) => assignment.employeeId === employee.employeeId)
    .map((assignment) => {
      const task =
        schedule?.scheduledTasks.find((t) => t.workItemId === assignment.workItemId) ??
        schedule?.unscheduledTasks.find((t) => t.workItemId === assignment.workItemId);
      return {
        workItemId: assignment.workItemId,
        taskTitle: task?.title ?? `משימה #${assignment.workItemId}`,
        taskStatus: task?.status,
        projectId: task?.projectId ?? 0,
        projectTitle: task?.projectTitle ?? task?.customerName ?? '—',
        assignmentRole: assignment.assignmentRole,
        assignedHours: assignment.assignedHours,
      };
    });

  return (
    <div className="employeeDrawer employeeDrawer--review">
      <DetailsSection title="פרטי עובד">
        <div className="employeeDrawer__detailsGrid">
          <DetailsField label="שם מלא" value={employee.fullName} />
          <DetailsField label="תפקיד ראשי" value={employee.primaryRole} />
          <DetailsField
            label="סטטוס"
            value={
              <Badge variant={employee.isActive ? 'success' : 'neutral'}>
                {employee.isActive ? 'פעיל' : 'לא פעיל'}
              </Badge>
            }
          />
          <DetailsField label="נוצר בתאריך" value={formatEmployeeDate(employee.createdAt)} />
        </div>
      </DetailsSection>

      <DetailsSection title="פרטי התקשרות">
        <div className="employeeDrawer__detailsGrid">
          <DetailsField label="טלפון" value={employee.phone} />
          <DetailsField label="אימייל" value={employee.email} />
        </div>
      </DetailsSection>

      <DetailsSection title="זמינות ושיבוץ">
        <div className="employeeDrawer__detailsGrid">
          <DetailsField
            label="קיבולת יומית"
            value={
              employee.dailyCapacityHours != null
                ? `${employee.dailyCapacityHours} שעות`
                : undefined
            }
          />
          <DetailsField
            label="ניתן לשיבוץ"
            value={
              <Badge variant={employee.isAssignable ? 'success' : 'neutral'}>
                {employee.isAssignable ? 'כן' : 'לא'}
              </Badge>
            }
          />
        </div>
      </DetailsSection>

      {canViewLinkedUser && (
        <RelatedSection
          title="משתמש מערכת"
          count={null}
          isLoading={usersQuery.isLoading}
          isError={usersQuery.isError}
          isUnavailable={!areRelatedQueriesEnabled}
          emptyText=""
        >
          {linkedUser ? (
            <div className="employeeDrawer__detailsGrid">
              <DetailsField
                label="שם משתמש"
                value={
                  <Link
                    className="employeeDrawer__inlineLink"
                    to={`/users?userId=${linkedUser.userId}`}
                  >
                    {linkedUser.username}
                  </Link>
                }
              />
              <DetailsField label="אימייל משתמש" value={linkedUser.email} />
              <DetailsField
                label="תפקידים"
                value={linkedUser.roles.length > 0 ? linkedUser.roles.join(', ') : undefined}
              />
              <DetailsField
                label="סטטוס משתמש"
                value={
                  <Badge variant={linkedUser.isActive ? 'success' : 'neutral'}>
                    {linkedUser.isActive ? 'פעיל' : 'לא פעיל'}
                  </Badge>
                }
              />
            </div>
          ) : (
            <p className="employeeDrawer__relatedHint">אין משתמש מערכת מקושר לעובד זה.</p>
          )}
        </RelatedSection>
      )}

      <RelatedSection
        title="משימות מוקצות"
        count={workPlansQuery.data ? assignedTasks.length : null}
        isLoading={workPlansQuery.isLoading}
        isError={workPlansQuery.isError}
        isUnavailable={!areRelatedQueriesEnabled}
        emptyText="אין משימות מוקצות לעובד זה בתוכניות העבודה."
      >
        <ul className="employeeDrawer__relatedList">
          {assignedTasks.slice(0, MAX_RELATED_ITEMS).map((assignedTask, index) => (
            <li key={`${assignedTask.workItemId}-${index}`}>
              <Link
                className="employeeDrawer__relatedItem employeeDrawer__relatedItem--link"
                to={`/projects?projectId=${assignedTask.projectId}`}
              >
                <span className="employeeDrawer__relatedPrimary">{assignedTask.taskTitle}</span>
                <span className="employeeDrawer__relatedMeta">
                  {[
                    assignedTask.projectTitle,
                    assignedTask.assignmentRole,
                    assignedTask.assignedHours != null
                      ? `${assignedTask.assignedHours} שעות`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {assignedTask.taskStatus && (
                  <Badge variant="neutral">{assignedTask.taskStatus}</Badge>
                )}
              </Link>
            </li>
          ))}
        </ul>
        {assignedTasks.length > MAX_RELATED_ITEMS && (
          <p className="employeeDrawer__relatedHint">
            ועוד {assignedTasks.length - MAX_RELATED_ITEMS} משימות נוספות.
          </p>
        )}
      </RelatedSection>
    </div>
  );
}

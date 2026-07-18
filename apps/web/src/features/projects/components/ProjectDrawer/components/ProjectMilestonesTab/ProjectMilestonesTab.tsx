import { useMemo, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { Badge } from '@shared/components/Badge';
import { StatusBadge } from '@shared/components/StatusBadge';
import { Button } from '@shared/components/Button';
import { IconButton } from '@shared/components/IconButton';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { ListSelect } from '@shared/components/ListSelect';
import { Textarea } from '@shared/components/Textarea';
import { ConfirmInline } from '@shared/components/ConfirmInline';
import { EmptyState } from '@shared/components/EmptyState';
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
import { validateProjectMilestoneDateRange } from '../../../../utils/projectMilestoneDateRange';
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

interface MilestoneCardBodyProps {
  milestone: ProjectMilestone;
  index: number;
  total: number;
  isCancelled: boolean;
  managerName?: string;
  isReordering: boolean;
  isSaving: boolean;
  onMove: (milestoneId: number, direction: 'up' | 'down') => void;
  onEdit: (milestoneId: number) => void;
  onCancel: (milestoneId: number) => void;
  dragHandle: ReactNode;
}

/** Shared card markup reused by the sortable list item and the drag overlay preview. */
function MilestoneCardBody({
  milestone,
  index,
  total,
  isCancelled,
  managerName,
  isReordering,
  isSaving,
  onMove,
  onEdit,
  onCancel,
  dragHandle,
}: MilestoneCardBodyProps) {
  const id = milestoneIdOf(milestone);

  return (
    <>
      <div className="projectMilestonesTab__cardHeader">
        <div className="projectMilestonesTab__cardHeaderTitle">
          {dragHandle}
          <h4>{milestone.title}</h4>
        </div>
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
        <span>מתוכנן: {formatProjectDate(milestone.plannedStart)}</span>
        <span>עד: {formatProjectDate(milestone.plannedEnd)}</span>
      </div>
      <div className="projectMilestonesTab__cardActions">
        <Button
          type="button"
          variant="ghost"
          disabled={isReordering || isSaving || index === 0}
          onClick={() => onMove(id, 'up')}
        >
          למעלה
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isReordering || isSaving || index === total - 1}
          onClick={() => onMove(id, 'down')}
        >
          למטה
        </Button>
        <Button type="button" variant="ghost" onClick={() => onEdit(id)}>
          ערוך
        </Button>
        {!isCancelled && (
          <div className="projectMilestonesTab__cardDangerSlot">
            <ConfirmInline
              triggerLabel="הסר אבן דרך"
              message="להסיר את אבן הדרך מהרשימה?"
              confirmLabel="אישור"
              onConfirm={() => onCancel(id)}
              isPending={isSaving}
            />
          </div>
        )}
      </div>
    </>
  );
}

interface SortableMilestoneCardProps extends Omit<MilestoneCardBodyProps, 'dragHandle'> {
  isDragDisabled: boolean;
}

/** Draggable list item — only the handle receives drag listeners, never the whole card. */
function SortableMilestoneCard({ isDragDisabled, ...bodyProps }: SortableMilestoneCardProps) {
  const id = milestoneIdOf(bodyProps.milestone);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: isDragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dragHandle = (
    <IconButton
      label={`גרור לשינוי סדר אבן הדרך: ${bodyProps.milestone.title}`}
      icon={<GripVertical size={16} aria-hidden="true" />}
      variant="ghost"
      size="sm"
      className="projectMilestonesTab__dragHandle"
      disabled={isDragDisabled}
      {...attributes}
      {...listeners}
    />
  );

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`projectMilestonesTab__card${
        isDragging ? ' projectMilestonesTab__card--dragging' : ''
      }`}
    >
      <MilestoneCardBody {...bodyProps} dragHandle={dragHandle} />
    </article>
  );
}

/** Minimal, non-interactive preview shown under the pointer while dragging. */
function MilestoneDragOverlayCard({ milestone }: { milestone: ProjectMilestone }) {
  return (
    <article className="projectMilestonesTab__card projectMilestonesTab__card--overlay">
      <div className="projectMilestonesTab__cardHeader">
        <div className="projectMilestonesTab__cardHeaderTitle">
          <span
            className="projectMilestonesTab__dragHandle projectMilestonesTab__dragHandle--active"
            aria-hidden="true"
          >
            <GripVertical size={16} />
          </span>
          <h4>{milestone.title}</h4>
        </div>
        <div className="projectMilestonesTab__badges">
          {milestone.sortOrder != null && (
            <Badge variant="neutral">#{milestone.sortOrder + 1}</Badge>
          )}
          <StatusBadge domain="milestone" status={milestone.status} />
        </div>
      </div>
    </article>
  );
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
  const [activeDragMilestoneId, setActiveDragMilestoneId] = useState<number | null>(null);

  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  const plannedDateError = validateProjectMilestoneDateRange(
    form.plannedStart,
    form.plannedEnd,
    true,
  );
  const actualDateError = validateProjectMilestoneDateRange(
    form.actualStart,
    form.actualEnd,
    false,
  );
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

  const milestoneIds = useMemo(
    () => sortedMilestones.map((milestone) => milestoneIdOf(milestone)),
    [sortedMilestones],
  );

  const activeDragMilestone =
    activeDragMilestoneId != null
      ? sortedMilestones.find((milestone) => milestoneIdOf(milestone) === activeDragMilestoneId)
      : undefined;

  const milestoneTitleById = (milestoneId: number): string =>
    sortedMilestones.find((milestone) => milestoneIdOf(milestone) === milestoneId)?.title ?? '';

  const milestonePositionById = (milestoneId: number): number =>
    milestoneIds.indexOf(milestoneId) + 1;

  const milestoneDragAnnouncements: Announcements = {
    onDragStart({ active }) {
      const title = milestoneTitleById(active.id as number);
      return `הרמת אבן הדרך "${title}" לשינוי סדר. המיקום הנוכחי: ${milestonePositionById(
        active.id as number,
      )} מתוך ${milestoneIds.length}.`;
    },
    onDragOver({ active, over }) {
      const title = milestoneTitleById(active.id as number);
      if (!over) {
        return `אבן הדרך "${title}" אינה ממוקמת מעל מיקום חדש.`;
      }
      return `אבן הדרך "${title}" הועברה למיקום ${milestonePositionById(
        over.id as number,
      )} מתוך ${milestoneIds.length}.`;
    },
    onDragEnd({ active, over }) {
      const title = milestoneTitleById(active.id as number);
      if (!over) {
        return `שינוי הסדר של אבן הדרך "${title}" בוטל.`;
      }
      return `אבן הדרך "${title}" הונחה במיקום ${milestonePositionById(
        over.id as number,
      )} מתוך ${milestoneIds.length}.`;
    },
    onDragCancel({ active }) {
      const title = milestoneTitleById(active.id as number);
      return `שינוי הסדר של אבן הדרך "${title}" בוטל.`;
    },
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragMilestoneId(event.active.id as number);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragMilestoneId(null);

    if (!over || active.id === over.id) return;
    if (isReordering || isSaving) return;

    const oldIndex = milestoneIds.indexOf(active.id as number);
    const newIndex = milestoneIds.indexOf(over.id as number);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextOrder = arrayMove(milestoneIds, oldIndex, newIndex);
    const items = nextOrder.map((id, sortOrder) => ({ projectMilestoneId: id, sortOrder }));

    setReorderError(null);
    try {
      await onReorderMilestones(items);
    } catch (error) {
      setReorderError(error instanceof Error ? error.message : 'סידור אבני הדרך נכשל.');
    }
  };

  const handleDragCancel = () => {
    setActiveDragMilestoneId(null);
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
                  <ListSelect
                    label="מנהל השלב"
                    value={form.managerEmployeeId != null ? String(form.managerEmployeeId) : ''}
                    onChange={(value) => {
                      updateField('managerEmployeeId', value ? Number(value) : null);
                    }}
                    error={managerError ?? undefined}
                    placeholder="בחר עובד"
                    options={[
                      { value: '', label: 'בחר עובד' },
                      ...employees.map((employee) => ({
                        value: String(employee.employeeId),
                        label: employee.fullName,
                      })),
                    ]}
                  />
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
            <EmptyState title="לא נמצאו אבני דרך בטבלה הייעודית לפרויקט זה." />
            <p className="projectMilestonesTab__legacyHint">
              משימות ילד legacy בפרויקט אינן מסווגות אוטומטית כאבני דרך; סיווג מחייב מיפוי מפורש
              ב־_MilestoneMigrationMap על ידי מפעיל.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={dragSensors}
            collisionDetection={closestCenter}
            autoScroll
            accessibility={{ announcements: milestoneDragAnnouncements }}
            onDragStart={handleDragStart}
            onDragEnd={(event) => void handleDragEnd(event)}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={milestoneIds} strategy={verticalListSortingStrategy}>
              {sortedMilestones.map((milestone, index) => {
                const id = milestoneIdOf(milestone);
                const isCancelled =
                  milestone.status === 'Cancelled' ||
                  milestone.status === 'Closed' ||
                  ('isActive' in milestone && milestone.isActive === false);
                const managerName = resolveManagerName(milestone);

                return (
                  <SortableMilestoneCard
                    key={id}
                    milestone={milestone}
                    index={index}
                    total={sortedMilestones.length}
                    isCancelled={isCancelled}
                    managerName={managerName}
                    isReordering={isReordering}
                    isSaving={isSaving}
                    isDragDisabled={isReordering || isSaving}
                    onMove={(milestoneId, direction) =>
                      void handleMoveMilestone(milestoneId, direction)
                    }
                    onEdit={handleEdit}
                    onCancel={(milestoneId) => void handleCancelMilestone(milestoneId)}
                  />
                );
              })}
            </SortableContext>
            <DragOverlay>
              {activeDragMilestone ? (
                <MilestoneDragOverlayCard milestone={activeDragMilestone} />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}

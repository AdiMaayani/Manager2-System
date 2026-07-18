import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
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
import { useInventory, type InventoryItem } from '@features/inventory';
import { StatusBadge } from '@shared/components/StatusBadge';
import { Button } from '@shared/components/Button';
import { ConfirmInline } from '@shared/components/ConfirmInline';
import { EmptyState } from '@shared/components/EmptyState';
import { IconButton } from '@shared/components/IconButton';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { InlineAlert } from '@shared/components/InlineAlert';
import type {
  CreateProjectEquipmentItemRequest,
  ProjectEquipmentItem,
  UpdateProjectEquipmentItemRequest,
} from '../../../../types';
import { EQUIPMENT_STATUS_OPTIONS } from '../../../../utils/projectDisplayUtils';
import './ProjectEquipmentTab.css';

interface ProjectEquipmentTabProps {
  items: ProjectEquipmentItem[];
  isEditMode: boolean;
  isSaving: boolean;
  onCreate: (body: CreateProjectEquipmentItemRequest) => Promise<void>;
  onUpdate: (
    equipmentItemId: number,
    body: UpdateProjectEquipmentItemRequest,
  ) => Promise<void>;
  onDelete: (equipmentItemId: number) => Promise<void>;
  onReorder: (items: ProjectEquipmentItem[]) => Promise<void>;
}

function inventoryLabel(item: InventoryItem): string {
  return `${item.skuCode} · ${item.itemName}`;
}

function getInventoryCategories(inventoryItems: InventoryItem[]): string[] {
  return Array.from(
    new Set(
      inventoryItems
        .map((inventoryItem) => inventoryItem.category?.trim())
        .filter((category): category is string => Boolean(category)),
    ),
  ).sort((firstCategory, secondCategory) => firstCategory.localeCompare(secondCategory, 'he'));
}

interface EquipmentEditCardProps {
  item: ProjectEquipmentItem;
  index: number;
  itemCount: number;
  inventoryItems: InventoryItem[];
  inventoryCategories: string[];
  isSaving: boolean;
  onSave: (
    equipmentItemId: number,
    body: UpdateProjectEquipmentItemRequest,
  ) => Promise<void>;
  onDelete: (equipmentItemId: number) => Promise<void>;
  onMove: (index: number, direction: -1 | 1) => Promise<void>;
  onValidationError: (message: string) => void;
  dragHandle: ReactNode;
  cardRef?: (element: HTMLDivElement | null) => void;
  cardStyle?: CSSProperties;
  isDragging?: boolean;
}

function EquipmentEditCard({
  item,
  index,
  itemCount,
  inventoryItems,
  inventoryCategories,
  isSaving,
  onSave,
  onDelete,
  onMove,
  onValidationError,
  dragHandle,
  cardRef,
  cardStyle,
  isDragging,
}: EquipmentEditCardProps) {
  const [draftName, setDraftName] = useState(item.name);
  const [draftInventoryCategory, setDraftInventoryCategory] = useState(item.inventoryCategory ?? '');
  const [draftInventoryItemId, setDraftInventoryItemId] = useState(
    item.inventoryItemId ? String(item.inventoryItemId) : '',
  );
  const [draftStatus, setDraftStatus] = useState(item.status);
  const [draftLocation, setDraftLocation] = useState(item.location);

  const filteredInventoryItems = draftInventoryCategory
    ? inventoryItems.filter((inventoryItem) => inventoryItem.category === draftInventoryCategory)
    : inventoryItems;

  function handleSelectInventoryItem(inventoryItemId: string) {
    setDraftInventoryItemId(inventoryItemId);
    const inventoryItem = inventoryItems.find(
      (candidate) => candidate.inventoryItemId === Number(inventoryItemId),
    );
    if (!inventoryItem) return;

    setDraftInventoryCategory(inventoryItem.category ?? '');
    setDraftName(inventoryItem.itemName);
    setDraftLocation(inventoryItem.locationName ?? '');
  }

  const saveItem = async () => {
    if (!draftName.trim()) {
      onValidationError('שם הפריט הוא שדה חובה.');
      return;
    }

    await onSave(item.projectEquipmentItemId, {
      equipmentName: draftName.trim(),
      inventoryItemId: draftInventoryItemId ? Number(draftInventoryItemId) : undefined,
      status: draftStatus,
      location: draftLocation.trim() || undefined,
      sortOrder: item.sortOrder,
    });
  };

  return (
    <div
      ref={cardRef}
      style={cardStyle}
      className={`projectEquipmentTab__editCard${
        isDragging ? ' projectEquipmentTab__editCard--dragging' : ''
      }`}
    >
      <div className="projectEquipmentTab__editCardHeader">
        {dragHandle}
        <span className="projectEquipmentTab__editCardKicker">עריכת פריט: {item.name}</span>
      </div>
      <Input
        label="שם"
        value={draftName}
        onChange={(event) => setDraftName(event.target.value)}
      />
      <Select
        label="קטגוריית מלאי"
        value={draftInventoryCategory}
        onChange={(event) => {
          setDraftInventoryCategory(event.target.value);
          setDraftInventoryItemId('');
        }}
      >
        <option value="">כל הקטגוריות</option>
        {inventoryCategories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </Select>
      <Select
        label="פריט מלאי"
        value={draftInventoryItemId}
        onChange={(event) => handleSelectInventoryItem(event.target.value)}
      >
        <option value="">ללא קישור</option>
        {filteredInventoryItems.map((inventoryItem) => (
          <option key={inventoryItem.inventoryItemId} value={inventoryItem.inventoryItemId}>
            {inventoryLabel(inventoryItem)}
          </option>
        ))}
      </Select>
      <Select
        label="סטטוס"
        value={draftStatus}
        onChange={(event) => setDraftStatus(event.target.value)}
      >
        {EQUIPMENT_STATUS_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {option.display}
          </option>
        ))}
      </Select>
      <Input
        label="מיקום"
        value={draftLocation}
        onChange={(event) => setDraftLocation(event.target.value)}
      />
      <div className="projectEquipmentTab__actions">
        <Button type="button" variant="secondary" onClick={saveItem} disabled={isSaving}>
          שמור פריט
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onMove(index, -1)}
          disabled={isSaving || index === 0}
        >
          למעלה
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onMove(index, 1)}
          disabled={isSaving || index === itemCount - 1}
        >
          למטה
        </Button>
        <div className="projectEquipmentTab__dangerSlot">
          <ConfirmInline
            triggerLabel="הסר"
            message="להסיר את הפריט מרשימת הציוד?"
            confirmLabel="אישור הסרה"
            onConfirm={() => onDelete(item.projectEquipmentItemId)}
            isPending={isSaving}
          />
        </div>
      </div>
    </div>
  );
}

interface SortableEquipmentEditCardProps extends Omit<EquipmentEditCardProps, 'dragHandle' | 'cardRef' | 'cardStyle' | 'isDragging'> {
  isDragDisabled: boolean;
}

/** Draggable list item — only the handle receives drag listeners, never the whole card. */
function SortableEquipmentEditCard({ isDragDisabled, ...cardProps }: SortableEquipmentEditCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cardProps.item.projectEquipmentItemId,
    disabled: isDragDisabled,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dragHandle = (
    <IconButton
      label={`גרור לשינוי סדר הפריט: ${cardProps.item.name}`}
      icon={<GripVertical size={16} aria-hidden="true" />}
      variant="ghost"
      size="sm"
      className="projectEquipmentTab__dragHandle"
      disabled={isDragDisabled}
      {...attributes}
      {...listeners}
    />
  );

  return (
    <EquipmentEditCard
      {...cardProps}
      dragHandle={dragHandle}
      cardRef={setNodeRef}
      cardStyle={style}
      isDragging={isDragging}
    />
  );
}

/** Minimal, non-interactive preview shown under the pointer while dragging. */
function EquipmentDragOverlayCard({ item }: { item: ProjectEquipmentItem }) {
  return (
    <div className="projectEquipmentTab__editCard projectEquipmentTab__editCard--overlay">
      <div className="projectEquipmentTab__editCardHeader">
        <span
          className="projectEquipmentTab__dragHandle projectEquipmentTab__dragHandle--active"
          aria-hidden="true"
        >
          <GripVertical size={16} />
        </span>
        <span className="projectEquipmentTab__editCardKicker">{item.name}</span>
      </div>
    </div>
  );
}

export function ProjectEquipmentTab({
  items,
  isEditMode,
  isSaving,
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
}: ProjectEquipmentTabProps) {
  const { data: inventoryItems = [] } = useInventory({ status: 'active', lowStockOnly: false });
  const inventoryCategories = useMemo(
    () => getInventoryCategories(inventoryItems),
    [inventoryItems],
  );
  const [name, setName] = useState('');
  const [inventoryCategory, setInventoryCategory] = useState('');
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [status, setStatus] = useState('waiting');
  const [location, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeDragItemId, setActiveDragItemId] = useState<number | null>(null);

  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const filteredInventoryItems = inventoryCategory
    ? inventoryItems.filter((inventoryItem) => inventoryItem.category === inventoryCategory)
    : inventoryItems;

  function handleSelectInventoryItem(nextInventoryItemId: string) {
    setInventoryItemId(nextInventoryItemId);
    const inventoryItem = inventoryItems.find(
      (candidate) => candidate.inventoryItemId === Number(nextInventoryItemId),
    );
    if (!inventoryItem) return;

    setInventoryCategory(inventoryItem.category ?? '');
    setName(inventoryItem.itemName);
    setLocation(inventoryItem.locationName ?? '');
  }

  // Group items by location so the view mirrors the Inventory layout:
  // a location/category header first, with its products listed inside.
  const groupedByLocation = useMemo(() => {
    const groups = new Map<string, ProjectEquipmentItem[]>();
    [...items]
      .sort((first, second) => first.sortOrder - second.sortOrder)
      .forEach((item) => {
        const groupKey = item.location.trim() || 'ללא מיקום מוגדר';
        const groupItems = groups.get(groupKey) ?? [];
        groupItems.push(item);
        groups.set(groupKey, groupItems);
      });
    return Array.from(groups.entries());
  }, [items]);

  const removeItem = async (equipmentItemId: number) => {
    setError(null);
    await onDelete(equipmentItemId);
  };

  const moveItem = async (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;

    const nextItems = [...items];
    [nextItems[index], nextItems[nextIndex]] = [nextItems[nextIndex], nextItems[index]];
    const reorderedItems = nextItems.map((item, itemIndex) => ({
      ...item,
      sortOrder: itemIndex + 1,
    }));

    setError(null);
    await onReorder(reorderedItems);
  };

  const equipmentItemIds = useMemo(
    () => items.map((item) => item.projectEquipmentItemId),
    [items],
  );

  const activeDragItem =
    activeDragItemId != null
      ? items.find((item) => item.projectEquipmentItemId === activeDragItemId)
      : undefined;

  const equipmentNameById = (equipmentItemId: number): string =>
    items.find((item) => item.projectEquipmentItemId === equipmentItemId)?.name ?? '';

  const equipmentPositionById = (equipmentItemId: number): number =>
    equipmentItemIds.indexOf(equipmentItemId) + 1;

  const equipmentDragAnnouncements: Announcements = {
    onDragStart({ active }) {
      const itemName = equipmentNameById(active.id as number);
      return `הרמת הפריט "${itemName}" לשינוי סדר. המיקום הנוכחי: ${equipmentPositionById(
        active.id as number,
      )} מתוך ${equipmentItemIds.length}.`;
    },
    onDragOver({ active, over }) {
      const itemName = equipmentNameById(active.id as number);
      if (!over) {
        return `הפריט "${itemName}" אינו ממוקם מעל מיקום חדש.`;
      }
      return `הפריט "${itemName}" הועבר למיקום ${equipmentPositionById(
        over.id as number,
      )} מתוך ${equipmentItemIds.length}.`;
    },
    onDragEnd({ active, over }) {
      const itemName = equipmentNameById(active.id as number);
      if (!over) {
        return `שינוי הסדר של הפריט "${itemName}" בוטל.`;
      }
      return `הפריט "${itemName}" הונח במיקום ${equipmentPositionById(
        over.id as number,
      )} מתוך ${equipmentItemIds.length}.`;
    },
    onDragCancel({ active }) {
      const itemName = equipmentNameById(active.id as number);
      return `שינוי הסדר של הפריט "${itemName}" בוטל.`;
    },
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragItemId(event.active.id as number);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItemId(null);

    if (!over || active.id === over.id) return;
    if (isSaving) return;

    const oldIndex = equipmentItemIds.indexOf(active.id as number);
    const newIndex = equipmentItemIds.indexOf(over.id as number);
    if (oldIndex < 0 || newIndex < 0) return;

    const reorderedItems = arrayMove(items, oldIndex, newIndex).map((item, itemIndex) => ({
      ...item,
      sortOrder: itemIndex + 1,
    }));

    setError(null);
    await onReorder(reorderedItems);
  };

  const handleDragCancel = () => {
    setActiveDragItemId(null);
  };

  const addItem = async () => {
    if (!name.trim()) {
      setError('שם הפריט הוא שדה חובה.');
      return;
    }

    setError(null);
    await onCreate({
      equipmentName: name.trim(),
      inventoryItemId: inventoryItemId ? Number(inventoryItemId) : undefined,
      status,
      location: location.trim() || undefined,
      sortOrder: items.length + 1,
    });

    setName('');
    setInventoryCategory('');
    setInventoryItemId('');
    setStatus('waiting');
    setLocation('');
  };

  if (isEditMode) {
    return (
      <div className="projectEquipmentTab">
        {error && <InlineAlert variant="danger">{error}</InlineAlert>}
        <div className="projectEquipmentTab__editList">
          {items.length === 0 ? (
            <EmptyState title="אין ציוד לפרויקט" description="הוסף ציוד כדי לעקוב אחר סטטוס ומיקום." />
          ) : (
            <DndContext
              sensors={dragSensors}
              collisionDetection={closestCenter}
              autoScroll
              accessibility={{ announcements: equipmentDragAnnouncements }}
              onDragStart={handleDragStart}
              onDragEnd={(event) => void handleDragEnd(event)}
              onDragCancel={handleDragCancel}
            >
              <SortableContext items={equipmentItemIds} strategy={verticalListSortingStrategy}>
                {items.map((item, index) => (
                  <SortableEquipmentEditCard
                    key={`${item.projectEquipmentItemId}-${item.updatedAt ?? item.createdAt ?? ''}-${item.sortOrder}`}
                    item={item}
                    index={index}
                    itemCount={items.length}
                    inventoryItems={inventoryItems}
                    inventoryCategories={inventoryCategories}
                    isSaving={isSaving}
                    isDragDisabled={isSaving}
                    onSave={onUpdate}
                    onDelete={removeItem}
                    onMove={moveItem}
                    onValidationError={setError}
                  />
                ))}
              </SortableContext>
              <DragOverlay>
                {activeDragItem ? <EquipmentDragOverlayCard item={activeDragItem} /> : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
        <div className="projectEquipmentTab__addForm">
          <Input label="שם" value={name} onChange={(event) => setName(event.target.value)} />
          <Select
            label="קטגוריית מלאי"
            value={inventoryCategory}
            onChange={(event) => {
              setInventoryCategory(event.target.value);
              setInventoryItemId('');
            }}
          >
            <option value="">כל הקטגוריות</option>
            {inventoryCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
          <Select
            label="פריט מלאי"
            value={inventoryItemId}
            onChange={(event) => handleSelectInventoryItem(event.target.value)}
          >
            <option value="">ללא קישור</option>
            {filteredInventoryItems.map((inventoryItem) => (
              <option key={inventoryItem.inventoryItemId} value={inventoryItem.inventoryItemId}>
                {inventoryLabel(inventoryItem)}
              </option>
            ))}
          </Select>
          <Select
            label="סטטוס"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {EQUIPMENT_STATUS_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.display}
              </option>
            ))}
          </Select>
          <Input
            label="מיקום"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
          <Button type="button" variant="secondary" onClick={addItem} disabled={isSaving}>
            הוסף פריט
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="projectEquipmentTab">
      {items.length === 0 ? (
        <EmptyState title="אין ציוד לפרויקט" description="פריטי ציוד שיוגדרו יופיעו כאן." />
      ) : (
        <div className="projectEquipmentTab__groups">
          {groupedByLocation.map(([groupName, groupItems]) => (
            <section className="projectEquipmentTab__group" key={groupName}>
              <header className="projectEquipmentTab__groupHeader">
                <span className="projectEquipmentTab__groupName">{groupName}</span>
                <span className="projectEquipmentTab__groupCount">{groupItems.length}</span>
              </header>
              <ul className="projectEquipmentTab__groupList">
                {groupItems.map((item) => (
                  <li
                    className="projectEquipmentTab__groupItem"
                    key={item.projectEquipmentItemId}
                  >
                    <span className="projectEquipmentTab__itemName">{item.name}</span>
                    {item.inventorySkuCode && (
                      <span className="projectEquipmentTab__inventoryMeta">
                        {item.inventorySkuCode}
                        {item.inventoryCategory ? ` · ${item.inventoryCategory}` : ''}
                      </span>
                    )}
                    <StatusBadge domain="equipment" status={item.status} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { EmptyState } from '@shared/components/EmptyState';
import { Input } from '@shared/components/Input';
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

function getEquipmentStatusLabel(status: string): string {
  return EQUIPMENT_STATUS_OPTIONS.find((option) => option.code === status)?.display ?? status;
}

interface EquipmentEditCardProps {
  item: ProjectEquipmentItem;
  index: number;
  itemCount: number;
  isSaving: boolean;
  onSave: (
    equipmentItemId: number,
    body: UpdateProjectEquipmentItemRequest,
  ) => Promise<void>;
  onDelete: (equipmentItemId: number) => Promise<void>;
  onMove: (index: number, direction: -1 | 1) => Promise<void>;
  onValidationError: (message: string) => void;
}

function EquipmentEditCard({
  item,
  index,
  itemCount,
  isSaving,
  onSave,
  onDelete,
  onMove,
  onValidationError,
}: EquipmentEditCardProps) {
  const [draftName, setDraftName] = useState(item.name);
  const [draftStatus, setDraftStatus] = useState(item.status);
  const [draftLocation, setDraftLocation] = useState(item.location);

  const saveItem = async () => {
    if (!draftName.trim()) {
      onValidationError('שם הפריט הוא שדה חובה.');
      return;
    }

    await onSave(item.projectEquipmentItemId, {
      equipmentName: draftName.trim(),
      status: draftStatus,
      location: draftLocation.trim() || undefined,
      sortOrder: item.sortOrder,
    });
  };

  return (
    <div className="projectEquipmentTab__editCard">
      <Input
        label="שם"
        value={draftName}
        onChange={(event) => setDraftName(event.target.value)}
      />
      <label className="projectEquipmentTab__field">
        <span>סטטוס</span>
        <select
          className="projectEquipmentTab__select"
          value={draftStatus}
          onChange={(event) => setDraftStatus(event.target.value)}
        >
          {EQUIPMENT_STATUS_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.display}
            </option>
          ))}
        </select>
      </label>
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
        <Button
          type="button"
          variant="ghost"
          onClick={() => onDelete(item.projectEquipmentItemId)}
          disabled={isSaving}
        >
          הסר
        </Button>
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
  const [name, setName] = useState('');
  const [status, setStatus] = useState('waiting');
  const [location, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);

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

  const addItem = async () => {
    if (!name.trim()) {
      setError('שם הפריט הוא שדה חובה.');
      return;
    }

    setError(null);
    await onCreate({
      equipmentName: name.trim(),
      status,
      location: location.trim() || undefined,
      sortOrder: items.length + 1,
    });

    setName('');
    setStatus('waiting');
    setLocation('');
  };

  if (isEditMode) {
    return (
      <div className="projectEquipmentTab">
        {error && <div className="projectEquipmentTab__error">{error}</div>}
        <div className="projectEquipmentTab__editList">
          {items.map((item, index) => (
            <EquipmentEditCard
              key={`${item.projectEquipmentItemId}-${item.updatedAt ?? item.createdAt ?? ''}-${item.sortOrder}`}
              item={item}
              index={index}
              itemCount={items.length}
              isSaving={isSaving}
              onSave={onUpdate}
              onDelete={removeItem}
              onMove={moveItem}
              onValidationError={setError}
            />
          ))}
          {items.length === 0 && (
            <EmptyState title="אין ציוד לפרויקט" description="הוסף ציוד כדי לעקוב אחר סטטוס ומיקום." />
          )}
        </div>
        <div className="projectEquipmentTab__addForm">
          <Input label="שם" value={name} onChange={(event) => setName(event.target.value)} />
          <label className="projectEquipmentTab__field">
            <span>סטטוס</span>
            <select
              className="projectEquipmentTab__select"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {EQUIPMENT_STATUS_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.display}
                </option>
              ))}
            </select>
          </label>
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
                    <Badge variant="primary">{getEquipmentStatusLabel(item.status)}</Badge>
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

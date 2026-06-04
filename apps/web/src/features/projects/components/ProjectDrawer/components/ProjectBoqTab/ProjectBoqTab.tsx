import { useEffect, useMemo, useState } from 'react';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import type {
  CreateProjectBoqItemRequest,
  ProjectBoqItem,
  UpdateProjectBoqItemRequest,
} from '../../../../types';
import { BOQ_UNIT_OPTIONS } from '../../../../utils/projectDisplayUtils';
import './ProjectBoqTab.css';

interface ProjectBoqTabProps {
  items: ProjectBoqItem[];
  isEditMode: boolean;
  isSaving: boolean;
  onCreate: (body: CreateProjectBoqItemRequest) => Promise<void>;
  onUpdate: (boqItemId: number, body: UpdateProjectBoqItemRequest) => Promise<void>;
  onDelete: (boqItemId: number) => Promise<void>;
  onReorder: (items: ProjectBoqItem[]) => Promise<void>;
}

interface BoqDraft {
  systemName: string;
  itemDescription: string;
  quantity: string;
  unit: string;
}

const EMPTY_BOQ_DRAFT: BoqDraft = {
  systemName: '',
  itemDescription: '',
  quantity: '1',
  unit: BOQ_UNIT_OPTIONS[0],
};

function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : String(quantity);
}

function draftFromItem(item: ProjectBoqItem): BoqDraft {
  return {
    systemName: item.systemName ?? '',
    itemDescription: item.itemDescription,
    quantity: formatQuantity(item.quantity),
    unit: item.unit,
  };
}

function buildBoqRequest(
  draft: BoqDraft,
): Omit<UpdateProjectBoqItemRequest, 'sortOrder'> | { error: string } {
  const itemDescription = draft.itemDescription.trim();
  const unit = draft.unit.trim();
  const quantity = Number(draft.quantity.replace(',', '.'));

  if (!itemDescription) {
    return { error: 'יש להזין תיאור פריט.' };
  }

  if (Number.isNaN(quantity) || quantity <= 0) {
    return { error: 'כמות חייבת להיות מספר גדול מ-0.' };
  }

  if (!unit) {
    return { error: 'יש לבחור יחידה.' };
  }

  return {
    systemName: draft.systemName.trim() || undefined,
    itemDescription,
    quantity,
    unit,
  };
}

export function ProjectBoqTab({
  items,
  isEditMode,
  isSaving,
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
}: ProjectBoqTabProps) {
  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (firstItem, secondItem) =>
          firstItem.sortOrder - secondItem.sortOrder ||
          firstItem.projectBoqItemId - secondItem.projectBoqItemId,
      ),
    [items],
  );
  const [drafts, setDrafts] = useState<Record<number, BoqDraft>>({});
  const [newItemDraft, setNewItemDraft] = useState<BoqDraft>(EMPTY_BOQ_DRAFT);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        sortedItems.map((item) => [item.projectBoqItemId, draftFromItem(item)]),
      ),
    );
  }, [sortedItems]);

  const updateDraft = (boqItemId: number, patch: Partial<BoqDraft>) => {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [boqItemId]: {
        ...(currentDrafts[boqItemId] ?? EMPTY_BOQ_DRAFT),
        ...patch,
      },
    }));
  };

  const handleCreate = async () => {
    setError(null);
    const request = buildBoqRequest(newItemDraft);

    if ('error' in request) {
      setError(request.error);
      return;
    }

    try {
      await onCreate({
        ...request,
        sortOrder: sortedItems.length + 1,
      });
      setNewItemDraft(EMPTY_BOQ_DRAFT);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'שמירת פריט כתב הכמויות נכשלה.');
    }
  };

  const handleUpdate = async (item: ProjectBoqItem) => {
    setError(null);
    const request = buildBoqRequest(drafts[item.projectBoqItemId] ?? draftFromItem(item));

    if ('error' in request) {
      setError(request.error);
      return;
    }

    try {
      await onUpdate(item.projectBoqItemId, {
        ...request,
        sortOrder: item.sortOrder,
      });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'עדכון פריט כתב הכמויות נכשל.');
    }
  };

  const handleDelete = async (boqItemId: number) => {
    setError(null);

    try {
      await onDelete(boqItemId);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'מחיקת פריט כתב הכמויות נכשלה.');
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sortedItems.length) return;

    const nextItems = [...sortedItems];
    [nextItems[index], nextItems[targetIndex]] = [nextItems[targetIndex], nextItems[index]];
    setError(null);

    try {
      await onReorder(nextItems);
    } catch (reorderError) {
      setError(reorderError instanceof Error ? reorderError.message : 'סידור כתב הכמויות נכשל.');
    }
  };

  if (isEditMode) {
    return (
      <div className="projectBoqTab">
        {error && <div className="projectBoqTab__error">{error}</div>}
        {sortedItems.length === 0 && (
          <p className="projectBoqTab__empty">אין עדיין פריטי כתב כמויות לפרויקט.</p>
        )}
        <table className="projectBoqTab__table">
          <thead>
            <tr>
              <th>מערכת</th>
              <th>פריט</th>
              <th>כמות</th>
              <th>יחידה</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, index) => {
              const draft = drafts[item.projectBoqItemId] ?? draftFromItem(item);

              return (
                <tr key={item.projectBoqItemId}>
                  <td>
                    <Input
                      value={draft.systemName}
                      onChange={(event) =>
                        updateDraft(item.projectBoqItemId, { systemName: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <Input
                      value={draft.itemDescription}
                      onChange={(event) =>
                        updateDraft(item.projectBoqItemId, {
                          itemDescription: event.target.value,
                        })
                      }
                    />
                  </td>
                  <td>
                    <Input
                      value={draft.quantity}
                      onChange={(event) =>
                        updateDraft(item.projectBoqItemId, { quantity: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <select
                      className="projectBoqTab__select"
                      value={draft.unit}
                      onChange={(event) =>
                        updateDraft(item.projectBoqItemId, { unit: event.target.value })
                      }
                    >
                      {BOQ_UNIT_OPTIONS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="projectBoqTab__actions">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleUpdate(item)}
                        disabled={isSaving}
                      >
                        שמור פריט
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleMove(index, -1)}
                        disabled={isSaving || index === 0}
                      >
                        למעלה
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleMove(index, 1)}
                        disabled={isSaving || index === sortedItems.length - 1}
                      >
                        למטה
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleDelete(item.projectBoqItemId)}
                        disabled={isSaving}
                      >
                        הסר
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            <tr>
              <td>
                <Input
                  value={newItemDraft.systemName}
                  onChange={(event) =>
                    setNewItemDraft((currentDraft) => ({
                      ...currentDraft,
                      systemName: event.target.value,
                    }))
                  }
                />
              </td>
              <td>
                <Input
                  value={newItemDraft.itemDescription}
                  onChange={(event) =>
                    setNewItemDraft((currentDraft) => ({
                      ...currentDraft,
                      itemDescription: event.target.value,
                    }))
                  }
                />
              </td>
              <td>
                <Input
                  value={newItemDraft.quantity}
                  onChange={(event) =>
                    setNewItemDraft((currentDraft) => ({
                      ...currentDraft,
                      quantity: event.target.value,
                    }))
                  }
                />
              </td>
              <td>
                <select
                  className="projectBoqTab__select"
                  value={newItemDraft.unit}
                  onChange={(event) =>
                    setNewItemDraft((currentDraft) => ({
                      ...currentDraft,
                      unit: event.target.value,
                    }))
                  }
                >
                  {BOQ_UNIT_OPTIONS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCreate}
                  disabled={isSaving}
                >
                  הוסף שורה
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  if (sortedItems.length === 0) {
    return (
      <div className="projectBoqTab">
        <p className="projectBoqTab__empty">אין עדיין פריטי כתב כמויות לפרויקט.</p>
      </div>
    );
  }

  return (
    <div className="projectBoqTab">
      <table className="projectBoqTab__table">
        <thead>
          <tr>
            <th>מערכת</th>
            <th>פריט</th>
            <th>כמות</th>
            <th>יחידה</th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item) => (
            <tr key={item.projectBoqItemId}>
              <td>{item.systemName || '-'}</td>
              <td>{item.itemDescription}</td>
              <td>{formatQuantity(item.quantity)}</td>
              <td>{item.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

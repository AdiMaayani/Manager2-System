import { useMemo, useState } from 'react';
import { useInventory, type InventoryItem } from '@features/inventory';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { InlineAlert } from '@shared/components/InlineAlert';
import type {
  CreateProjectBoqItemRequest,
  ProjectBoqItem,
  UpdateProjectBoqItemRequest,
} from '../../../../types';
import { BOQ_UNIT_OPTIONS } from '../../../../utils/projectDisplayUtils';
import {
  applyBoqDraftOverride,
  buildBoqDraftMap,
  clearBoqDraftOverride,
  draftFromBoqItem,
  EMPTY_BOQ_DRAFT,
  formatBoqQuantity,
  type BoqDraft,
  type BoqDraftOverrides,
} from './projectBoqDrafts';
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

function inventoryLabel(item: InventoryItem): string {
  return `${item.skuCode} · ${item.itemName}`;
}

function buildBoqRequest(
  draft: BoqDraft,
): Omit<UpdateProjectBoqItemRequest, 'sortOrder'> | { error: string } {
  const itemDescription = draft.itemDescription.trim();
  const unit = draft.unit.trim();
  const quantity = Number(draft.quantity.replace(',', '.'));
  const unitPriceText = draft.unitPrice.trim().replace(',', '.');
  const unitPrice = unitPriceText ? Number(unitPriceText) : undefined;

  if (!itemDescription) {
    return { error: 'יש להזין תיאור פריט.' };
  }

  if (Number.isNaN(quantity) || quantity <= 0) {
    return { error: 'כמות חייבת להיות מספר גדול מ-0.' };
  }

  if (!unit) {
    return { error: 'יש לבחור יחידה.' };
  }

  if (unitPrice != null && (Number.isNaN(unitPrice) || unitPrice < 0)) {
    return { error: 'מחיר יחידה חייב להיות מספר לא שלילי.' };
  }

  return {
    systemName: draft.systemName.trim() || undefined,
    inventoryItemId: draft.inventoryItemId ? Number(draft.inventoryItemId) : undefined,
    itemDescription,
    quantity,
    unit,
    unitPrice,
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
  const { data: inventoryItems = [] } = useInventory({ status: 'active', lowStockOnly: false });
  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (firstItem, secondItem) =>
          firstItem.sortOrder - secondItem.sortOrder ||
          firstItem.projectBoqItemId - secondItem.projectBoqItemId,
      ),
    [items],
  );
  // Only the fields a user has actually edited are stored, per row, as partial overrides; every
  // other field is derived from the server row. A background query refresh therefore never clobbers
  // unsaved edits, untouched fields on a dirty row still follow the server, and there is no effect
  // copying the server list into local state.
  const [overrides, setOverrides] = useState<BoqDraftOverrides>({});
  const drafts = useMemo(() => buildBoqDraftMap(sortedItems, overrides), [sortedItems, overrides]);
  const [newItemDraft, setNewItemDraft] = useState<BoqDraft>(EMPTY_BOQ_DRAFT);
  const [error, setError] = useState<string | null>(null);

  const inventoryCategories = useMemo(
    () =>
      Array.from(
        new Set(
          inventoryItems
            .map((inventoryItem) => inventoryItem.category?.trim())
            .filter((category): category is string => Boolean(category)),
        ),
      ).sort((firstCategory, secondCategory) => firstCategory.localeCompare(secondCategory, 'he')),
    [inventoryItems],
  );

  const inventoryItemsByCategory = useMemo(() => {
    const itemsByCategory = new Map<string, InventoryItem[]>();
    inventoryItems.forEach((inventoryItem) => {
      const key = inventoryItem.category?.trim() || 'ללא קטגוריה';
      const categoryItems = itemsByCategory.get(key) ?? [];
      categoryItems.push(inventoryItem);
      itemsByCategory.set(key, categoryItems);
    });
    return itemsByCategory;
  }, [inventoryItems]);

  function getFilteredInventoryItems(category: string): InventoryItem[] {
    if (!category) return inventoryItems;
    return inventoryItemsByCategory.get(category) ?? [];
  }

  const updateDraft = (boqItemId: number, patch: Partial<BoqDraft>) => {
    // Store only the edited fields; the functional updater merges successive patches so multiple
    // edits to the same row accumulate without freezing untouched fields against server refreshes.
    setOverrides((current) => applyBoqDraftOverride(current, boqItemId, patch));
  };

  const applyInventoryItemToDraft = (
    inventoryItemId: string,
    setDraft: (patch: Partial<BoqDraft>) => void,
  ) => {
    const inventoryItem = inventoryItems.find(
      (item) => item.inventoryItemId === Number(inventoryItemId),
    );

    if (!inventoryItem) {
      setDraft({ inventoryItemId: '', inventoryCategory: '' });
      return;
    }

    setDraft({
      inventoryItemId,
      inventoryCategory: inventoryItem.category ?? '',
      systemName: inventoryItem.category ?? '',
      itemDescription: inventoryItem.itemName,
      unit: inventoryItem.unit || BOQ_UNIT_OPTIONS[0],
    });
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
    const request = buildBoqRequest(drafts[item.projectBoqItemId] ?? draftFromBoqItem(item));

    if ('error' in request) {
      setError(request.error);
      return;
    }

    try {
      await onUpdate(item.projectBoqItemId, {
        ...request,
        sortOrder: item.sortOrder,
      });
      // The row is now saved; drop its override so it reconciles with the refreshed server value.
      setOverrides((current) => clearBoqDraftOverride(current, item.projectBoqItemId));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'עדכון פריט כתב הכמויות נכשל.');
    }
  };

  const handleDelete = async (boqItemId: number) => {
    setError(null);

    try {
      await onDelete(boqItemId);
      setOverrides((current) => clearBoqDraftOverride(current, boqItemId));
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
        {error && <InlineAlert variant="danger">{error}</InlineAlert>}
        {sortedItems.length === 0 && (
          <p className="projectBoqTab__empty">אין עדיין פריטי כתב כמויות לפרויקט.</p>
        )}
        <table className="projectBoqTab__table">
          <thead>
            <tr>
              <th>מערכת</th>
              <th>קטגוריה</th>
              <th>פריט מלאי</th>
              <th>פריט</th>
              <th>כמות</th>
              <th>יחידה</th>
              <th>מחיר יחידה</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, index) => {
              const draft = drafts[item.projectBoqItemId] ?? draftFromBoqItem(item);

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
                    <Select
                      value={draft.inventoryCategory}
                      onChange={(event) =>
                        updateDraft(item.projectBoqItemId, {
                          inventoryCategory: event.target.value,
                          inventoryItemId: '',
                        })
                      }
                    >
                      <option value="">כל הקטגוריות</option>
                      {inventoryCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td>
                    <Select
                      value={draft.inventoryItemId}
                      onChange={(event) =>
                        applyInventoryItemToDraft(event.target.value, (patch) =>
                          updateDraft(item.projectBoqItemId, patch),
                        )
                      }
                    >
                      <option value="">ללא קישור</option>
                      {getFilteredInventoryItems(draft.inventoryCategory).map((inventoryItem) => (
                        <option
                          key={inventoryItem.inventoryItemId}
                          value={inventoryItem.inventoryItemId}
                        >
                          {inventoryLabel(inventoryItem)}
                        </option>
                      ))}
                    </Select>
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
                    <Select
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
                    </Select>
                  </td>
                  <td>
                    <Input
                      value={draft.unitPrice}
                      onChange={(event) =>
                        updateDraft(item.projectBoqItemId, { unitPrice: event.target.value })
                      }
                    />
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
                <Select
                  value={newItemDraft.inventoryCategory}
                  onChange={(event) =>
                    setNewItemDraft((currentDraft) => ({
                      ...currentDraft,
                      inventoryCategory: event.target.value,
                      inventoryItemId: '',
                    }))
                  }
                >
                  <option value="">כל הקטגוריות</option>
                  {inventoryCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </td>
              <td>
                <Select
                  value={newItemDraft.inventoryItemId}
                  onChange={(event) =>
                    applyInventoryItemToDraft(event.target.value, (patch) =>
                      setNewItemDraft((currentDraft) => ({ ...currentDraft, ...patch })),
                    )
                  }
                >
                  <option value="">ללא קישור</option>
                  {getFilteredInventoryItems(newItemDraft.inventoryCategory).map((inventoryItem) => (
                    <option
                      key={inventoryItem.inventoryItemId}
                      value={inventoryItem.inventoryItemId}
                    >
                      {inventoryLabel(inventoryItem)}
                    </option>
                  ))}
                </Select>
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
                <Select
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
                </Select>
              </td>
              <td>
                <Input
                  value={newItemDraft.unitPrice}
                  onChange={(event) =>
                    setNewItemDraft((currentDraft) => ({
                      ...currentDraft,
                      unitPrice: event.target.value,
                    }))
                  }
                />
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
            <th>מלאי</th>
            <th>פריט</th>
            <th>כמות</th>
            <th>יחידה</th>
            <th>מחיר יחידה</th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item) => (
            <tr key={item.projectBoqItemId}>
              <td>{item.systemName || '-'}</td>
              <td>{item.inventorySkuCode ? `${item.inventorySkuCode} · ${item.inventoryItemName}` : '-'}</td>
              <td>{item.itemDescription}</td>
              <td>{formatBoqQuantity(item.quantity)}</td>
              <td>{item.unit}</td>
              <td>{item.unitPrice != null ? item.unitPrice.toLocaleString('he-IL') : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

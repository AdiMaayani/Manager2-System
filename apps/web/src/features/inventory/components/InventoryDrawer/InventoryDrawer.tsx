import { useState } from 'react';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { DetailsField } from '@shared/components/DetailsField';
import { DetailsSection } from '@shared/components/DetailsSection';
import { Drawer } from '@shared/components/Drawer';
import { Input } from '@shared/components/Input';
import { Textarea } from '@shared/components/Textarea';
import { Checkbox } from '@shared/components/Checkbox';
import { InlineAlert } from '@shared/components/InlineAlert';
import { ConfirmInline } from '@shared/components/ConfirmInline';
import { useInventoryMutations } from '../../hooks/useInventory';
import type { CreateInventoryItemRequest, InventoryItem } from '../../types';
import './InventoryDrawer.css';

const UNIT_OPTIONS = ['יח׳', 'מ׳', 'ק״ג', 'סט', 'גליל'];
const CATEGORY_OPTIONS = ['בקרי חשמל', 'מצלמות', 'רמקולים', 'מתגים', 'כבלים', 'ארונות תקשורת'];

interface InventoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (inventoryItem: InventoryItem) => void | Promise<void>;
  inventoryItem?: InventoryItem | null;
}

interface InventoryFormState {
  skuCode: string;
  itemName: string;
  category: string;
  quantityOnHand: string;
  unit: string;
  minimumQuantity: string;
  locationName: string;
  notes: string;
  isActive: boolean;
}

function buildInitialState(inventoryItem: InventoryItem | null): InventoryFormState {
  return {
    skuCode: inventoryItem?.skuCode ?? '',
    itemName: inventoryItem?.itemName ?? '',
    category: inventoryItem?.category ?? '',
    quantityOnHand: inventoryItem?.quantityOnHand?.toString() ?? '0',
    unit: inventoryItem?.unit ?? UNIT_OPTIONS[0],
    minimumQuantity: inventoryItem?.minimumQuantity?.toString() ?? '',
    locationName: inventoryItem?.locationName ?? '',
    notes: inventoryItem?.notes ?? '',
    isActive: inventoryItem?.isActive ?? true,
  };
}

function parseRequiredQuantity(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalQuantity(value: string): number | undefined | null {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatQuantity(value: number, unit: string): string {
  return `${value.toLocaleString('he-IL', { maximumFractionDigits: 3 })} ${unit}`;
}

function isLowStock(inventoryItem: InventoryItem): boolean {
  return (
    inventoryItem.minimumQuantity !== undefined &&
    inventoryItem.minimumQuantity !== null &&
    inventoryItem.quantityOnHand <= inventoryItem.minimumQuantity
  );
}

export function InventoryDrawer({ isOpen, onClose, onSaved, inventoryItem }: InventoryDrawerProps) {
  if (!isOpen) return null;

  // Remount per item so form/edit state always resets when the drawer
  // opens for a different record (or switches from create to a saved record).
  return (
    <InventoryDrawerContent
      key={inventoryItem?.inventoryItemId ?? 'new'}
      inventoryItem={inventoryItem ?? null}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

interface InventoryDrawerContentProps {
  inventoryItem: InventoryItem | null;
  onClose: () => void;
  onSaved?: (inventoryItem: InventoryItem) => void | Promise<void>;
}

function InventoryDrawerContent({ inventoryItem, onClose, onSaved }: InventoryDrawerContentProps) {
  const isExistingItem = inventoryItem != null;
  const { createMutation, updateMutation, deactivateMutation } = useInventoryMutations();

  // Existing items open in read-only review mode; create opens editable.
  const [isEditing, setIsEditing] = useState(!isExistingItem);
  const [form, setForm] = useState<InventoryFormState>(() => buildInitialState(inventoryItem));
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof InventoryFormState>(key: K, value: InventoryFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleStartEdit() {
    setForm(buildInitialState(inventoryItem));
    setError(null);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    if (!isExistingItem) {
      onClose();
      return;
    }

    setForm(buildInitialState(inventoryItem));
    setError(null);
    setIsEditing(false);
  }

  function buildRequest(): CreateInventoryItemRequest | null {
    const quantityOnHand = parseRequiredQuantity(form.quantityOnHand);
    const minimumQuantity = parseOptionalQuantity(form.minimumQuantity);

    if (!form.skuCode.trim()) {
      setError('מק״ט הוא שדה חובה.');
      return null;
    }

    if (!form.itemName.trim()) {
      setError('שם פריט הוא שדה חובה.');
      return null;
    }

    if (!form.unit.trim()) {
      setError('יחידת מידה היא שדה חובה.');
      return null;
    }

    if (quantityOnHand == null || quantityOnHand < 0) {
      setError('כמות חייבת להיות מספר לא שלילי.');
      return null;
    }

    if (minimumQuantity === null || (minimumQuantity !== undefined && minimumQuantity < 0)) {
      setError('סף מינימום חייב להיות מספר לא שלילי.');
      return null;
    }

    return {
      skuCode: form.skuCode.trim(),
      itemName: form.itemName.trim(),
      category: form.category.trim() || undefined,
      quantityOnHand,
      unit: form.unit.trim(),
      minimumQuantity,
      locationName: form.locationName.trim() || undefined,
      notes: form.notes.trim() || undefined,
      isActive: form.isActive,
    };
  }

  async function handleSave() {
    const request = buildRequest();
    if (!request) return;

    setError(null);

    try {
      let savedInventoryItem: InventoryItem;
      if (isExistingItem) {
        const updatedInventoryItem = await updateMutation.mutateAsync({
          id: inventoryItem.inventoryItemId,
          request,
        });
        savedInventoryItem = updatedInventoryItem ?? { ...inventoryItem, ...request };
      } else {
        savedInventoryItem = await createMutation.mutateAsync(request);
      }

      setIsEditing(false);
      await onSaved?.(savedInventoryItem);

      // Without a parent to hand the saved record back to, fall back to the
      // previous behavior of closing after a successful save.
      if (!onSaved) {
        onClose();
      }
    } catch (err) {
      setIsEditing(true);
      setError(err instanceof Error ? err.message : 'שמירת פריט נכשלה');
    }
  }

  async function handleDeactivate() {
    if (!isExistingItem) return;
    setError(null);

    try {
      await deactivateMutation.mutateAsync(inventoryItem.inventoryItemId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ביטול פעילות פריט נכשל');
    }
  }

  const isSaving =
    createMutation.isPending || updateMutation.isPending || deactivateMutation.isPending;

  const title = !isExistingItem
    ? 'פריט מלאי חדש'
    : isEditing
      ? `עריכת פריט — ${inventoryItem.itemName}`
      : `פרטי פריט — ${inventoryItem.itemName}`;

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={title}
      headerActions={
        isExistingItem && !isEditing ? (
          <Button type="button" variant="secondary" onClick={handleStartEdit}>
            ערוך פרטים
          </Button>
        ) : undefined
      }
      footer={
        isEditing ? (
          <div className="inventoryDrawer__footerContent">
            {error && <InlineAlert variant="danger">{error}</InlineAlert>}
            <div className="inventoryDrawer__actions">
              <Button onClick={handleSave} isLoading={isSaving}>
                שמור
              </Button>
              <Button variant="secondary" onClick={handleCancelEdit} disabled={isSaving}>
                בטל שינויים
              </Button>

              {isExistingItem && inventoryItem.isActive && (
                <div className="inventoryDrawer__dangerActions">
                  <ConfirmInline
                    triggerLabel="השבת פריט"
                    message="להשבית את הפריט?"
                    confirmLabel="אישור השבתה"
                    onConfirm={handleDeactivate}
                    isPending={isSaving}
                  />
                </div>
              )}
            </div>
          </div>
        ) : undefined
      }
    >
      {!isEditing && isExistingItem ? (
        <InventoryReviewDetails inventoryItem={inventoryItem} />
      ) : (
        <div className="inventoryDrawer inventoryDrawer--edit">
          <DetailsSection title="פרטים כלליים">
            <Input
              label="שם פריט"
              value={form.itemName}
              onChange={(event) => setField('itemName', event.target.value)}
              required
            />
            <div className="inventoryDrawer__grid">
              <Input
                label="מק״ט"
                value={form.skuCode}
                onChange={(event) => setField('skuCode', event.target.value)}
                required
              />

              <Input
                label="קטגוריה"
                list="inventoryCategoryOptions"
                value={form.category}
                onChange={(event) => setField('category', event.target.value)}
              />
              <datalist id="inventoryCategoryOptions">
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>

            {isExistingItem && (
              <Checkbox
                label="פריט פעיל"
                checked={form.isActive}
                onChange={(event) => setField('isActive', event.target.checked)}
              />
            )}
          </DetailsSection>

          <DetailsSection title="מלאי">
            <div className="inventoryDrawer__grid">
              <Input
                label="כמות"
                type="number"
                min="0"
                step="0.001"
                value={form.quantityOnHand}
                onChange={(event) => setField('quantityOnHand', event.target.value)}
                required
              />

              <Input
                label="יחידה"
                list="inventoryUnitOptions"
                value={form.unit}
                onChange={(event) => setField('unit', event.target.value)}
                required
              />
              <datalist id="inventoryUnitOptions">
                {UNIT_OPTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>

              <Input
                label="סף מינימום"
                type="number"
                min="0"
                step="0.001"
                value={form.minimumQuantity}
                onChange={(event) => setField('minimumQuantity', event.target.value)}
              />
            </div>
          </DetailsSection>

          <DetailsSection title="מיקום">
            <div className="inventoryDrawer__grid">
              <Input
                label="מיקום"
                value={form.locationName}
                onChange={(event) => setField('locationName', event.target.value)}
              />
            </div>
          </DetailsSection>

          <DetailsSection title="הערות">
            <Textarea
              label="הערות"
              rows={3}
              value={form.notes}
              onChange={(event) => setField('notes', event.target.value)}
            />
          </DetailsSection>
        </div>
      )}
    </Drawer>
  );
}

interface InventoryReviewDetailsProps {
  inventoryItem: InventoryItem;
}

function InventoryReviewDetails({ inventoryItem }: InventoryReviewDetailsProps) {
  const isItemLowOnStock = isLowStock(inventoryItem);

  return (
    <div className="inventoryDrawer inventoryDrawer--review">
      <DetailsSection title="פרטי פריט">
        <div className="inventoryDrawer__detailsGrid">
          <DetailsField label="שם פריט" value={inventoryItem.itemName} />
          <DetailsField
            label="מק״ט"
            value={<span className="inventoryDrawer__skuValue">{inventoryItem.skuCode}</span>}
          />
          <DetailsField label="קטגוריה" value={inventoryItem.category} />
          <DetailsField
            label="סטטוס"
            value={
              <span className="inventoryDrawer__statusBadges">
                <Badge variant={inventoryItem.isActive ? 'success' : 'neutral'}>
                  {inventoryItem.isActive ? 'פעיל' : 'לא פעיל'}
                </Badge>
                {isItemLowOnStock && <Badge variant="warning">מלאי נמוך</Badge>}
              </span>
            }
          />
        </div>
      </DetailsSection>

      <DetailsSection title="מלאי וזמינות">
        <div className="inventoryDrawer__detailsGrid">
          <DetailsField
            label="כמות במלאי"
            value={
              <span className={isItemLowOnStock ? 'inventoryDrawer__lowStockValue' : undefined}>
                {formatQuantity(inventoryItem.quantityOnHand, inventoryItem.unit)}
              </span>
            }
          />
          <DetailsField
            label="סף מינימום"
            value={
              inventoryItem.minimumQuantity == null
                ? undefined
                : formatQuantity(inventoryItem.minimumQuantity, inventoryItem.unit)
            }
          />
          <DetailsField label="יחידת מידה" value={inventoryItem.unit} />
        </div>
        {isItemLowOnStock && (
          <p className="inventoryDrawer__lowStockHint">
            הכמות במלאי נמוכה מסף המינימום שהוגדר לפריט.
          </p>
        )}
      </DetailsSection>

      <DetailsSection title="מיקום">
        <div className="inventoryDrawer__detailsGrid">
          <DetailsField label="מיקום אחסון" value={inventoryItem.locationName} />
        </div>
      </DetailsSection>

      <DetailsSection title="הערות">
        <DetailsField label="הערות" value={inventoryItem.notes} />
      </DetailsSection>
    </div>
  );
}

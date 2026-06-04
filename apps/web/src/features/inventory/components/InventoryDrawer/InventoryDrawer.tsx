import { useEffect, useState } from 'react';
import { Button } from '@shared/components/Button';
import { Drawer } from '@shared/components/Drawer';
import { Input } from '@shared/components/Input';
import { useInventoryMutations } from '../../hooks/useInventory';
import type { CreateInventoryItemRequest, InventoryItem } from '../../types';
import './InventoryDrawer.css';

const UNIT_OPTIONS = ['יח׳', 'מ׳', 'ק״ג', 'סט', 'גליל'];
const CATEGORY_OPTIONS = ['בקרי חשמל', 'מצלמות', 'רמקולים', 'מתגים', 'כבלים', 'ארונות תקשורת'];

interface InventoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
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

function buildInitialState(inventoryItem: InventoryItem | null | undefined): InventoryFormState {
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

export function InventoryDrawer({ isOpen, onClose, inventoryItem }: InventoryDrawerProps) {
  const isEditMode = inventoryItem != null;
  const { createMutation, updateMutation, deactivateMutation } = useInventoryMutations();

  const [form, setForm] = useState<InventoryFormState>(() => buildInitialState(inventoryItem));
  const [error, setError] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(buildInitialState(inventoryItem));
      setError(null);
      setConfirmDeactivate(false);
    }
  }, [isOpen, inventoryItem]);

  function setField<K extends keyof InventoryFormState>(key: K, value: InventoryFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
      if (isEditMode) {
        await updateMutation.mutateAsync({ id: inventoryItem.inventoryItemId, request });
      } else {
        await createMutation.mutateAsync(request);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירת פריט נכשלה');
    }
  }

  async function handleDeactivate() {
    if (!isEditMode) return;
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

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? `עריכת פריט — ${inventoryItem.itemName}` : 'פריט מלאי חדש'}
    >
      <div className="inventoryDrawer">
        <div className="inventoryDrawer__grid">
          <Input
            label="מק״ט *"
            value={form.skuCode}
            onChange={(event) => setField('skuCode', event.target.value)}
            required
          />

          <Input
            label="שם פריט *"
            value={form.itemName}
            onChange={(event) => setField('itemName', event.target.value)}
            required
          />

          <div className="inventoryDrawer__field">
            <label className="inventoryDrawer__label">קטגוריה</label>
            <input
              className="inventoryDrawer__input"
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

          <Input
            label="מיקום"
            value={form.locationName}
            onChange={(event) => setField('locationName', event.target.value)}
          />

          <Input
            label="כמות *"
            type="number"
            min="0"
            step="0.001"
            value={form.quantityOnHand}
            onChange={(event) => setField('quantityOnHand', event.target.value)}
            required
          />

          <div className="inventoryDrawer__field">
            <label className="inventoryDrawer__label">יחידה *</label>
            <input
              className="inventoryDrawer__input"
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
          </div>

          <Input
            label="סף מינימום"
            type="number"
            min="0"
            step="0.001"
            value={form.minimumQuantity}
            onChange={(event) => setField('minimumQuantity', event.target.value)}
          />
        </div>

        <div className="inventoryDrawer__field">
          <label className="inventoryDrawer__label">הערות</label>
          <textarea
            className="inventoryDrawer__textarea"
            rows={3}
            value={form.notes}
            onChange={(event) => setField('notes', event.target.value)}
          />
        </div>

        {isEditMode && (
          <label className="inventoryDrawer__checkboxRow">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setField('isActive', event.target.checked)}
            />
            <span>פריט פעיל</span>
          </label>
        )}

        {error && <p className="inventoryDrawer__error">{error}</p>}

        <div className="inventoryDrawer__actions">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'שומר...' : 'שמור'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            ביטול
          </Button>

          {isEditMode && inventoryItem.isActive && (
            <>
              {confirmDeactivate ? (
                <>
                  <span className="inventoryDrawer__confirmText">לבטל את פעילות הפריט?</span>
                  <Button variant="danger" onClick={handleDeactivate} disabled={isSaving}>
                    אישור ביטול
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmDeactivate(false)}
                    disabled={isSaving}
                  >
                    חזור
                  </Button>
                </>
              ) : (
                <Button
                  variant="danger"
                  onClick={() => setConfirmDeactivate(true)}
                  disabled={isSaving}
                >
                  ביטול פעילות
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}

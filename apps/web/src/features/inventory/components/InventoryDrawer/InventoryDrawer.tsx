import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, ImageOff, Trash2 } from 'lucide-react';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { DetailsField } from '@shared/components/DetailsField';
import { DetailsSection } from '@shared/components/DetailsSection';
import { Drawer, useDrawerMaximize } from '@shared/components/Drawer';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { Textarea } from '@shared/components/Textarea';
import { Checkbox } from '@shared/components/Checkbox';
import { InlineAlert } from '@shared/components/InlineAlert';
import { ConfirmInline } from '@shared/components/ConfirmInline';
import { InventoryImage } from '../InventoryImage';
import { useInventoryMutations } from '../../hooks/useInventory';
import { CANONICAL_CATEGORIES, isCanonicalCategory } from '../../utils/categoryImages';
import { getSeededProductImage } from '../../data/productImageCatalog';
import { resolveInventoryItemImage } from '../../utils/productImages';
import { formatQuantity, isLowStock } from '../../utils/stock';
import type { CreateInventoryItemRequest, InventoryItem } from '../../types';
import './InventoryDrawer.css';

const UNIT_OPTIONS = ['יח׳', 'מ׳', 'ק״ג', 'סט', 'גליל'];

const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// A newly created item must carry a real user-uploaded image; a seeded catalog image never
// satisfies this. Enforced on the frontend (here) and atomically on the backend create endpoint.
const IMAGE_REQUIRED_MESSAGE = 'יש להעלות תמונת מוצר לפני שמירת הפריט';

interface InventoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (inventoryItem: InventoryItem) => void | Promise<void>;
  inventoryItem?: InventoryItem | null;
  // Pre-selects the category when creating a new item from within a category context.
  defaultCategory?: string;
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

function buildInitialState(
  inventoryItem: InventoryItem | null,
  defaultCategory?: string,
): InventoryFormState {
  return {
    skuCode: inventoryItem?.skuCode ?? '',
    itemName: inventoryItem?.itemName ?? '',
    category: inventoryItem?.category ?? defaultCategory ?? '',
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

export function InventoryDrawer({
  isOpen,
  onClose,
  onSaved,
  inventoryItem,
  defaultCategory,
}: InventoryDrawerProps) {
  if (!isOpen) return null;

  // Remount per item so form/edit state always resets when the drawer
  // opens for a different record (or switches from create to a saved record).
  return (
    <InventoryDrawerContent
      key={inventoryItem?.inventoryItemId ?? 'new'}
      inventoryItem={inventoryItem ?? null}
      onClose={onClose}
      onSaved={onSaved}
      defaultCategory={defaultCategory}
    />
  );
}

interface InventoryDrawerContentProps {
  inventoryItem: InventoryItem | null;
  onClose: () => void;
  onSaved?: (inventoryItem: InventoryItem) => void | Promise<void>;
  defaultCategory?: string;
}

function InventoryDrawerContent({
  inventoryItem,
  onClose,
  onSaved,
  defaultCategory,
}: InventoryDrawerContentProps) {
  const isExistingItem = inventoryItem != null;
  const {
    createWithImageMutation,
    updateMutation,
    deactivateMutation,
    uploadImageMutation,
    removeImageMutation,
  } = useInventoryMutations();

  // Existing items open in read-only review mode; create opens editable.
  const [isEditing, setIsEditing] = useState(!isExistingItem);
  const [form, setForm] = useState<InventoryFormState>(() =>
    buildInitialState(inventoryItem, defaultCategory),
  );
  const [error, setError] = useState<string | null>(null);
  const { isMaximized, toggleMaximize } = useDrawerMaximize(true);

  // Create persists the record and its image atomically (single request), so there is never a
  // half-created record to remember and a retry can never duplicate.
  const persistedItem = inventoryItem;

  // Image edits are staged and applied on save (after the record exists), so the
  // selected image can be previewed before committing.
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImageRequested, setRemoveImageRequested] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewUrl = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function setField<K extends keyof InventoryFormState>(key: K, value: InventoryFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetImageEdits() {
    setImageFile(null);
    setRemoveImageRequested(false);
  }

  function handleStartEdit() {
    setForm(buildInitialState(inventoryItem, defaultCategory));
    resetImageEdits();
    setError(null);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    // Create is atomic: nothing is persisted until save succeeds, so cancelling just closes.
    if (!isExistingItem) {
      onClose();
      return;
    }

    setForm(buildInitialState(inventoryItem, defaultCategory));
    resetImageEdits();
    setError(null);
    setIsEditing(false);
  }

  function handleSelectImageFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Allow re-selecting the same file later.
    event.target.value = '';
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('יש לבחור קובץ תמונה מסוג JPEG, PNG או WebP.');
      return;
    }

    if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
      setError('הקובץ גדול מדי. הגודל המרבי הוא 5MB.');
      return;
    }

    setError(null);
    setRemoveImageRequested(false);
    setImageFile(file);
  }

  function handleRemoveImage() {
    setImageFile(null);
    setRemoveImageRequested(true);
    setError(null);
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

    if (!isCanonicalCategory(form.category)) {
      setError('יש לבחור קטגוריה מהרשימה.');
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

    // CREATE: a new item requires a real user-uploaded image, and the record + image are created
    // atomically in a single request. This guarantees no active item is ever persisted without an
    // image, and a retry after failure can never create a duplicate (nothing was created on failure).
    if (!persistedItem) {
      if (!imageFile) {
        setError(IMAGE_REQUIRED_MESSAGE);
        return;
      }

      let createdInventoryItem: InventoryItem;
      try {
        createdInventoryItem = await createWithImageMutation.mutateAsync({
          request,
          file: imageFile,
        });
      } catch (err) {
        // Nothing was persisted; keep edit mode and the staged file so the user can retry.
        setIsEditing(true);
        setError(err instanceof Error ? err.message : 'שמירת פריט נכשלה');
        return;
      }

      resetImageEdits();
      setIsEditing(false);
      await onSaved?.(createdInventoryItem);
      if (!onSaved) onClose();
      return;
    }

    // EDIT: persist field changes, then apply staged image changes. An image failure here is a
    // partial failure — the field update already succeeded — so we keep edit mode and the staged
    // image and surface a clear message instead of pretending the whole save failed.
    let savedInventoryItem: InventoryItem;
    try {
      const updatedInventoryItem = await updateMutation.mutateAsync({
        id: persistedItem.inventoryItemId,
        request,
      });
      savedInventoryItem = updatedInventoryItem ?? { ...persistedItem, ...request };
    } catch (err) {
      setIsEditing(true);
      setError(err instanceof Error ? err.message : 'שמירת פריט נכשלה');
      return;
    }

    try {
      if (imageFile) {
        savedInventoryItem = await uploadImageMutation.mutateAsync({
          id: savedInventoryItem.inventoryItemId,
          file: imageFile,
        });
      } else if (removeImageRequested && savedInventoryItem.imageUrl) {
        savedInventoryItem = await removeImageMutation.mutateAsync(savedInventoryItem.inventoryItemId);
      }
    } catch (err) {
      setIsEditing(true);
      const reason = err instanceof Error ? err.message : 'פעולה נכשלה';
      setError(
        `הפריט עודכן, אך עדכון התמונה נכשל: ${reason} ניתן לנסות שוב את העלאת התמונה בלחיצה על "שמור".`,
      );
      return;
    }

    resetImageEdits();
    setIsEditing(false);
    await onSaved?.(savedInventoryItem);
    if (!onSaved) onClose();
  }

  async function handleDeactivate() {
    if (!isExistingItem) return;
    setError(null);

    try {
      await deactivateMutation.mutateAsync(inventoryItem.inventoryItemId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'מחיקת הפריט נכשלה');
    }
  }

  // Restore re-uses the standard update path with IsActive=1 (sp_Inventory_Update clears DeletedAt).
  async function handleRestore() {
    if (!isExistingItem) return;
    setError(null);

    const request: CreateInventoryItemRequest = {
      skuCode: inventoryItem.skuCode,
      itemName: inventoryItem.itemName,
      category: inventoryItem.category || undefined,
      quantityOnHand: inventoryItem.quantityOnHand,
      unit: inventoryItem.unit,
      minimumQuantity: inventoryItem.minimumQuantity ?? undefined,
      locationName: inventoryItem.locationName || undefined,
      notes: inventoryItem.notes || undefined,
      isActive: true,
    };

    try {
      const restoredItem = await updateMutation.mutateAsync({
        id: inventoryItem.inventoryItemId,
        request,
      });
      await onSaved?.(restoredItem ?? { ...inventoryItem, ...request });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שחזור הפריט נכשל');
    }
  }

  const isSaving =
    createWithImageMutation.isPending ||
    updateMutation.isPending ||
    deactivateMutation.isPending ||
    uploadImageMutation.isPending ||
    removeImageMutation.isPending;

  const title = !persistedItem
    ? 'פריט מלאי חדש'
    : isEditing
      ? `עריכת פריט — ${persistedItem.itemName}`
      : `פרטי פריט — ${persistedItem.itemName}`;

  // Edit-mode preview candidates (highest priority first): staged file → current uploaded image
  // (unless removal is staged) → seeded SKU image. Never a category image.
  const seededImageUrl = getSeededProductImage(form.skuCode)?.url;
  const editImageSources: (string | null | undefined)[] = [];
  if (previewUrl) {
    editImageSources.push(previewUrl);
  } else if (!removeImageRequested && persistedItem?.imageUrl) {
    editImageSources.push(persistedItem.imageUrl);
  }
  editImageSources.push(seededImageUrl);

  const hasImageToRemove =
    Boolean(previewUrl) || (!removeImageRequested && Boolean(persistedItem?.imageUrl));
  // Create mode shows a neutral empty placeholder (never a category/seeded photo) until the user
  // stages an actual image, so an unselected image is not mistaken for the product's photo.
  const showEmptyImagePlaceholder = !persistedItem && !previewUrl;

  // Edit mode keeps only save/cancel; destructive + restore live in the read-only footer.
  const editFooter = (
    <div className="inventoryDrawer__footerContent">
      {error && <InlineAlert variant="danger">{error}</InlineAlert>}
      <div className="inventoryDrawer__actions">
        <Button onClick={handleSave} isLoading={isSaving}>
          שמור
        </Button>
        <Button variant="secondary" onClick={handleCancelEdit} disabled={isSaving}>
          בטל שינויים
        </Button>
      </div>
    </div>
  );

  const reviewFooter = isExistingItem ? (
    <div className="inventoryDrawer__footerContent">
      {error && <InlineAlert variant="danger">{error}</InlineAlert>}
      <div className="inventoryDrawer__dangerActions">
        {inventoryItem.isActive ? (
          <ConfirmInline
            triggerLabel="בטל פעילות"
            message="לבטל את פעילות פריט המלאי?"
            confirmLabel="אישור"
            onConfirm={handleDeactivate}
            isPending={isSaving}
          />
        ) : (
          <ConfirmInline
            triggerLabel="שחזור"
            message="לשחזר את הפריט?"
            confirmLabel="אישור שחזור"
            variant="primary"
            onConfirm={handleRestore}
            isPending={isSaving}
          />
        )}
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
        isExistingItem && !isEditing ? (
          <Button type="button" variant="secondary" onClick={handleStartEdit}>
            ערוך פרטים
          </Button>
        ) : undefined
      }
      footer={isEditing ? editFooter : reviewFooter}
    >
      {!isEditing && isExistingItem ? (
        <InventoryReviewDetails inventoryItem={inventoryItem} />
      ) : (
        <div className="inventoryDrawer inventoryDrawer--edit">
          <DetailsSection title="תמונת מוצר">
            <div className="inventoryDrawer__imageEditor">
              <div className="inventoryDrawer__imageFrame">
                {showEmptyImagePlaceholder ? (
                  <div className="inventoryDrawer__imagePlaceholder">
                    <ImageOff size={32} aria-hidden="true" />
                    <span>לא נבחרה תמונת מוצר</span>
                  </div>
                ) : (
                  <InventoryImage
                    sources={editImageSources}
                    alt={form.itemName || 'תמונת מוצר'}
                    variant="drawer"
                    showMissingState
                    eager
                  />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="inventoryDrawer__fileInput"
                onChange={handleSelectImageFile}
              />
              <div className="inventoryDrawer__imageActions">
                <Button
                  type="button"
                  variant="secondary"
                  iconStart={<ImagePlus size={16} />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving}
                >
                  {hasImageToRemove ? 'החלפת תמונה' : 'העלאת תמונה'}
                </Button>
                {hasImageToRemove && (
                  <Button
                    type="button"
                    variant="ghost"
                    iconStart={<Trash2 size={16} />}
                    onClick={handleRemoveImage}
                    disabled={isSaving}
                  >
                    הסרת תמונה
                  </Button>
                )}
              </div>
              <p className="inventoryDrawer__imageHint">
                {isExistingItem
                  ? 'ניתן להעלות תמונה בפורמט JPEG, PNG או WebP בגודל עד 5MB.'
                  : 'חובה להעלות תמונת מוצר בפורמט JPEG, PNG או WebP בגודל עד 5MB לפני שמירת הפריט.'}
              </p>
            </div>
          </DetailsSection>

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

              <Select
                label="קטגוריה"
                required
                value={form.category}
                onChange={(event) => setField('category', event.target.value)}
              >
                <option value="" disabled>
                  בחר קטגוריה
                </option>
                {/* Defensive: surface a legacy/unexpected value so editing never crashes,
                    while validation still forces a canonical choice before saving. */}
                {form.category.trim() && !isCanonicalCategory(form.category) && (
                  <option value={form.category}>{form.category} (לא נתמכת)</option>
                )}
                {CANONICAL_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
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
  // Product image only: uploaded → seeded SKU image → explicit missing state. Never a category image.
  const reviewImage = resolveInventoryItemImage(inventoryItem);

  return (
    <div className="inventoryDrawer inventoryDrawer--review">
      <DetailsSection title="תמונה וזיהוי">
        <div className="inventoryDrawer__imageFrame">
          <InventoryImage
            sources={reviewImage.sources}
            alt={inventoryItem.itemName}
            variant="drawer"
            showMissingState
            eager
          />
        </div>
        <div className="inventoryDrawer__detailsGrid">
          <DetailsField label="שם פריט" value={inventoryItem.itemName} />
          <DetailsField
            label="מק״ט"
            value={<span className="inventoryDrawer__skuValue">{inventoryItem.skuCode}</span>}
          />
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

      <DetailsSection title="סיווג">
        <div className="inventoryDrawer__detailsGrid">
          <DetailsField label="קטגוריה" value={inventoryItem.category} />
          <DetailsField label="מיקום אחסון" value={inventoryItem.locationName} />
        </div>
      </DetailsSection>

      <DetailsSection title="מידע נוסף">
        <DetailsField label="הערות" value={inventoryItem.notes} />
      </DetailsSection>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { InlineAlert } from '@shared/components/InlineAlert';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import {
  INVENTORY_USAGE_TYPE_OPTIONS,
  INVENTORY_USAGE_TYPES,
  type InventoryUsageType,
} from '@shared/constants/inventoryUsageTypes';
import { getInventoryItemsAsync } from '@features/inventory/api/inventoryApiClient';
import { CANONICAL_CATEGORIES } from '@features/inventory/utils/categoryImages';
import { useQuery } from '@tanstack/react-query';
import {
  addReportInventoryLineAsync,
  deleteReportInventoryLineAsync,
  getInventoryBySkuAsync,
} from '../../api/reportsApiClient';
import { SkuCameraScanner } from '../SkuCameraScanner';
import type { WorkReportInventoryLine } from '../../types';
import './ReportFormInventorySection.css';

export interface PendingInventoryLine {
  tempId: string;
  inventoryItemId: number;
  quantity: number;
  usageType: InventoryUsageType;
  itemName: string;
  skuCode?: string | null;
}

interface ReportFormInventorySectionProps {
  canEdit: boolean;
  reportId?: number | null;
  pendingLines: PendingInventoryLine[];
  onPendingLinesChange: (lines: PendingInventoryLine[]) => void;
  savedLines?: WorkReportInventoryLine[];
  onSavedLinesChange?: () => void;
}

function normalizeSkuInput(raw: string): string {
  return raw.trim().replace(/\s+/g, '');
}

function createTempId() {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ReportFormInventorySection({
  canEdit,
  reportId,
  pendingLines,
  onPendingLinesChange,
  savedLines = [],
  onSavedLinesChange,
}: ReportFormInventorySectionProps) {
  const [category, setCategory] = useState('');
  const [productId, setProductId] = useState('');
  const [usageType, setUsageType] = useState<InventoryUsageType>(INVENTORY_USAGE_TYPES.Used);
  const [quantity, setQuantity] = useState('1');
  const [skuInput, setSkuInput] = useState('');
  const [sectionError, setSectionError] = useState<string | null>(null);
  const scanBufferRef = useRef('');
  const scanTimeoutRef = useRef<number | null>(null);

  const isEditMode = reportId != null;

  const inventoryQuery = useQuery({
    queryKey: ['inventoryItems', 'reportForm', category],
    queryFn: () =>
      getInventoryItemsAsync({
        category,
        status: 'active',
        lowStockOnly: false,
      }),
    enabled: canEdit && Boolean(category),
  });

  const products = useMemo(
    () => inventoryQuery.data ?? [],
    [inventoryQuery.data],
  );

  const selectedProduct = useMemo(
    () => products.find((item) => String(item.inventoryItemId) === productId) ?? null,
    [productId, products],
  );

  const addLineMutation = useMutation({
    mutationFn: async (line: { inventoryItemId: number; quantity: number; usageType: string }) => {
      if (reportId == null) throw new Error('missing report');
      return addReportInventoryLineAsync(reportId, line);
    },
    onSuccess: () => {
      onSavedLinesChange?.();
      setSectionError(null);
    },
    onError: (err) => {
      setSectionError(err instanceof Error ? err.message : 'הוספת שורת מלאי נכשלה');
    },
  });

  const deleteLineMutation = useMutation({
    mutationFn: (lineId: number) => {
      if (reportId == null) throw new Error('missing report');
      return deleteReportInventoryLineAsync(reportId, lineId);
    },
    onSuccess: () => onSavedLinesChange?.(),
  });

  const upsertPendingLine = useCallback(
    (
      item: { inventoryItemId: number; itemName: string; skuCode?: string | null },
      nextQuantity: number,
      nextUsageType: InventoryUsageType,
    ) => {
      const existing = pendingLines.find((line) => line.inventoryItemId === item.inventoryItemId);
      if (existing) {
        onPendingLinesChange(
          pendingLines.map((line) =>
            line.inventoryItemId === item.inventoryItemId
              ? { ...line, quantity: nextQuantity, usageType: nextUsageType }
              : line,
          ),
        );
        return;
      }

      onPendingLinesChange([
        ...pendingLines,
        {
          tempId: createTempId(),
          inventoryItemId: item.inventoryItemId,
          quantity: nextQuantity,
          usageType: nextUsageType,
          itemName: item.itemName,
          skuCode: item.skuCode,
        },
      ]);
    },
    [onPendingLinesChange, pendingLines],
  );

  const handleSkuLookup = useCallback(
    async (rawSku?: string) => {
      const sku = normalizeSkuInput(rawSku ?? skuInput);
      if (!sku) return;
      setSectionError(null);

      try {
        const item = await getInventoryBySkuAsync(sku);

        if (isEditMode) {
          const existing = savedLines.find((line) => line.inventoryItemId === item.inventoryItemId);
          await addLineMutation.mutateAsync({
            inventoryItemId: item.inventoryItemId,
            quantity: existing ? existing.quantity + 1 : 1,
            usageType: existing?.usageType ?? INVENTORY_USAGE_TYPES.Used,
          });
        } else {
          const existing = pendingLines.find((line) => line.inventoryItemId === item.inventoryItemId);
          upsertPendingLine(
            item,
            existing ? existing.quantity + 1 : 1,
            existing?.usageType ?? INVENTORY_USAGE_TYPES.Used,
          );
        }

        setSkuInput('');
      } catch (err) {
        setSectionError(
          err instanceof Error ? err.message : `מק״ט "${sku}" לא נמצא במלאי`,
        );
      }
    },
    [addLineMutation, isEditMode, pendingLines, savedLines, skuInput, upsertPendingLine],
  );

  useEffect(() => {
    if (!canEdit) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Enter' && scanBufferRef.current.trim()) {
        event.preventDefault();
        void handleSkuLookup(scanBufferRef.current);
        scanBufferRef.current = '';
      } else if (event.key.length === 1) {
        scanBufferRef.current += event.key;
        if (scanTimeoutRef.current) window.clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = window.setTimeout(() => {
          scanBufferRef.current = '';
        }, 200);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canEdit, handleSkuLookup]);

  function handleAddManualLine() {
    if (!selectedProduct) {
      setSectionError('יש לבחור מוצר');
      return;
    }

    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setSectionError('יש להזין כמות חיובית');
      return;
    }

    setSectionError(null);

    if (isEditMode) {
      const existing = savedLines.find(
        (line) => line.inventoryItemId === selectedProduct.inventoryItemId,
      );
      void addLineMutation.mutateAsync({
        inventoryItemId: selectedProduct.inventoryItemId,
        quantity: existing ? existing.quantity + parsedQuantity : parsedQuantity,
        usageType,
      });
    } else {
      const existing = pendingLines.find(
        (line) => line.inventoryItemId === selectedProduct.inventoryItemId,
      );
      upsertPendingLine(
        selectedProduct,
        existing ? existing.quantity + parsedQuantity : parsedQuantity,
        usageType,
      );
    }

    setQuantity('1');
  }

  function handleRemovePendingLine(tempId: string) {
    onPendingLinesChange(pendingLines.filter((line) => line.tempId !== tempId));
  }

  const usageTypeLabel = (value: InventoryUsageType | string) =>
    INVENTORY_USAGE_TYPE_OPTIONS.find((option) => option.code === value)?.label ?? value;

  const hasLines = isEditMode ? savedLines.length > 0 : pendingLines.length > 0;

  return (
    <section className="reportFormInventorySection">
      <h3>שימוש במלאי</h3>

      {!canEdit && (
        <p className="reportFormInventorySection__hint">שורות המלאי ניתנות לעריכה רק בטיוטת מלאי.</p>
      )}

      {canEdit && (
        <>
          <div className="reportFormInventorySection__skuScan">
            <Input
              label="סריקת / הזנת מק״ט"
              value={skuInput}
              onChange={(event) => setSkuInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSkuLookup();
                }
              }}
              placeholder="סרוק או הקלד מק״ט ולחץ Enter"
            />
            <Button type="button" variant="secondary" onClick={() => void handleSkuLookup()}>
              חפש מק״ט
            </Button>
            <SkuCameraScanner
              disabled={addLineMutation.isPending}
              onSkuDetected={(sku) => void handleSkuLookup(sku)}
            />
          </div>

          <div className="reportFormInventorySection__grid">
            <Select
              label="קטגוריה"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setProductId('');
              }}
            >
              <option value="">בחר קטגוריה</option>
              {CANONICAL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>

            {category && inventoryQuery.isLoading && <PageSpinner />}
            {category && inventoryQuery.error && (
              <ErrorState
                message={
                  inventoryQuery.error instanceof Error
                    ? inventoryQuery.error.message
                    : 'טעינת מוצרים נכשלה'
                }
                onRetry={() => void inventoryQuery.refetch()}
              />
            )}

            {category && !inventoryQuery.isLoading && !inventoryQuery.error && (
              <Select
                label="מוצר"
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
              >
                <option value="">בחר מוצר</option>
                {products.length === 0 ? (
                  <option value="" disabled>
                    אין מוצרים בקטגוריה
                  </option>
                ) : (
                  products.map((item) => (
                    <option key={item.inventoryItemId} value={item.inventoryItemId}>
                      {item.itemName} ({item.skuCode})
                    </option>
                  ))
                )}
              </Select>
            )}

            <Select
              label="סוג שימוש"
              value={usageType}
              onChange={(event) => setUsageType(event.target.value as InventoryUsageType)}
            >
              {INVENTORY_USAGE_TYPE_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </Select>

            <Input
              label="כמות"
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={handleAddManualLine}
            disabled={!selectedProduct || addLineMutation.isPending}
          >
            הוסף שורה
          </Button>
        </>
      )}

      {sectionError && <InlineAlert variant="danger">{sectionError}</InlineAlert>}

      {!hasLines ? (
        <p className="reportFormInventorySection__empty">אין שורות מלאי</p>
      ) : (
        <ul className="reportFormInventorySection__list">
          {isEditMode
            ? savedLines.map((line) => (
                <li key={line.workReportInventoryItemId} className="reportFormInventorySection__row">
                  <span>{line.itemNameSnapshot ?? line.skuSnapshot ?? `#${line.inventoryItemId}`}</span>
                  <span>{line.quantity}</span>
                  <span>{usageTypeLabel(line.usageType)}</span>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => deleteLineMutation.mutate(line.workReportInventoryItemId)}
                      disabled={deleteLineMutation.isPending}
                    >
                      הסר
                    </Button>
                  )}
                </li>
              ))
            : pendingLines.map((line) => (
                <li key={line.tempId} className="reportFormInventorySection__row">
                  <span>{line.itemName}</span>
                  <span>{line.quantity}</span>
                  <span>{usageTypeLabel(line.usageType)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleRemovePendingLine(line.tempId)}
                  >
                    הסר
                  </Button>
                </li>
              ))}
        </ul>
      )}
    </section>
  );
}

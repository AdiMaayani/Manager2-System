import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { EmptyState } from '@shared/components/EmptyState';
import { ErrorState } from '@shared/components/ErrorState';
import { FilterBar } from '@shared/components/FilterBar';
import { Input } from '@shared/components/Input';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { InventoryDrawer } from '../../components/InventoryDrawer';
import { useInventory } from '../../hooks/useInventory';
import type { InventoryItem, InventoryStatusFilter } from '../../types';
import './InventoryPage.css';

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

export function InventoryPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<InventoryStatusFilter>('active');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  // undefined = drawer closed, null = create mode, InventoryItem = review existing.
  const [drawerInventoryItem, setDrawerInventoryItem] =
    useState<InventoryItem | null | undefined>(undefined);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const filters = useMemo(
    () => ({
      search: debouncedSearch,
      category,
      status,
      lowStockOnly,
    }),
    [category, debouncedSearch, lowStockOnly, status],
  );

  const categorySourceFilters = useMemo(
    () => ({
      search: '',
      category: '',
      status: 'all' as InventoryStatusFilter,
      lowStockOnly: false,
    }),
    [],
  );

  const { data: inventoryItems, isLoading, error, refetch } = useInventory(filters);
  const { data: categorySourceItems } = useInventory(categorySourceFilters);

  const isDrawerOpen = drawerInventoryItem !== undefined;
  const selectedInventoryItemId = drawerInventoryItem?.inventoryItemId ?? null;
  const hasFilters = Boolean(search.trim() || category.trim() || lowStockOnly || status !== 'active');
  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (categorySourceItems ?? [])
            .map((inventoryItem) => inventoryItem.category?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((first, second) => first.localeCompare(second, 'he')),
    [categorySourceItems],
  );

  const openInventoryItem = (inventoryItem: InventoryItem) => {
    setDrawerInventoryItem(inventoryItem);
  };

  if (isLoading) {
    return (
      <PageShell title="מלאי">
        <PageSpinner />
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell title="מלאי">
        <ErrorState message={error.message} onRetry={() => refetch()} />
      </PageShell>
    );
  }

  return (
    <PageShell title="מלאי">
      <FilterBar
        actions={<Button onClick={() => setDrawerInventoryItem(null)}>+ פריט חדש</Button>}
      >
        <div className="inventoryPage__filter inventoryPage__filter--search">
          <Input
            label="חיפוש"
            placeholder="שם פריט, מק״ט, מיקום..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="inventoryPage__filter">
          <label className="inventoryPage__label">קטגוריה</label>
          <select
            className="inventoryPage__select"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">כל הקטגוריות</option>
            {categoryOptions.map((categoryOption) => (
              <option key={categoryOption} value={categoryOption}>
                {categoryOption}
              </option>
            ))}
          </select>
        </div>

        <div className="inventoryPage__filter">
          <label className="inventoryPage__label">סטטוס</label>
          <select
            className="inventoryPage__select"
            value={status}
            onChange={(event) => setStatus(event.target.value as InventoryStatusFilter)}
          >
            <option value="active">פעילים</option>
            <option value="inactive">לא פעילים</option>
            <option value="all">הכול</option>
          </select>
        </div>

        <label className="inventoryPage__checkbox">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(event) => setLowStockOnly(event.target.checked)}
          />
          <span>מתחת למינימום</span>
        </label>
      </FilterBar>

      {!inventoryItems || inventoryItems.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'לא נמצאו פריטי מלאי' : 'אין פריטי מלאי עדיין'}
          description={
            hasFilters
              ? 'נסו לשנות את החיפוש או הסינון.'
              : 'הוסיפו פריט ראשון כדי להתחיל לנהל מלאי.'
          }
        />
      ) : (
        <div className="inventoryPage__tableWrap">
          <table className="inventoryPage__table">
            <thead>
              <tr>
                <th>מק״ט</th>
                <th>פריט</th>
                <th>קטגוריה</th>
                <th>כמות</th>
                <th>מינימום</th>
                <th>מיקום</th>
                <th>סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {inventoryItems.map((inventoryItem) => (
                <tr
                  key={inventoryItem.inventoryItemId}
                  role="button"
                  tabIndex={0}
                  className={`inventoryPage__row ${
                    selectedInventoryItemId === inventoryItem.inventoryItemId
                      ? 'inventoryPage__row--selected'
                      : ''
                  }`.trim()}
                  onClick={() => openInventoryItem(inventoryItem)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openInventoryItem(inventoryItem);
                    }
                  }}
                >
                  <td className="inventoryPage__sku">{inventoryItem.skuCode}</td>
                  <td>
                    <div className="inventoryPage__itemName">{inventoryItem.itemName}</div>
                    {inventoryItem.notes && (
                      <div className="inventoryPage__notes">{inventoryItem.notes}</div>
                    )}
                  </td>
                  <td>{inventoryItem.category ?? '—'}</td>
                  <td>
                    <span className={isLowStock(inventoryItem) ? 'inventoryPage__lowStock' : ''}>
                      {formatQuantity(inventoryItem.quantityOnHand, inventoryItem.unit)}
                    </span>
                  </td>
                  <td>
                    {inventoryItem.minimumQuantity == null
                      ? '—'
                      : formatQuantity(inventoryItem.minimumQuantity, inventoryItem.unit)}
                  </td>
                  <td>{inventoryItem.locationName ?? '—'}</td>
                  <td>
                    <div className="inventoryPage__badges">
                      <Badge variant={inventoryItem.isActive ? 'success' : 'neutral'}>
                        {inventoryItem.isActive ? 'פעיל' : 'לא פעיל'}
                      </Badge>
                      {isLowStock(inventoryItem) && <Badge variant="warning">מלאי נמוך</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <InventoryDrawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerInventoryItem(undefined)}
        onSaved={(savedInventoryItem) => setDrawerInventoryItem(savedInventoryItem)}
        inventoryItem={drawerInventoryItem}
      />
    </PageShell>
  );
}

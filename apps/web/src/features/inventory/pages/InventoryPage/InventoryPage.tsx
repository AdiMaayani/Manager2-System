import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { Checkbox } from '@shared/components/Checkbox';
import { ErrorState } from '@shared/components/ErrorState';
import { FilterBar, FilterField } from '@shared/components/FilterBar';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { DataTable, type DataTableColumn } from '@shared/components/DataTable';
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

  const columns: DataTableColumn<InventoryItem>[] = [
    {
      id: 'sku',
      header: 'מק״ט',
      cell: (item) => <span className="inventoryPage__sku">{item.skuCode}</span>,
    },
    {
      id: 'item',
      header: 'פריט',
      cell: (item) => (
        <>
          <div className="inventoryPage__itemName">{item.itemName}</div>
          {item.notes && <div className="inventoryPage__notes">{item.notes}</div>}
        </>
      ),
    },
    { id: 'category', header: 'קטגוריה', cell: (item) => item.category ?? '—' },
    {
      id: 'quantity',
      header: 'כמות',
      cell: (item) => (
        <span className={isLowStock(item) ? 'inventoryPage__lowStock' : ''}>
          {formatQuantity(item.quantityOnHand, item.unit)}
        </span>
      ),
    },
    {
      id: 'minimum',
      header: 'מינימום',
      cell: (item) =>
        item.minimumQuantity == null
          ? '—'
          : formatQuantity(item.minimumQuantity, item.unit),
    },
    { id: 'location', header: 'מיקום', cell: (item) => item.locationName ?? '—' },
    {
      id: 'status',
      header: 'סטטוס',
      cell: (item) => (
        <div className="inventoryPage__badges">
          <Badge variant={item.isActive ? 'success' : 'neutral'}>
            {item.isActive ? 'פעיל' : 'לא פעיל'}
          </Badge>
          {isLowStock(item) && <Badge variant="warning">מלאי נמוך</Badge>}
        </div>
      ),
    },
  ];

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
        actions={
          <Button iconStart={<Plus size={18} />} onClick={() => setDrawerInventoryItem(null)}>
            פריט חדש
          </Button>
        }
      >
        <FilterField label="חיפוש" grow>
          <Input
            placeholder="שם פריט, מק״ט, מיקום..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </FilterField>

        <FilterField label="קטגוריה">
          <Select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">כל הקטגוריות</option>
            {categoryOptions.map((categoryOption) => (
              <option key={categoryOption} value={categoryOption}>
                {categoryOption}
              </option>
            ))}
          </Select>
        </FilterField>

        <FilterField label="סטטוס">
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as InventoryStatusFilter)}
          >
            <option value="active">פעילים</option>
            <option value="inactive">לא פעילים</option>
            <option value="all">הכול</option>
          </Select>
        </FilterField>

        <div className="inventoryPage__checkboxField">
          <Checkbox
            label="מתחת למינימום"
            checked={lowStockOnly}
            onChange={(event) => setLowStockOnly(event.target.checked)}
          />
        </div>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={inventoryItems ?? []}
        getRowId={(item) => item.inventoryItemId}
        onRowClick={openInventoryItem}
        selectedRowId={selectedInventoryItemId}
        emptyTitle={hasFilters ? 'לא נמצאו פריטי מלאי' : 'אין פריטי מלאי עדיין'}
        emptyDescription={
          hasFilters
            ? 'נסו לשנות את החיפוש או הסינון.'
            : 'הוסיפו פריט ראשון כדי להתחיל לנהל מלאי.'
        }
      />

      <InventoryDrawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerInventoryItem(undefined)}
        onSaved={(savedInventoryItem) => setDrawerInventoryItem(savedInventoryItem)}
        inventoryItem={drawerInventoryItem}
      />
    </PageShell>
  );
}

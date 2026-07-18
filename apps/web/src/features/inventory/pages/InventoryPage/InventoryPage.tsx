import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { Badge } from '@shared/components/Badge';
import { Button } from '@shared/components/Button';
import { Checkbox } from '@shared/components/Checkbox';
import { EmptyState } from '@shared/components/EmptyState';
import { ErrorState } from '@shared/components/ErrorState';
import { FilterBar, FilterField } from '@shared/components/FilterBar';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { SegmentedControl, type SegmentItem } from '@shared/components/SegmentedControl';
import { DataTable, type DataTableColumn } from '@shared/components/DataTable';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { SectionLoader } from '@shared/components/SectionLoader';
import { useLocalStorage } from '@shared/hooks';
import { InventoryDrawer } from '../../components/InventoryDrawer';
import { InventoryCategoryGrid } from '../../components/InventoryCategoryGrid';
import { InventoryImage } from '../../components/InventoryImage';
import { InventoryProductGrid } from '../../components/InventoryProductGrid';
import { InventoryViewSwitcher } from '../../components/InventoryViewSwitcher';
import { useInventory } from '../../hooks/useInventory';
import {
  CANONICAL_CATEGORIES,
  categoryDisplayName,
  isCanonicalCategory,
  normalizeCategoryName,
  resolveCanonicalCategory,
  resolveCategoryImage,
} from '../../utils/categoryImages';
import { formatQuantity, isLowStock } from '../../utils/stock';
import type {
  InventoryCategorySummary,
  InventoryItem,
  InventoryStatusFilter,
  InventoryViewMode,
} from '../../types';
import './InventoryPage.css';

const VIEW_MODE_STORAGE_KEY = 'manager2_inventory_view_mode';

const DEFAULT_STATUS_FILTER: InventoryStatusFilter = 'active';

const STATUS_FILTER_ITEMS: SegmentItem<InventoryStatusFilter>[] = [
  { id: 'active', label: 'פעילים' },
  { id: 'inactive', label: 'מחוקים' },
  { id: 'all', label: 'הכול' },
];

const STATUS_FILTER_IDS = STATUS_FILTER_ITEMS.map((item) => item.id);

// Falls back to the page default ("active") for a missing/unrecognized URL value so stale or
// hand-edited links stay usable and filter semantics match the previous in-memory default.
function resolveStatusFilterParam(value: string | null): InventoryStatusFilter {
  return value && STATUS_FILTER_IDS.includes(value as InventoryStatusFilter)
    ? (value as InventoryStatusFilter)
    : DEFAULT_STATUS_FILTER;
}

function resolveLowStockOnlyParam(value: string | null): boolean {
  return value === 'true';
}

export function InventoryPage() {
  // The selected category lives in the URL (?category=...) so it survives refresh and
  // works with browser back/forward. Only a canonical value selects a category; anything
  // else (including a legacy/invalid param) falls back to the overview.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawCategoryParam = searchParams.get('category');
  const selectedCategory = resolveCanonicalCategory(rawCategoryParam);
  const showOverview = selectedCategory === null;

  // Persisted across sessions and preserved while navigating between categories.
  const [viewMode, setViewMode] = useLocalStorage<InventoryViewMode>(VIEW_MODE_STORAGE_KEY, 'card');

  const [categorySearch, setCategorySearch] = useState('');

  // Status and low-stock are derived from the URL so back/forward restores them without a
  // separate sync effect. Search input stays local so keystrokes can debounce before hitting the URL;
  // the committed search used for queries is the URL value itself (updated after the debounce).
  const status = resolveStatusFilterParam(searchParams.get('status'));
  const lowStockOnly = resolveLowStockOnlyParam(searchParams.get('lowStockOnly'));
  const debouncedSearch = searchParams.get('search') ?? '';

  const [search, setSearch] = useState(debouncedSearch);
  const [prevUrlSearch, setPrevUrlSearch] = useState(debouncedSearch);

  // When the URL search param changes (back/forward, clear filters, category drill-down reset),
  // adjust the controlled input during render — avoids a setState-in-effect lint violation.
  if (debouncedSearch !== prevUrlSearch) {
    setPrevUrlSearch(debouncedSearch);
    setSearch(debouncedSearch);
  }

  // undefined = drawer closed, null = create mode, InventoryItem = review existing.
  // Drawer state remains React-local in this phase (not URL-driven).
  const [drawerInventoryItem, setDrawerInventoryItem] =
    useState<InventoryItem | null | undefined>(undefined);

  // Product filters persist to the URL the same way as Quotes/Customers/Contacts. Only the named
  // keys are updated, so category and any unrelated params are always preserved untouched.
  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        Object.entries(updates).forEach(([key, value]) => {
          if (value) {
            next.set(key, value);
          } else {
            next.delete(key);
          }
        });
        return next;
      });
    },
    [setSearchParams],
  );

  // Debounce keeps the existing 300ms-after-typing-stops filtering behavior; the URL's search
  // param is the committed filter value, so queries only change after the debounce settles.
  // Skip the URL write when the committed value already matches, to avoid empty history noise on mount.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextSearch = search.trim();
      if (nextSearch !== debouncedSearch) {
        updateSearchParams({ search: nextSearch || null });
      }
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [search, debouncedSearch, updateSearchParams]);

  // Drop an unsupported category from the URL so the overview shows cleanly and back/forward
  // never lands on an invalid value. setSearchParams is router navigation, not React state.
  useEffect(() => {
    if (rawCategoryParam !== null && !isCanonicalCategory(rawCategoryParam)) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('category');
      setSearchParams(nextParams, { replace: true });
    }
  }, [rawCategoryParam, searchParams, setSearchParams]);

  // Overview dataset: every item (any status) so we can render category cards with active counts.
  const categorySourceFilters = useMemo(
    () => ({
      search: '',
      category: '',
      status: 'all' as InventoryStatusFilter,
      lowStockOnly: false,
    }),
    [],
  );
  const {
    data: categorySourceItems,
    isLoading: isCategoriesLoading,
    error: categoriesError,
    refetch: refetchCategories,
  } = useInventory(categorySourceFilters, { enabled: showOverview });

  // Product dataset: search/status/low-stock are applied server-side. Category is applied
  // client-side from this single dataset so switching category or view never refetches and
  // uncategorized items stay reachable. viewMode is intentionally absent from the query key.
  const productFilters = useMemo(
    () => ({ search: debouncedSearch, category: '', status, lowStockOnly }),
    [debouncedSearch, status, lowStockOnly],
  );
  const {
    data: allProductItems,
    isLoading: isProductsLoading,
    error: productsError,
    refetch: refetchProducts,
  } = useInventory(productFilters, { enabled: !showOverview });

  // Exactly the eight canonical categories, in canonical order, with counts computed from the
  // loaded data. Legacy/unknown category values never create extra cards.
  const categorySummaries = useMemo<InventoryCategorySummary[]>(() => {
    const counts = new Map<string, { active: number; total: number }>();
    for (const item of categorySourceItems ?? []) {
      const canonical = resolveCanonicalCategory(item.category);
      if (!canonical) continue;
      const key = normalizeCategoryName(canonical);
      const entry = counts.get(key) ?? { active: 0, total: 0 };
      entry.total += 1;
      if (item.isActive) entry.active += 1;
      counts.set(key, entry);
    }
    return CANONICAL_CATEGORIES.map((name) => {
      const entry = counts.get(normalizeCategoryName(name));
      return { name, activeCount: entry?.active ?? 0, totalCount: entry?.total ?? 0 };
    });
  }, [categorySourceItems]);

  const filteredCategorySummaries = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) return categorySummaries;
    return categorySummaries.filter((summary) =>
      categoryDisplayName(summary.name).toLowerCase().includes(query),
    );
  }, [categorySummaries, categorySearch]);

  // Same filtered collection feeds both the card grid and the table.
  const productItems = useMemo(() => {
    if (showOverview || !allProductItems) return [];
    const target = normalizeCategoryName(selectedCategory ?? '');
    return allProductItems.filter((item) => normalizeCategoryName(item.category) === target);
  }, [allProductItems, selectedCategory, showOverview]);

  const isDrawerOpen = drawerInventoryItem !== undefined;
  const selectedInventoryItemId = drawerInventoryItem?.inventoryItemId ?? null;
  const hasProductFilters = Boolean(search.trim() || lowStockOnly || status !== DEFAULT_STATUS_FILTER);

  const handleSelectCategory = (name: string) => {
    // Enter a category with a clean filter context so the full category is visible first.
    // Clearing URL product-filter params also resets the local search input via URL sync above.
    setSearchParams((current) => {
      const nextParams = new URLSearchParams(current);
      nextParams.set('category', name);
      nextParams.delete('search');
      nextParams.delete('status');
      nextParams.delete('lowStockOnly');
      return nextParams;
    });
  };

  const handleBackToCategories = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('category');
    setSearchParams(nextParams);
  };

  // Switching category from the filter Select keeps the current product filters (acts as a filter,
  // not a fresh drill-down). An empty value returns to the category overview.
  const handleCategoryChange = (value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value) {
      nextParams.set('category', value);
    } else {
      nextParams.delete('category');
    }
    setSearchParams(nextParams);
  };

  const resetProductFilters = () => {
    // Clearing URL params resets derived status/lowStock and the local search input via URL sync.
    updateSearchParams({ search: null, status: null, lowStockOnly: null });
  };

  const openInventoryItem = (item: InventoryItem) => {
    setDrawerInventoryItem(item);
  };

  const columns: DataTableColumn<InventoryItem>[] = [
    {
      id: 'sku',
      header: 'מק״ט',
      width: '120px',
      cell: (item) => <span className="inventoryPage__sku">{item.skuCode}</span>,
    },
    {
      id: 'item',
      header: 'פריט',
      width: '26%',
      cell: (item) => (
        <>
          <div className="inventoryPage__itemName">{item.itemName}</div>
          {item.notes && <div className="inventoryPage__notes">{item.notes}</div>}
        </>
      ),
    },
    {
      id: 'category',
      header: 'קטגוריה',
      width: '14%',
      cell: (item) => item.category ?? '—',
    },
    {
      id: 'quantity',
      header: 'כמות',
      width: '110px',
      align: 'end',
      cell: (item) => (
        <span className={isLowStock(item) ? 'inventoryPage__lowStock' : ''}>
          {formatQuantity(item.quantityOnHand, item.unit)}
        </span>
      ),
    },
    {
      id: 'minimum',
      header: 'מינימום',
      width: '110px',
      align: 'end',
      cell: (item) =>
        item.minimumQuantity == null ? '—' : formatQuantity(item.minimumQuantity, item.unit),
    },
    {
      id: 'location',
      header: 'מיקום',
      width: '14%',
      cell: (item) => item.locationName ?? '—',
    },
    {
      id: 'status',
      header: 'סטטוס',
      width: '160px',
      align: 'center',
      cell: (item) => (
        <div className="inventoryPage__badges" style={{ justifyContent: 'center' }}>
          <Badge variant={item.isActive ? 'success' : 'neutral'}>
            {item.isActive ? 'פעיל' : 'לא פעיל'}
          </Badge>
          {isLowStock(item) && <Badge variant="warning">מלאי נמוך</Badge>}
        </div>
      ),
    },
  ];

  const emptyTitle = hasProductFilters ? 'לא נמצאו פריטי מלאי' : 'אין פריטים בקטגוריה זו';
  const emptyDescription = hasProductFilters
    ? 'נסו לשנות את החיפוש או הסינון.'
    : 'הוסיפו פריט ראשון לקטגוריה זו.';

  return (
    <PageShell title="מלאי" wide>
      {showOverview ? (
        <CategoryOverview
          isLoading={isCategoriesLoading}
          error={categoriesError}
          onRetry={() => refetchCategories()}
          categories={filteredCategorySummaries}
          categorySearch={categorySearch}
          onCategorySearchChange={setCategorySearch}
          onSelectCategory={handleSelectCategory}
          onCreate={() => setDrawerInventoryItem(null)}
        />
      ) : (
        <div className="inventoryPage__categoryView">
          <div className="inventoryPage__categoryHeader">
            <button
              type="button"
              className="inventoryPage__back"
              onClick={handleBackToCategories}
            >
              <ArrowRight size={16} aria-hidden="true" />
              כל הקטגוריות
            </button>
            <div className="inventoryPage__categoryHeading">
              <div className="inventoryPage__categoryThumb">
                <InventoryImage
                  sources={[resolveCategoryImage(selectedCategory ?? '')]}
                  alt={categoryDisplayName(selectedCategory)}
                  variant="category"
                  eager
                />
              </div>
              <div>
                <h2 className="inventoryPage__categoryTitle">
                  {categoryDisplayName(selectedCategory)}
                </h2>
                <p className="inventoryPage__categoryCount">{productItems.length} פריטים</p>
              </div>
            </div>
          </div>

          <FilterBar
            actions={
              <div className="inventoryPage__toolbarActions">
                {hasProductFilters && (
                  <Button type="button" variant="ghost" onClick={resetProductFilters}>
                    נקה סינון
                  </Button>
                )}
                <InventoryViewSwitcher value={viewMode} onChange={setViewMode} />
                <Button iconStart={<Plus size={18} />} onClick={() => setDrawerInventoryItem(null)}>
                  פריט חדש
                </Button>
              </div>
            }
          >
            <FilterField label="חיפוש" grow>
              <Input
                placeholder="שם פריט, מק״ט, מיקום..."
                aria-label="חיפוש פריטי מלאי"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </FilterField>

            <FilterField label="סטטוס">
              <div className="inventoryPage__statusControl">
                <SegmentedControl
                  items={STATUS_FILTER_ITEMS}
                  value={status}
                  onChange={(value) => {
                    updateSearchParams({
                      status: value !== DEFAULT_STATUS_FILTER ? value : null,
                    });
                  }}
                  ariaLabel="סינון לפי סטטוס"
                  size="sm"
                />
              </div>
            </FilterField>

            <FilterField label="קטגוריה">
              <Select
                value={selectedCategory ?? ''}
                aria-label="סינון לפי קטגוריה"
                onChange={(event) => handleCategoryChange(event.target.value)}
              >
                {CANONICAL_CATEGORIES.map((name) => (
                  <option key={name} value={name}>
                    {categoryDisplayName(name)}
                  </option>
                ))}
              </Select>
            </FilterField>

            <FilterField label="מלאי">
              <Checkbox
                label="מתחת למינימום"
                checked={lowStockOnly}
                onChange={(event) => {
                  updateSearchParams({
                    lowStockOnly: event.target.checked ? 'true' : null,
                  });
                }}
              />
            </FilterField>
          </FilterBar>

          {productsError ? (
            <ErrorState message={productsError.message} onRetry={() => refetchProducts()} />
          ) : isProductsLoading ? (
            <SectionLoader />
          ) : viewMode === 'card' ? (
            <InventoryProductGrid
              items={productItems}
              selectedItemId={selectedInventoryItemId}
              onSelectItem={openInventoryItem}
              emptyTitle={emptyTitle}
              emptyDescription={emptyDescription}
            />
          ) : (
            <DataTable
              columns={columns}
              rows={productItems}
              getRowId={(item) => item.inventoryItemId}
              onRowClick={openInventoryItem}
              selectedRowId={selectedInventoryItemId}
              emptyTitle={emptyTitle}
              emptyDescription={emptyDescription}
            />
          )}
        </div>
      )}

      <InventoryDrawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerInventoryItem(undefined)}
        onSaved={(savedInventoryItem) => setDrawerInventoryItem(savedInventoryItem)}
        inventoryItem={drawerInventoryItem}
        defaultCategory={selectedCategory ?? undefined}
      />
    </PageShell>
  );
}

interface CategoryOverviewProps {
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  categories: InventoryCategorySummary[];
  categorySearch: string;
  onCategorySearchChange: (value: string) => void;
  onSelectCategory: (name: string) => void;
  onCreate: () => void;
}

function CategoryOverview({
  isLoading,
  error,
  onRetry,
  categories,
  categorySearch,
  onCategorySearchChange,
  onSelectCategory,
  onCreate,
}: CategoryOverviewProps) {
  if (isLoading) {
    return <PageSpinner />;
  }

  if (error) {
    return <ErrorState message={error.message} onRetry={onRetry} />;
  }

  return (
    <>
      <FilterBar
        actions={
          <Button iconStart={<Plus size={18} />} onClick={onCreate}>
            פריט חדש
          </Button>
        }
      >
        <FilterField label="חיפוש קטגוריה" grow>
          <Input
            placeholder="חיפוש קטגוריה..."
            aria-label="חיפוש קטגוריות מלאי"
            value={categorySearch}
            onChange={(event) => onCategorySearchChange(event.target.value)}
          />
        </FilterField>
      </FilterBar>

      {categories.length === 0 ? (
        <EmptyState title="לא נמצאו קטגוריות" description="נסו לשנות את מונח החיפוש." />
      ) : (
        <InventoryCategoryGrid categories={categories} onSelectCategory={onSelectCategory} />
      )}
    </>
  );
}
